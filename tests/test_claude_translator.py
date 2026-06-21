"""Tests for repo_translator.translator.claude_translator -- real usage
extraction from the Anthropic Messages response object.

No real API calls: `ClaudeTranslator.client` is replaced with a MagicMock
whose `messages.create` returns a fake response object shaped like the real
SDK's `Message` (specifically `.content` blocks with `.type`/`.text`, and
`.usage.input_tokens`/`.usage.output_tokens`).
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from anthropic import RateLimitError as AnthropicRateLimitError

from repo_translator.translator.base import RateLimitError, TokenUsage
from repo_translator.translator.claude_translator import ClaudeTranslator


def _fake_response(text: str, input_tokens: int, output_tokens: int):
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=text)],
        usage=SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens),
    )


def test_translate_raw_extracts_text_and_usage() -> None:
    translator = ClaudeTranslator(api_key="fake-key")
    translator.client = MagicMock()
    translator.client.messages.create.return_value = _fake_response(
        "你好", input_tokens=20, output_tokens=9
    )

    text, usage = translator.translate_raw("hello")

    assert text == "你好"
    assert usage == TokenUsage(prompt_tokens=20, completion_tokens=9)


def test_translate_raw_concatenates_multiple_text_blocks() -> None:
    translator = ClaudeTranslator(api_key="fake-key")
    translator.client = MagicMock()
    translator.client.messages.create.return_value = SimpleNamespace(
        content=[
            SimpleNamespace(type="text", text="你好"),
            SimpleNamespace(type="text", text="世界"),
        ],
        usage=SimpleNamespace(input_tokens=3, output_tokens=4),
    )

    text, usage = translator.translate_raw("hello")

    assert text == "你好世界"
    assert usage == TokenUsage(prompt_tokens=3, completion_tokens=4)


def test_translate_raw_handles_missing_usage_field() -> None:
    translator = ClaudeTranslator(api_key="fake-key")
    translator.client = MagicMock()
    translator.client.messages.create.return_value = SimpleNamespace(
        content=[SimpleNamespace(type="text", text="你好")],
        usage=None,
    )

    text, usage = translator.translate_raw("hello")

    assert text == "你好"
    assert usage == TokenUsage(0, 0)


def test_translate_raw_rate_limit_error_reraised_as_repo_translator_rate_limit_error() -> None:
    translator = ClaudeTranslator(api_key="fake-key")
    translator.client = MagicMock()
    translator.client.messages.create.side_effect = AnthropicRateLimitError(
        "rate limited", response=MagicMock(status_code=429), body=None
    )

    try:
        translator.translate_raw("hello")
        raised = False
    except RateLimitError:
        raised = True

    assert raised
