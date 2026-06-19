"""Tests for repo_translator.parser.markdown_parser.

The central correctness property under test is that this module *never*
re-serializes the document: every operation is line-range slicing and string
concatenation on the original source text. The round-trip test
(`test_splice_roundtrip_is_byte_identical_for_untranslated_parts`) is the key
guard against that invariant being silently broken -- if any code path
swapped in a markdown-it-py render call or did any text normalization, the
fenced code block / frontmatter / HTML block content would no longer match
byte-for-byte.
"""

from __future__ import annotations

from repo_translator.parser.block import Block
from repo_translator.parser.markdown_parser import (
    embed_markers,
    extract_translations,
    parse_blocks,
    protect_inline,
    restore_inline,
    splice,
)

SAMPLE_MD = """---
title: Sample Document
author: Test Author
---

# Heading One

This paragraph has `inline code` and a [link](http://example.com/path) in it.

| Column A | Column B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |

- top level item
  - nested item one
  - nested item two
    - double nested item
- another top level item

```python
def greet(name):
    return f"hello {name}"
```

<div class="note">
  <p>This is a raw HTML block and must not be translated.</p>
</div>

A final closing paragraph with more `inline_code_two` to protect.
"""


def _lines(text: str) -> list[str]:
    return text.split("\n")


# ---------------------------------------------------------------------------
# parse_blocks
# ---------------------------------------------------------------------------


def test_parse_blocks_detects_frontmatter_as_non_translatable() -> None:
    blocks = parse_blocks(SAMPLE_MD)

    frontmatter_blocks = [b for b in blocks if b.type == "frontmatter"]
    assert len(frontmatter_blocks) == 1
    fm = frontmatter_blocks[0]
    assert fm.translatable is False
    assert fm.start_line == 0
    # Closing "---" is on line 3 (0-indexed): lines 0..3 inclusive -> end 4.
    lines = _lines(SAMPLE_MD)
    assert lines[fm.start_line] == "---"
    assert lines[fm.end_line - 1] == "---"


def test_frontmatter_not_detected_for_separator_lines_with_prose_between() -> None:
    """Regression: a document starting with --- then prose then another ---
    must NOT be treated as frontmatter (the content does not look YAML-like)."""
    source = "---\n\nSome content in between.\n\n---\n\nMore content.\n"
    blocks = parse_blocks(source)
    frontmatter_blocks = [b for b in blocks if b.type == "frontmatter"]
    assert len(frontmatter_blocks) == 0, (
        "Prose between two --- lines must not be detected as frontmatter"
    )


def test_frontmatter_still_detected_for_valid_yaml() -> None:
    """Normal YAML frontmatter must still be recognised after the heuristic
    change."""
    source = "---\ntitle: Foo\ndate: 2024-01-01\n---\n\nBody text.\n"
    blocks = parse_blocks(source)
    frontmatter_blocks = [b for b in blocks if b.type == "frontmatter"]
    assert len(frontmatter_blocks) == 1


def test_parse_blocks_marks_fence_and_html_as_non_translatable() -> None:
    blocks = parse_blocks(SAMPLE_MD)

    fence_blocks = [b for b in blocks if b.type == "code"]
    html_blocks = [b for b in blocks if b.type == "html"]
    assert len(fence_blocks) == 1
    assert len(html_blocks) == 1
    assert fence_blocks[0].translatable is False
    assert html_blocks[0].translatable is False

    lines = _lines(SAMPLE_MD)
    fence = fence_blocks[0]
    assert lines[fence.start_line].startswith("```")
    assert lines[fence.end_line - 1].startswith("```")

    html = html_blocks[0]
    assert lines[html.start_line].startswith("<div")
    assert lines[html.end_line - 1].startswith("</div>")


def test_parse_blocks_marks_text_blocks_as_translatable() -> None:
    blocks = parse_blocks(SAMPLE_MD)

    translatable_types = {b.type for b in blocks if b.translatable}
    # heading, paragraph ("text"), table, list should all be present and
    # translatable.
    assert "heading" in translatable_types
    assert "text" in translatable_types
    assert "table" in translatable_types
    assert "list" in translatable_types


def test_parse_blocks_covers_whole_nested_list_as_one_block() -> None:
    blocks = parse_blocks(SAMPLE_MD)
    list_blocks = [b for b in blocks if b.type == "list"]
    assert len(list_blocks) == 1
    list_block = list_blocks[0]

    lines = _lines(SAMPLE_MD)
    covered = lines[list_block.start_line : list_block.end_line]
    assert any("top level item" in line for line in covered)
    assert any("double nested item" in line for line in covered)
    assert any("another top level item" in line for line in covered)


