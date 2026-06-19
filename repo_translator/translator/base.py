"""BaseTranslator abstract interface, retry wrapper, and glossary/marker-aware translate_file.

Marker protocol (shared with `repo_translator.parser.markdown_parser`, see
repo-translator-design.md / SCRATCH.md decision 4.1): each translatable
fragment in a Markdown source string is wrapped as ``⟦n⟧...⟦/n⟧`` (using
U+27E6 LEFT MATHEMATICAL WHITE SQUARE BRACKET / U+27E7 RIGHT MATHEMATICAL
WHITE SQUARE BRACKET, *not* plain square brackets), where ``n`` is a
zero-based integer id. Everything outside of marker pairs (code blocks,
frontmatter, HTML blocks, table/list syntax, etc.) must be passed through
untouched by the LLM.

This module implements the marker id parsing/validation and glossary
injection logic independently of `markdown_parser` (developed in parallel on
a separate branch) to avoid cross-branch coupling; the two will be wired
together in the integration phase.
"""

from __future__ import annotations

import logging
import re
import time
from abc import ABC, abstractmethod
from collections.abc import Callable

from repo_translator.config import GlossaryEntry

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """\
你是一个专业的技术文档翻译助手。
翻译规则：
1. 将以下 Markdown 内容翻译为简体中文
2. 保留所有代码、命令、变量名、函数名不翻译
3. 保留技术术语的英文原文，括号内附中文说明，例如：Embedding（嵌入）
4. 保留所有 Markdown 格式符号（**、`、#、- 等）不变
5. 保留所有 URL、文件路径不翻译
6. 只输出翻译结果，不添加任何解释或前缀
7. 输入文本中会包含形如 ⟦0⟧...⟦/0⟧ 的标记对（数字为标记 id）。必须原样保留这些标记符号本身（包括其中的数字），只翻译每一对标记之间包裹的文字；标记外的所有内容（包括代码块、表格语法、列表符号、HTML、frontmatter）必须逐字原样输出，不作任何改动
"""


# Marker protocol regexes: ⟦n⟧ ... ⟦/n⟧ where ⟦ = U+27E6, ⟧ = U+27E7.
_MARKER_OPEN_RE = re.compile(r"⟦(\d+)⟧")
_MARKER_CLOSE_RE = re.compile(r"⟦/(\d+)⟧")


class TranslationError(Exception):
    """Raised when a translation call fails after exhausting retries."""


class RateLimitError(Exception):
    """Raised by provider implementations of `translate_raw` to signal a
    rate-limit / 429-style response from the underlying LLM API.

    `_call_with_retry` catches this specific exception type to decide
    whether a failure is retryable (with exponential backoff) — providers
    should catch their SDK-specific rate-limit exceptions and re-raise as
    this type.
    """


def _parse_marker_ids(text: str) -> dict[int, bool]:
    """Parse `⟦n⟧`/`⟦/n⟧` markers appearing in `text`.

    Returns a mapping of marker id -> whether it is "closed" (i.e. both an
    opening ⟦n⟧ and a closing ⟦/n⟧ were found for that id). Ids that only
    have an opening or only a closing tag map to False.
    """
    opens: set[int] = {int(m.group(1)) for m in _MARKER_OPEN_RE.finditer(text)}
    closes: set[int] = {int(m.group(1)) for m in _MARKER_CLOSE_RE.finditer(text)}
    all_ids = opens | closes
    return {marker_id: (marker_id in opens and marker_id in closes) for marker_id in all_ids}


def _extract_marker_content(text: str, marker_id: int) -> str | None:
    """Extract the content between ⟦marker_id⟧ and ⟦/marker_id⟧ in `text`.

    Returns None if the marker pair is not found (missing or unclosed).
    Uses the first occurrence of the opening tag and the first matching
    closing tag found after it.
    """
    open_tag = f"⟦{marker_id}⟧"
    close_tag = f"⟦/{marker_id}⟧"
    start = text.find(open_tag)
    if start == -1:
        return None
    content_start = start + len(open_tag)
    end = text.find(close_tag, content_start)
    if end == -1:
        return None
    return text[content_start:end]


def _is_valid_translation(content: str) -> bool:
    """Lightweight validation of a single marker's extracted content.

    Checks that the content is non-empty (after stripping whitespace) and
    that it doesn't still contain the literal marker bracket characters
    (which would indicate the LLM mangled/translated the marker syntax
    itself rather than leaving it as a delimiter).
    """
    if not content.strip():
        return False
    if "⟦" in content or "⟧" in content:
        return False
    return True


def _build_glossary_block(marked_source: str, glossary: list[GlossaryEntry]) -> str:
    """Build the glossary injection block for terms that actually appear in
    `marked_source` (simple substring containment check, per SCRATCH.md §5).

    Returns an empty string if no glossary entries are hit.
    """
    hits = [entry for entry in glossary if entry.term in marked_source]
    if not hits:
        return ""

    lines = ["以下术语在本文翻译时必须遵循对照表："]
    for entry in hits:
        if entry.translation is None:
            lines.append(f"- {entry.term} -> 保留英文原文不译")
        else:
            lines.append(f"- {entry.term} -> {entry.translation}")
    return "\n".join(lines)


