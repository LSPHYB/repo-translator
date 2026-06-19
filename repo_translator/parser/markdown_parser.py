"""Markdown block splitting, marker embedding/extraction, and source-slice reassembly.

Core design principle (see SCRATCH.md, decision 1 and 4.1): this module never
re-serializes or re-renders a Markdown AST back into text. All operations are
line-range slicing and string concatenation performed directly on the
*original source text*. We use markdown-it-py purely to discover, for each
top-level structural block, the ``[start_line, end_line)`` range it spans in
the source -- via each token's ``.map`` attribute -- and then index into the
source's own lines to build the output. No ``MarkdownIt.render*`` call is
ever made.

Pipeline:

1. :func:`parse_blocks` -- parse source with markdown-it-py (GFM tables,
   task lists, footnotes enabled) and walk the *top-level* token stream,
   turning each top-level block-level token (and, for structural wrapper
   tokens without their own ``.map`` such as footnote containers, the
   first mapped descendant found) into one :class:`Block`. A hand-rolled
   line-scan detects a leading YAML frontmatter block (markdown-it-py does
   not recognize frontmatter out of the box) and marks it non-translatable.
2. :func:`embed_markers` -- wraps each translatable block's source slice
   with ``⟦n⟧`` / ``⟦/n⟧`` markers (n = 0-based index in
   *document order* among translatable blocks only).
3. :func:`extract_translations` -- scans an LLM response for
   ``⟦n⟧...⟦/n⟧`` marker pairs and returns ``{n: text}``.
4. :func:`splice` -- given the *original* (unmarked) source, the block list,
   and a ``{id: translated_text}`` mapping, replaces each translated,
   translatable block's source slice with its translation; every other
   block (non-translatable, or translatable but missing from the mapping)
   is kept byte-for-byte as in the original source.

:func:`protect_inline` / :func:`restore_inline` implement the inline-level
fallback path (SCRATCH.md decision 1.1): replacing inline code spans and
link/image URLs with ``⟦CODE_n⟧`` placeholders so a paragraph can be
retranslated with those spans 100% protected, when the default
prompt-constraint approach fails post-translation validation (handled by the
Phase 4 Translator).
"""

from __future__ import annotations

import re

from markdown_it import MarkdownIt
from mdit_py_plugins.footnote import footnote_plugin
from mdit_py_plugins.tasklists import tasklists_plugin

from repo_translator.parser.block import Block

# Marker delimiters for block-level translation markers, e.g. "⟦0⟧...⟦/0⟧".
# U+27E6 MATHEMATICAL LEFT WHITE SQUARE BRACKET / U+27E7 ...RIGHT...
# Chosen because they essentially never occur in real-world Markdown/HTML,
# unlike plain "[" "]".
MARKER_OPEN = "⟦"
MARKER_CLOSE = "⟧"

_MARKER_RE = re.compile(
    rf"{re.escape(MARKER_OPEN)}(\d+){re.escape(MARKER_CLOSE)}"
    rf"(.*?)"
    rf"{re.escape(MARKER_OPEN)}/(\d+){re.escape(MARKER_CLOSE)}",
    re.DOTALL,
)

# Matches an inline code span as group "code", or a link/image's URL
# portion as group "url" (its surrounding "[text](" / ")" stay outside the
# captured group so link/alt text remains translatable). Combined into one
# alternation so a single left-to-right scan numbers placeholders in
# appearance order, regardless of which kind of span is matched.
_PROTECTABLE_RE = re.compile(
    r"(?P<code>`[^`\n]+`)"
    r"|(?:!?\[[^\]\n]*\]\((?P<url>[^()\n]*)\))"
)


def _build_md() -> MarkdownIt:
    """Construct the markdown-it-py parser with the GFM extensions we need."""
    md = MarkdownIt("commonmark").enable("table")
    md.use(tasklists_plugin)
    md.use(footnote_plugin)
    return md