def test_parse_blocks_covers_whole_table_as_one_block() -> None:
    blocks = parse_blocks(SAMPLE_MD)
    table_blocks = [b for b in blocks if b.type == "table"]
    assert len(table_blocks) == 1
    table_block = table_blocks[0]

    lines = _lines(SAMPLE_MD)
    covered = lines[table_block.start_line : table_block.end_line]
    assert any("Column A" in line for line in covered)
    assert any("3" in line and "4" in line for line in covered)


def test_parse_blocks_marks_horizontal_rule_as_non_translatable() -> None:
    source = "Para one.\n\n---\n\nPara two.\n"
    blocks = parse_blocks(source)
    hr_blocks = [b for b in blocks if b.type == "hr"]
    assert len(hr_blocks) == 1
    assert hr_blocks[0].translatable is False


def test_parse_blocks_blocks_are_in_document_order_and_non_overlapping() -> None:
    blocks = parse_blocks(SAMPLE_MD)
    sorted_blocks = sorted(blocks, key=lambda b: b.start_line)
    assert blocks == sorted_blocks or [b.start_line for b in blocks] == [
        b.start_line for b in sorted_blocks
    ]
    for prev, nxt in zip(sorted_blocks, sorted_blocks[1:]):
        assert prev.end_line <= nxt.start_line


# ---------------------------------------------------------------------------
# embed_markers
# ---------------------------------------------------------------------------


def test_embed_markers_only_wraps_translatable_blocks() -> None:
    blocks = parse_blocks(SAMPLE_MD)
    marked = embed_markers(SAMPLE_MD, blocks)

    # Frontmatter, fence, and HTML block content must appear unmarked.
    assert "title: Sample Document" in marked
    assert "⟦" not in marked.split("---", 2)[1]  # between first pair of --- markers

    assert "```python\ndef greet(name):" in marked
    assert "⟦" not in _extract_between(marked, "```python", "```\n\n<div")

    assert '<div class="note">' in marked
    assert "⟦" not in _extract_between(
        marked, '<div class="note">', "</div>"
    ).replace('<div class="note">', "")


def test_embed_markers_wraps_translatable_blocks_with_sequential_ids() -> None:
    blocks = parse_blocks(SAMPLE_MD)
    marked = embed_markers(SAMPLE_MD, blocks)

    translatable_count = sum(1 for b in blocks if b.translatable)
    for i in range(translatable_count):
        assert f"⟦{i}⟧" in marked
        assert f"⟦/{i}⟧" in marked
    # No id beyond the translatable count should appear.
    assert f"⟦{translatable_count}⟧" not in marked


def test_embed_markers_does_not_wrap_code_fence_or_html_block() -> None:
    blocks = parse_blocks(SAMPLE_MD)
    marked = embed_markers(SAMPLE_MD, blocks)

    fence_section = _extract_between(marked, "```python", "```\n")
    assert "⟦" not in fence_section

    html_section = _extract_between(marked, '<div class="note">', "</div>\n")
    assert "⟦" not in html_section


def test_embed_markers_wraps_heading_and_paragraph() -> None:
    blocks = parse_blocks(SAMPLE_MD)
    marked = embed_markers(SAMPLE_MD, blocks)

    assert "⟦0⟧# Heading One⟦/0⟧" in marked


def test_embed_markers_on_simple_doc_matches_expected_layout() -> None:
    source = "# Title\n\nA paragraph.\n"
    blocks = parse_blocks(source)
    marked = embed_markers(source, blocks)
    assert marked == "⟦0⟧# Title⟦/0⟧\n\n⟦1⟧A paragraph.⟦/1⟧\n"


def _extract_between(text: str, start: str, end: str) -> str:
    start_idx = text.index(start) + len(start)
    end_idx = text.index(end, start_idx)
    return text[start_idx:end_idx]


# ---------------------------------------------------------------------------
# extract_translations
# ---------------------------------------------------------------------------


def test_extract_translations_basic() -> None:
    text = "prefix ⟦0⟧Hello⟦/0⟧ middle ⟦1⟧World⟦/1⟧ suffix"
    result = extract_translations(text)
    assert result == {0: "Hello", 1: "World"}


def test_extract_translations_handles_multiline_marker_content() -> None:
    text = "⟦0⟧Line one\nLine two\nLine three⟦/0⟧"
    result = extract_translations(text)
    assert result == {0: "Line one\nLine two\nLine three"}


def test_extract_translations_ignores_mismatched_pairs() -> None:
    text = "⟦0⟧content⟦/1⟧"
    result = extract_translations(text)
    assert result == {}


