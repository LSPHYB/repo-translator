"""Tests for repo_translator.translator.base — BaseTranslator.translate_file.

Uses a fake BaseTranslator subclass (`translate_raw` returns a preset
string / consults a queue of canned responses) so no real LLM API calls are
made.
"""

from __future__ import annotations

import pytest

from repo_translator.config import GlossaryEntry
from repo_translator.translator.base import (
    BaseTranslator,
    RateLimitError,
    SYSTEM_PROMPT,
    TranslationError,
)


class FakeTranslator(BaseTranslator):
    """A BaseTranslator whose `translate_raw` returns queued canned
    responses (or, if the queue is exhausted, a single fixed response).

    Every call (including its prompt) is recorded in `self.calls` for
    assertions.
    """

    def __init__(self, responses: list[str] | None = None) -> None:
        self.responses: list[str] = list(responses) if responses else []
        self.calls: list[str] = []

    def translate_raw(self, prompt: str) -> str:
        self.calls.append(prompt)
        if self.responses:
            return self.responses.pop(0)
        return ""


class RaisingTranslator(BaseTranslator):
    """A BaseTranslator whose `translate_raw` always raises RateLimitError."""

    def __init__(self) -> None:
        self.calls = 0

    def translate_raw(self, prompt: str) -> str:
        self.calls += 1
        raise RateLimitError("rate limited")


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_translate_file_happy_path_returns_translated_markers() -> None:
    marked_source = "⟦0⟧Hello⟦/0⟧ world ⟦1⟧Goodbye⟦/1⟧"
    translator = FakeTranslator(responses=["⟦0⟧你好⟦/0⟧ world ⟦1⟧再见⟦/1⟧"])

    result = translator.translate_file(marked_source, glossary=[])

    assert result == "⟦0⟧你好⟦/0⟧⟦1⟧再见⟦/1⟧"
    # Only the single full-file call was made; no fallback needed.
    assert len(translator.calls) == 1


def test_translate_file_with_no_markers_returns_source_unchanged() -> None:
    marked_source = "plain text with no markers at all"
    translator = FakeTranslator(responses=["should not be used"])

    result = translator.translate_file(marked_source, glossary=[])

    assert result == marked_source
    assert translator.calls == []  # translate_raw never invoked


def test_translate_file_preserves_marker_ordering() -> None:
    marked_source = "⟦0⟧A⟦/0⟧ x ⟦1⟧B⟦/1⟧ y ⟦2⟧C⟦/2⟧"
    translator = FakeTranslator(responses=["⟦2⟧C2⟦/2⟧ ⟦0⟧A2⟦/0⟧ ⟦1⟧B2⟦/1⟧"])

    result = translator.translate_file(marked_source, glossary=[])

    # Output order follows the *input* marker id order (0, 1, 2), not the
    # order they happened to appear in the LLM response.
    assert result == "⟦0⟧A2⟦/0⟧⟦1⟧B2⟦/1⟧⟦2⟧C2⟦/2⟧"


# ---------------------------------------------------------------------------
# Missing / malformed marker -> per-id fallback
# ---------------------------------------------------------------------------


def test_translate_file_missing_marker_triggers_single_fallback_call() -> None:
    marked_source = "⟦0⟧Hello⟦/0⟧ ⟦1⟧Goodbye⟦/1⟧"
    # First (full-file) response is missing marker 1 entirely.
    first_response = "⟦0⟧你好⟦/0⟧"
    # Fallback response for marker 1 only.
    fallback_response = "⟦1⟧再见⟦/1⟧"
    translator = FakeTranslator(responses=[first_response, fallback_response])

    result = translator.translate_file(marked_source, glossary=[])

    assert result == "⟦0⟧你好⟦/0⟧⟦1⟧再见⟦/1⟧"
    # Exactly one extra call (the fallback) beyond the initial full-file call.
    assert len(translator.calls) == 2
    # The fallback prompt should only reference the failed marker's content,
    # not the marker that already succeeded.
    fallback_prompt = translator.calls[1]
    assert "⟦1⟧Goodbye⟦/1⟧" in fallback_prompt
    assert "Hello" not in fallback_prompt


def test_translate_file_only_failed_id_is_retried_others_untouched() -> None:
    marked_source = "⟦0⟧A⟦/0⟧ ⟦1⟧B⟦/1⟧ ⟦2⟧C⟦/2⟧"
    # marker 1 is missing from the full-file response; 0 and 2 succeed.
    first_response = "⟦0⟧A2⟦/0⟧ ⟦2⟧C2⟦/2⟧"
    fallback_response = "⟦1⟧B2⟦/1⟧"
    translator = FakeTranslator(responses=[first_response, fallback_response])

    result = translator.translate_file(marked_source, glossary=[])

    assert result == "⟦0⟧A2⟦/0⟧⟦1⟧B2⟦/1⟧⟦2⟧C2⟦/2⟧"
    assert len(translator.calls) == 2  # 1 full-file + 1 fallback (only for id 1)