def _detect_frontmatter(lines: list[str]) -> int | None:
    """Detect a leading YAML frontmatter block.

    markdown-it-py (even with the GFM extensions we enable) does not treat
    a leading ``---`` ... ``---`` block specially, so we hand-roll a simple
    line-scan: the document must *start* with a line that is exactly ``---``,
    and there must be a later line that is exactly ``---`` (or ``...``, the
    YAML "end of document" marker) terminating it.

    To avoid false positives on documents that start with a ``---`` separator
    line followed by prose and another ``---`` (a common README / doc
    template pattern), the content between the delimiters must survive a
    lightweight YAML-likeness check before the block is accepted as frontmatter.

    Returns the 0-based index of the closing delimiter line (inclusive of the
    frontmatter), or ``None`` if no frontmatter block is present.
    """
    if not lines or lines[0].strip() != "---":
        return None
    for i in range(1, len(lines)):
        if lines[i].strip() in ("---", "..."):
            # Validate content between delimiters looks YAML-like
            # to avoid treating prose/text between two --- lines as frontmatter.
            if _content_looks_like_frontmatter(lines[1:i]):
                return i
            # Otherwise keep scanning: the first --- may be a horizontal rule
            # and a later ---/... may be the actual frontmatter closer.
    return None


def _content_looks_like_frontmatter(content_lines: list[str]) -> bool:
    """Lightweight heuristic: every non-empty line must match a YAML key: value pattern.

    A line is considered YAML-like if it starts with optional whitespace
    followed by a word-based key and a colon-separated value (``key: value``).
    Empty lines and comment lines (``#``) are allowed anywhere.
    """
    if not content_lines or all(line.strip() == "" for line in content_lines):
        return True  # empty frontmatter (---\\n---) is valid
    yaml_key_re = re.compile(r"^\s*\w[\w\s.-]*: ")
    for line in content_lines:
        stripped = line.strip()
        if stripped == "" or stripped.startswith("#"):
            continue
        if not yaml_key_re.match(stripped):
            return False
    return True


def parse_blocks(source: str) -> list[Block]:
    """Split ``source`` into a list of :class:`Block` covering the whole document.

    Uses markdown-it-py token ``.map`` ranges to find block boundaries
    without ever re-rendering the document. The returned blocks are sorted
    in document order; gaps in source coverage (e.g. link reference
    definitions, which markdown-it-py consumes without emitting a token) are
    *not* represented as blocks -- callers reconstruct the full document by
    iterating line-by-line and falling back to verbatim lines for any range
    not covered by a block (see :func:`embed_markers` / :func:`splice`).
    """
    lines = source.split("\n")
    blocks: list[Block] = []

    frontmatter_end = _detect_frontmatter(lines)
    body_start_line = 0
    if frontmatter_end is not None:
        blocks.append(
            Block(
                type="frontmatter",
                start_line=0,
                end_line=frontmatter_end + 1,
                translatable=False,
            )
        )
        body_start_line = frontmatter_end + 1

    md = _build_md()
    tokens = md.parse(source)

    i = 0
    n = len(tokens)
    while i < n:
        tok = tokens[i]

        # Only consider tokens that open or self-close a *block*-level
        # construct. Inline tokens and closing tokens are skipped here;
        # closing tokens are consumed via the skip-to-match logic below.
        if tok.nesting == -1:
            i += 1
            continue

        if tok.map is not None:
            start, end = tok.map
            if start >= body_start_line:
                blocks.append(
                    Block(
                        type=_block_type(tok),
                        start_line=start,
                        end_line=end,
                        translatable=_is_translatable(tok),
                    )
                )
            if tok.nesting == 1:
                # Opening token whose .map already spans its entire
                # subtree (e.g. table_open, bullet_list_open,
                # paragraph_open). Skip past the matching close so we
                # don't also emit Blocks for its children.
                i = _skip_to_close(tokens, i)
                continue
            i += 1
            continue

        # tok.map is None: either a structural wrapper with no source range
        # of its own (e.g. footnote_open, footnote_block_open, thead_open,
        # tr_open, th_open) or a closing token. Descend into children by
        # simply continuing to the next token -- its mapped descendants
        # (if any) will be picked up on subsequent iterations.
        i += 1

    blocks.sort(key=lambda b: b.start_line)
    return blocks


def _skip_to_close(tokens: list, open_index: int) -> int:
    """Return the index just past the token matching ``tokens[open_index]``'s close."""
    depth = 1
    j = open_index + 1
    n = len(tokens)
    while j < n and depth > 0:
        nesting = tokens[j].nesting
        if nesting == 1:
            depth += 1
        elif nesting == -1:
            depth -= 1
        j += 1
    return j


_NON_TRANSLATABLE_TYPES = {"fence", "code_block", "html_block", "hr"}


def _is_translatable(tok) -> bool:
    return tok.type not in _NON_TRANSLATABLE_TYPES