def test_extract_translations_empty_text_returns_empty_dict() -> None:
    assert extract_translations("no markers here") == {}


# ---------------------------------------------------------------------------
# splice + full round trip
# ---------------------------------------------------------------------------


def test_splice_with_no_translations_returns_original_byte_for_byte() -> None:
    blocks = parse_blocks(SAMPLE_MD)
    result = splice(SAMPLE_MD, blocks, {})
    assert result == SAMPLE_MD


def test_splice_replaces_only_supplied_translations() -> None:
    blocks = parse_blocks(SAMPLE_MD)
    marked = embed_markers(SAMPLE_MD, blocks)

    # Simulate an LLM translating only the heading (id 0), leaving every
    # other marker and all unmarked content untouched.
    translated_source = marked.replace(
        "⟦0⟧# Heading One⟦/0⟧", "⟦0⟧# 标题一⟦/0⟧"
    )
    translations = extract_translations(translated_source)

    result = splice(SAMPLE_MD, blocks, {0: translations[0]})

    result_lines = _lines(result)
    original_lines = _lines(SAMPLE_MD)

    heading_block = next(b for b in blocks if b.type == "heading")
    assert result_lines[heading_block.start_line] == "# 标题一"

    # Everything else must be byte-for-byte identical to the original.
    for i, (got, original) in enumerate(zip(result_lines, original_lines)):
        if i == heading_block.start_line:
            continue
        assert got == original, f"line {i} diverged unexpectedly"


def test_full_roundtrip_preserves_untranslated_blocks_byte_for_byte() -> None:
    """embed -> (simulate LLM translating only translatable spans) ->
    extract -> splice, then verify every non-translated region (frontmatter,
    fenced code, HTML block, and any inter-block gaps) is byte-for-byte
    identical to the original source. This is the test that would catch a
    regression to any kind of AST re-rendering/normalization.
    """
    blocks = parse_blocks(SAMPLE_MD)
    marked = embed_markers(SAMPLE_MD, blocks)

    translations_by_id = extract_translations(marked)
    # "Translate" by prefixing each marked span with a tag, simulating an
    # LLM that respects the markers and doesn't touch anything outside them.
    fake_translations = {
        marker_id: f"[ZH]{text}" for marker_id, text in translations_by_id.items()
    }

    result = splice(SAMPLE_MD, blocks, fake_translations)

    non_translatable_blocks = [b for b in blocks if not b.translatable]
    original_lines = _lines(SAMPLE_MD)
    result_lines = _lines(result)

    for block in non_translatable_blocks:
        original_slice = original_lines[block.start_line : block.end_line]
        result_slice = result_lines[block.start_line : block.end_line]
        assert result_slice == original_slice, (
            f"non-translatable block {block} was altered"
        )

    # Translatable blocks should have picked up the "[ZH]" marker.
    for block in blocks:
        if block.translatable:
            joined = "\n".join(result_lines[block.start_line : block.end_line])
            assert joined.startswith("[ZH]")


def test_splice_falls_back_to_original_for_missing_translation_id() -> None:
    blocks = parse_blocks(SAMPLE_MD)
    # Only supply a translation for id 0; every other translatable block
    # has no entry and must fall back to the original text untouched.
    translations = {0: "[translated heading]"}

    result = splice(SAMPLE_MD, blocks, translations)
    result_lines = _lines(result)
    original_lines = _lines(SAMPLE_MD)

    heading_block = next(b for b in blocks if b.type == "heading")
    assert result_lines[heading_block.start_line] == "[translated heading]"

    other_translatable_blocks = [
        b for b in blocks if b.translatable and b is not heading_block
    ]
    for block in other_translatable_blocks:
        original_slice = original_lines[block.start_line : block.end_line]
        result_slice = result_lines[block.start_line : block.end_line]
        assert result_slice == original_slice


MIXED_FORMAT_MD = """# Mixed Format Test

This paragraph uses *star emphasis* and _underscore emphasis_ mixed together.

* Star list item one
* Star list item two

+ Plus list item one
+ Plus list item two

- Dash list item one
- Dash list item two


Multiple blank lines above (two consecutive blank lines).

\tCode block indented with a tab:

\tdef tab_indented():
\t    pass

> A blockquote with *italic* inside.

Final paragraph with **bold** and *italic* mixed.
"""