def test_translate_file_empty_marker_content_triggers_fallback() -> None:
    marked_source = "⟦0⟧Hello⟦/0⟧"
    # Marker present but content is empty/whitespace -> invalid.
    first_response = "⟦0⟧   ⟦/0⟧"
    fallback_response = "⟦0⟧你好⟦/0⟧"
    translator = FakeTranslator(responses=[first_response, fallback_response])

    result = translator.translate_file(marked_source, glossary=[])

    assert result == "⟦0⟧你好⟦/0⟧"
    assert len(translator.calls) == 2


def test_translate_file_marker_symbols_translated_away_triggers_fallback() -> None:
    marked_source = "⟦0⟧Hello⟦/0⟧"
    # LLM mangled the marker brackets themselves inside the content.
    first_response = "⟦0⟧你好⟦bracket⟧⟦/0⟧"
    fallback_response = "⟦0⟧你好⟦/0⟧"
    translator = FakeTranslator(responses=[first_response, fallback_response])

    result = translator.translate_file(marked_source, glossary=[])

    assert result == "⟦0⟧你好⟦/0⟧"
    assert len(translator.calls) == 2


def test_translate_file_fallback_failure_keeps_original_content() -> None:
    marked_source = "⟦0⟧Hello⟦/0⟧ ⟦1⟧Goodbye⟦/1⟧"
    first_response = "⟦0⟧你好⟦/0⟧"  # marker 1 missing
    fallback_response = ""  # fallback also fails to produce marker 1
    translator = FakeTranslator(responses=[first_response, fallback_response])

    result = translator.translate_file(marked_source, glossary=[])

    # Marker 1 keeps its original (untranslated) content.
    assert result == "⟦0⟧你好⟦/0⟧⟦1⟧Goodbye⟦/1⟧"
    assert len(translator.calls) == 2


def test_translate_file_full_call_translation_error_falls_back_per_marker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(BaseTranslator, "RETRY_BASE_DELAY", 0.0)
    marked_source = "⟦0⟧Hello⟦/0⟧ ⟦1⟧Goodbye⟦/1⟧"
    translator = RaisingTranslator()

    result = translator.translate_file(marked_source, glossary=[])

    # Both markers fail entirely (full call + fallback all rate-limited) ->
    # original content preserved for both, nothing raised to the caller.
    assert result == "⟦0⟧Hello⟦/0⟧⟦1⟧Goodbye⟦/1⟧"


def test_call_with_retry_raises_translation_error_after_exhausting_retries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(BaseTranslator, "RETRY_BASE_DELAY", 0.0)
    translator = RaisingTranslator()

    with pytest.raises(TranslationError):
        translator._call_with_retry(lambda: translator.translate_raw("prompt"))

    assert translator.calls == BaseTranslator.MAX_RETRIES


def test_call_with_retry_succeeds_after_transient_rate_limit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(BaseTranslator, "RETRY_BASE_DELAY", 0.0)
    calls = {"count": 0}

    class FlakyTranslator(BaseTranslator):
        def translate_raw(self, prompt: str) -> str:
            calls["count"] += 1
            if calls["count"] < 2:
                raise RateLimitError("rate limited")
            return "ok"

    translator = FlakyTranslator()
    result = translator._call_with_retry(lambda: translator.translate_raw("prompt"))

    assert result == "ok"
    assert calls["count"] == 2


# ---------------------------------------------------------------------------
# Glossary injection
# ---------------------------------------------------------------------------


def test_translate_file_glossary_hit_is_injected_into_prompt() -> None:
    marked_source = "⟦0⟧Agent uses LangChain⟦/0⟧"
    glossary = [
        GlossaryEntry(term="Agent", translation="智能体"),
        GlossaryEntry(term="LangChain", translation=None),
        GlossaryEntry(term="NotPresentTerm", translation="不出现"),
    ]
    translator = FakeTranslator(responses=["⟦0⟧智能体使用 LangChain⟦/0⟧"])

    translator.translate_file(marked_source, glossary=glossary)

    prompt = translator.calls[0]
    assert "Agent -> 智能体" in prompt
    assert "LangChain -> 保留英文原文不译" in prompt
    assert "NotPresentTerm" not in prompt


def test_translate_file_no_glossary_hit_omits_glossary_block() -> None:
    marked_source = "⟦0⟧Hello world⟦/0⟧"
    glossary = [GlossaryEntry(term="Agent", translation="智能体")]
    translator = FakeTranslator(responses=["⟦0⟧你好世界⟦/0⟧"])

    translator.translate_file(marked_source, glossary=glossary)

    prompt = translator.calls[0]
    assert "Agent" not in prompt
    assert "对照表" not in prompt


def test_translate_file_empty_glossary_list_omits_glossary_block() -> None:
    marked_source = "⟦0⟧Hello world⟦/0⟧"
    translator = FakeTranslator(responses=["⟦0⟧你好世界⟦/0⟧"])

    translator.translate_file(marked_source, glossary=[])

    prompt = translator.calls[0]
    assert "对照表" not in prompt


def test_translate_file_prompt_includes_system_prompt_and_source() -> None:
    marked_source = "⟦0⟧Hello⟦/0⟧"
    translator = FakeTranslator(responses=["⟦0⟧你好⟦/0⟧"])

    translator.translate_file(marked_source, glossary=[])

    prompt = translator.calls[0]
    assert SYSTEM_PROMPT in prompt
    assert marked_source in prompt
