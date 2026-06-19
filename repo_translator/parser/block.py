"""Block dataclass definition (translatable vs. non-translatable source regions).

A ``Block`` represents one top-level structural region of a Markdown document,
identified purely by its line range in the *original source text*. Blocks are
produced by slicing the source string according to markdown-it-py token
``.map`` ranges -- never by re-rendering the parsed AST back into Markdown.

Line ranges follow markdown-it-py's convention: ``[start_line, end_line)``,
half-open, 0-indexed, referring to the lines obtained by splitting the
original source on ``"\\n"``.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Block:
    """One structural region of a Markdown document.

    Attributes:
        type: A short label for the block's kind, e.g. ``"heading"``,
            ``"paragraph"``, ``"table"``, ``"list"``, ``"code"``,
            ``"html"``, ``"frontmatter"``, ``"hr"``.
        start_line: Index of the first line belonging to this block
            (0-indexed, inclusive).
        end_line: Index one past the last line belonging to this block
            (0-indexed, exclusive) -- i.e. the range is ``[start_line, end_line)``.
        translatable: Whether this block's text should be sent to an LLM
            for translation. ``False`` for code fences, raw HTML blocks,
            and YAML frontmatter.
    """

    type: str
    start_line: int
    end_line: int
    translatable: bool