def _block_type(tok) -> str:
    mapping = {
        "heading_open": "heading",
        "paragraph_open": "text",
        "table_open": "table",
        "bullet_list_open": "list",
        "ordered_list_open": "list",
        "blockquote_open": "text",
        "fence": "code",
        "code_block": "code",
        "html_block": "html",
        "hr": "hr",
    }
    if tok.type in mapping:
        return mapping[tok.type]
    return tok.type.removesuffix("_open")


def embed_markers(source: str, blocks: list[Block]) -> str:
    """Wrap each translatable block's source slice with ``⟦n⟧`` / ``⟦/n⟧`` markers.

    ``n`` is the 0-based index of the block among *translatable* blocks
    only, assigned in document order (non-translatable blocks do not
    consume an id). Implemented entirely via line-range slicing of
    ``source`` and string concatenation -- the document is never
    re-rendered.
    """
    lines = source.split("\n")
    out_lines: list[str] = []
    cursor = 0
    marker_id = 0

    for block in sorted(blocks, key=lambda b: b.start_line):
        # Preserve any unmapped gap verbatim (e.g. link reference defs).
        if block.start_line > cursor:
            out_lines.extend(lines[cursor : block.start_line])

        segment = lines[block.start_line : block.end_line]
        if block.translatable and segment:
            segment = list(segment)
            segment[0] = f"{MARKER_OPEN}{marker_id}{MARKER_CLOSE}" + segment[0]
            segment[-1] = segment[-1] + f"{MARKER_OPEN}/{marker_id}{MARKER_CLOSE}"
            marker_id += 1
        out_lines.extend(segment)
        cursor = block.end_line

    if cursor < len(lines):
        out_lines.extend(lines[cursor:])

    return "\n".join(out_lines)


def extract_translations(translated_source: str) -> dict[int, str]:
    """Extract ``{marker_id: translated_text}`` from a marked-up LLM response.

    Scans for ``⟦n⟧...⟦/n⟧`` pairs (markers may span multiple
    lines). If the same id appears more than once, the last occurrence wins.
    """
    result: dict[int, str] = {}
    for match in _MARKER_RE.finditer(translated_source):
        open_id, text, close_id = match.group(1), match.group(2), match.group(3)
        if open_id != close_id:
            # Mismatched marker pair (e.g. truncated/garbled response) --
            # skip rather than guess.
            continue
        result[int(open_id)] = text
    return result


def splice(
    original_source: str, blocks: list[Block], translations: dict[int, str]
) -> str:
    """Replace translated blocks' source slices with their translations.

    ``original_source`` must be the *unmarked* original document text.
    Blocks that are non-translatable, or translatable but absent from
    ``translations``, are copied verbatim from ``original_source``. Pure
    string slicing/concatenation only -- no re-rendering.
    """
    lines = original_source.split("\n")
    out_lines: list[str] = []
    cursor = 0
    marker_id = 0

    for block in sorted(blocks, key=lambda b: b.start_line):
        if block.start_line > cursor:
            out_lines.extend(lines[cursor : block.start_line])

        if block.translatable:
            this_id = marker_id
            marker_id += 1
            if this_id in translations:
                out_lines.append(translations[this_id])
            else:
                out_lines.extend(lines[block.start_line : block.end_line])
        else:
            out_lines.extend(lines[block.start_line : block.end_line])

        cursor = block.end_line

    if cursor < len(lines):
        out_lines.extend(lines[cursor:])

    return "\n".join(out_lines)