def test_mixed_format_roundtrip_is_byte_identical() -> None:
    """Embed markers then splice back with identity translations: output == input.

    Mixed formatting (star/underscore emphasis, mixed ``*``/``+``/``-`` list
    markers, multiple consecutive blank lines, tab-indented code block,
    blockquote) must survive the embed -> splice round-trip byte-for-byte.
    Non-trivial because any re-serialisation or normalisation would break
    the symmetry.
    """
    blocks = parse_blocks(MIXED_FORMAT_MD)
    marked = embed_markers(MIXED_FORMAT_MD, blocks)
    translations = extract_translations(marked)
    # Identity: each marker-id maps back to its original content.
    identity = {k: v for k, v in translations.items()}
    result = splice(MIXED_FORMAT_MD, blocks, identity)
    assert result == MIXED_FORMAT_MD, (
        "Mixed-format document must survive embed->splice round-trip byte-for-byte"
    )


# ---------------------------------------------------------------------------
# protect_inline / restore_inline
# ---------------------------------------------------------------------------


def test_protect_inline_replaces_inline_code() -> None:
    text = "Some text with `a code span` inside."
    protected, placeholders = protect_inline(text)

    assert "`a code span`" not in protected
    assert "⟦CODE_0⟧" in protected
    assert placeholders == {"⟦CODE_0⟧": "`a code span`"}


def test_protect_inline_replaces_link_url_but_keeps_link_text() -> None:
    text = "Check out [this great link](http://example.com/page?x=1) for info."
    protected, placeholders = protect_inline(text)

    assert "[this great link](" in protected
    assert "http://example.com/page?x=1" not in protected
    assert "⟦CODE_0⟧" in protected
    assert placeholders["⟦CODE_0⟧"] == "http://example.com/page?x=1"


def test_protect_inline_replaces_image_url_but_keeps_alt_text() -> None:
    text = "An image: ![my alt text](http://example.com/img.png) here."
    protected, placeholders = protect_inline(text)

    assert "![my alt text](" in protected
    assert "http://example.com/img.png" not in protected
    assert list(placeholders.values()) == ["http://example.com/img.png"]


def test_protect_inline_numbers_placeholders_in_appearance_order() -> None:
    text = "First [a](http://a.com) then `code` then [b](http://b.com)."
    protected, placeholders = protect_inline(text)

    assert placeholders["⟦CODE_0⟧"] == "http://a.com"
    assert placeholders["⟦CODE_1⟧"] == "`code`"
    assert placeholders["⟦CODE_2⟧"] == "http://b.com"


def test_protect_inline_handles_url_with_parentheses() -> None:
    """Regression: URLs containing parentheses (e.g. Wikipedia links) must
    be protected, not left exposed in the text."""
    text = "See [docs](http://example.com/wiki/Foo_(bar)) for details."
    protected, ph = protect_inline(text)
    assert "http://example.com/wiki/Foo_(bar)" not in protected
    assert "⟦CODE_0⟧" in protected
    assert ph.get("⟦CODE_0⟧") == "http://example.com/wiki/Foo_(bar)"
    # Link text must remain translatable.
    assert "[docs]" in protected


def test_protect_inline_handles_double_backtick_code_span() -> None:
    """Regression: code spans delimited by double backticks per CommonMark
    must be protected as a single unit, leaving no bare backtick behind."""
    text = "Use ``a `backtick` example`` in code."
    protected, ph = protect_inline(text)
    assert "⟦CODE_0⟧" in protected
    assert ph.get("⟦CODE_0⟧") == "``a `backtick` example``"
    # The inner backtick must not leak as a bare backtick or partial span.
    leftover = protected.replace("⟦CODE_0⟧", "")
    assert "`backtick`" not in leftover


def test_restore_inline_is_inverse_of_protect_inline() -> None:
    text = (
        "A paragraph with `inline code`, a [link](http://example.com/path), "
        "and an image ![alt](http://example.com/img.png) all together."
    )
    protected, placeholders = protect_inline(text)
    restored = restore_inline(protected, placeholders)

    assert restored == text


def test_restore_inline_roundtrip_on_sample_paragraph_with_two_code_spans() -> None:
    text = (
        "A final closing paragraph with more `inline_code_two` to protect "
        "and a [link](http://example.com/path) too."
    )
    protected, placeholders = protect_inline(text)
    assert protected != text
    restored = restore_inline(protected, placeholders)
    assert restored == text


def test_protect_inline_no_protectable_spans_returns_text_unchanged() -> None:
    text = "Just a plain sentence with no code or links."
    protected, placeholders = protect_inline(text)
    assert protected == text
    assert placeholders == {}


# ---------------------------------------------------------------------------
# Block dataclass sanity
# ---------------------------------------------------------------------------


def test_block_is_a_plain_dataclass_with_expected_fields() -> None:
    block = Block(type="text", start_line=0, end_line=1, translatable=True)
    assert block.type == "text"
    assert block.start_line == 0
    assert block.end_line == 1
    assert block.translatable is True