class BaseTranslator(ABC):
    """Abstract base class for LLM-backed translators.

    Subclasses implement `translate_raw`, a single synchronous LLM call
    that takes a fully-assembled prompt string and returns the raw response
    text. All retry, validation, glossary-injection, and marker-level
    fallback logic lives here so it is shared across providers.
    """

    #: Maximum number of attempts (including the first) for `_call_with_retry`.
    MAX_RETRIES = 3
    #: Base delay (seconds) for exponential backoff between retries.
    RETRY_BASE_DELAY = 1.0

    @abstractmethod
    def translate_raw(self, prompt: str) -> str:
        """Perform a single LLM call with `prompt` and return the raw text
        response. Implementations should raise `RateLimitError` when the
        underlying API signals rate-limiting/429, so that `_call_with_retry`
        can retry with backoff. Any per-call timeout should be enforced by
        the provider's own SDK client configuration (e.g. an `httpx`/SDK
        `timeout` parameter of 30s), not by this method's caller.
        """
        raise NotImplementedError

    def _call_with_retry(self, fn: Callable[[], str]) -> str:
        """Call `fn` (typically `lambda: self.translate_raw(prompt)`),
        retrying with exponential backoff on `RateLimitError` up to
        `MAX_RETRIES` attempts total. Raises `TranslationError` once
        retries are exhausted.
        """
        last_error: Exception | None = None
        for attempt in range(self.MAX_RETRIES):
            try:
                return fn()
            except RateLimitError as exc:
                last_error = exc
                if attempt < self.MAX_RETRIES - 1:
                    delay = self.RETRY_BASE_DELAY * (2**attempt)
                    logger.warning(
                        "Rate limited (attempt %d/%d), retrying in %.1fs",
                        attempt + 1,
                        self.MAX_RETRIES,
                        delay,
                    )
                    time.sleep(delay)
        raise TranslationError(
            f"Translation failed after {self.MAX_RETRIES} attempts due to rate limiting"
        ) from last_error

    def translate_file(self, marked_source: str, glossary: list[GlossaryEntry]) -> str:
        """Translate a fully marker-embedded Markdown source string.

        See module docstring for the `⟦n⟧...⟦/n⟧` marker protocol. Returns
        a marker-embedded translated string with the same set of marker ids
        as the input, suitable for `markdown_parser.splice`-style
        reassembly. Marker ids that cannot be translated successfully
        (after a per-id fallback retry) keep their *original* (untranslated)
        content rather than blocking the rest of the file.
        """
        expected_ids = sorted(_parse_marker_ids(marked_source).keys())
        if not expected_ids:
            return marked_source

        glossary_block = _build_glossary_block(marked_source, glossary)
        prompt_parts = [SYSTEM_PROMPT]
        if glossary_block:
            prompt_parts.append(glossary_block)
        prompt_parts.append(marked_source)
        prompt = "\n\n".join(prompt_parts)

        try:
            translated = self._call_with_retry(lambda: self.translate_raw(prompt))
        except TranslationError:
            logger.warning(
                "Full-file translation failed; falling back to per-marker retry for all %d markers",
                len(expected_ids),
            )
            translated = ""

        result_pieces: dict[int, str] = {}
        failed_ids: list[int] = []

        marker_status = _parse_marker_ids(translated) if translated else {}
        for marker_id in expected_ids:
            if not marker_status.get(marker_id, False):
                failed_ids.append(marker_id)
                continue
            content = _extract_marker_content(translated, marker_id)
            if content is None or not _is_valid_translation(content):
                failed_ids.append(marker_id)
                continue
            result_pieces[marker_id] = content

        for marker_id in failed_ids:
            original_content = _extract_marker_content(marked_source, marker_id)
            if original_content is None:
                # Should not happen since marker_id came from expected_ids,
                # but guard defensively: nothing sensible to splice in.
                continue
            fallback_content = self._fallback_translate_marker(marker_id, original_content)
            if fallback_content is not None:
                result_pieces[marker_id] = fallback_content
            else:
                # Keep original content untranslated (design.md §5.3).
                result_pieces[marker_id] = original_content

        return _splice_markers(expected_ids, result_pieces)

    def _fallback_translate_marker(self, marker_id: int, original_content: str) -> str | None:
        """Attempt a single isolated retranslation of one marker's content.

        Wraps `original_content` back in its own marker pair and sends a
        stricter single-paragraph prompt. Returns the validated translated
        content on success, or None if the fallback itself fails validation
        or raises `TranslationError` (caller falls back to original text).
        """
        wrapped = f"⟦{marker_id}⟧{original_content}⟦/{marker_id}⟧"
        fallback_prompt = (
            f"{SYSTEM_PROMPT}\n\n"
            "只翻译以下这一段文字，保留所有格式符号、标记符号（包括 ⟦ ⟧ 及其中的数字）不变：\n\n"
            f"{wrapped}"
        )
        try:
            response = self._call_with_retry(lambda: self.translate_raw(fallback_prompt))
        except TranslationError:
            return None

        status = _parse_marker_ids(response)
        if not status.get(marker_id, False):
            return None
        content = _extract_marker_content(response, marker_id)
        if content is None or not _is_valid_translation(content):
            return None
        return content


def _splice_markers(expected_ids: list[int], pieces: dict[int, str]) -> str:
    """Assemble a marker-embedded string from per-id translated content.

    Output format matches the input marker protocol so it round-trips
    through `markdown_parser`'s (Phase 3) marker extraction.
    """
    parts: list[str] = []
    for marker_id in expected_ids:
        content = pieces.get(marker_id, "")
        parts.append(f"⟦{marker_id}⟧{content}⟦/{marker_id}⟧")
    return "".join(parts)