def protect_inline(text: str) -> tuple[str, dict[str, str]]:
    """Replace inline code spans and link/image URLs with placeholders.

    Returns ``(protected_text, placeholders)`` where ``placeholders`` maps
    each ``⟦CODE_n⟧`` placeholder (n 0-based, in order of appearance
    within ``text``) back to the original substring it replaced. For a
    link ``[text](url)`` or image ``![alt](url)``, only the ``url`` portion
    is protected -- the link/alt text remains translatable.
    """
    placeholders: dict[str, str] = {}
    counter = 0
    out_parts: list[str] = []
    cursor = 0
    i = 0
    n = len(text)

    while i < n:
        # --- Inline code span (backtick string per CommonMark) ---
        if text[i] == "`" and (i == 0 or text[i - 1] != "`"):
            # Count consecutive backticks forming the opening delimiter run.
            j = i
            while j < n and text[j] == "`":
                j += 1
            run_len = j - i

            # Search for a matching closing backtick run of the same length.
            # It must not be adjacent to another backtick on either side.
            close_at = _find_matching_backtick_run(text, j, run_len)
            if close_at != -1 and close_at > j:
                out_parts.append(text[cursor:i])
                code_span = text[i : close_at + run_len]
                key = f"{MARKER_OPEN}CODE_{counter}{MARKER_CLOSE}"
                counter += 1
                placeholders[key] = code_span
                out_parts.append(key)
                cursor = close_at + run_len
                i = cursor
                continue
            else:
                i = j  # skip the backtick run (unmatched opening)
                continue

        # --- Image: ![alt](url) ---
        if text[i] == "!" and i + 1 < n and text[i + 1] == "[":
            bracket_close = _find_link_bracket_close(text, i + 2)
            if (
                bracket_close != -1
                and bracket_close + 1 < n
                and text[bracket_close + 1] == "("
            ):
                url_start = bracket_close + 2
                url_end = _find_paren_close(text, url_start)
                if url_end != -1:
                    out_parts.append(text[cursor:i])
                    key = f"{MARKER_OPEN}CODE_{counter}{MARKER_CLOSE}"
                    counter += 1
                    url = text[url_start:url_end]
                    placeholders[key] = url
                    # Keep surrounding markup (![...](...)) intact; only the
                    # URL itself is replaced by a placeholder.
                    out_parts.append(text[i:url_start])  # ![alt](
                    out_parts.append(key)
                    out_parts.append(text[url_end : url_end + 1])  # )
                    cursor = url_end + 1
                    i = cursor
                    continue

        # --- Link: [text](url) ---
        if text[i] == "[":
            bracket_close = _find_link_bracket_close(text, i + 1)
            if (
                bracket_close != -1
                and bracket_close + 1 < n
                and text[bracket_close + 1] == "("
            ):
                url_start = bracket_close + 2
                url_end = _find_paren_close(text, url_start)
                if url_end != -1:
                    out_parts.append(text[cursor:i])
                    key = f"{MARKER_OPEN}CODE_{counter}{MARKER_CLOSE}"
                    counter += 1
                    url = text[url_start:url_end]
                    placeholders[key] = url
                    out_parts.append(text[i:url_start])  # [text](
                    out_parts.append(key)
                    out_parts.append(text[url_end : url_end + 1])  # )
                    cursor = url_end + 1
                    i = cursor
                    continue

        i += 1

    out_parts.append(text[cursor:])
    return "".join(out_parts), placeholders


def _find_matching_backtick_run(text: str, start: int, run_len: int) -> int:
    """Find a closing backtick run of *run_len* length at or after *start*.

    The closing run must not be adjacent to another backtick (i.e. it must
    be a standalone backtick string, not part of a longer run). Returns the
    start index of the closing run, or -1 if not found.
    """
    n = len(text)
    needle = "`" * run_len
    search = start
    while search < n:
        pos = text.find(needle, search)
        if pos == -1:
            break
        # Reject if adjacent to another backtick (part of a longer run).
        if pos + run_len < n and text[pos + run_len] == "`":
            search = pos + run_len + 1
            continue
        if pos > 0 and text[pos - 1] == "`":
            search = pos + run_len
            continue
        return pos
    return -1


def _find_link_bracket_close(text: str, start: int) -> int:
    """Find the closing ``]`` for a link label that begins at *start*.

    Skips escaped brackets ``\\]`` and stops at newline (inline links cannot
    span lines in standard Markdown). Returns the index of ``]`` or -1.
    """
    n = len(text)
    i = start
    while i < n:
        ch = text[i]
        if ch == "\\" and i + 1 < n:
            i += 2  # skip escaped character
            continue
        if ch == "\n":
            return -1
        if ch == "]":
            return i
        i += 1
    return -1


def _find_paren_close(text: str, start: int) -> int:
    """Find the closing ``)`` using balanced-parenthesis counting.

    Starts at *start* (just after the opening ``(``) with depth 1.
    Handles escaped parens ``\\(`` / ``\\)``. Stops at newline.
    Returns the index of the matching ``)`` or -1.
    """
    n = len(text)
    depth = 1
    i = start
    while i < n:
        ch = text[i]
        if ch == "\\" and i + 1 < n:
            i += 2
            continue
        if ch == "\n":
            return -1
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def restore_inline(text: str, placeholders: dict[str, str]) -> str:
    """Inverse of :func:`protect_inline`: substitute placeholders back to originals."""
    result = text
    for placeholder, original in placeholders.items():
        result = result.replace(placeholder, original)
    return result
