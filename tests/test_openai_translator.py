"""Tests for repo_translator.translator.openai_translator -- real usage
extraction from the OpenAI Chat Completions response object.

No real API calls: `OpenAITranslator.client` is replaced with a MagicMock
whose `chat.completions.create` returns a fake response object shaped like
the real SDK's `ChatCompletion` (specifically `.choices[0].message.content`
and `.usage.prompt_tokens`/`.usage.completion_tokens`).
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from openai import RateLimitError as OpenAIRateLimitError

from repo_translator.translator.base import RateLimitError, TokenUsage
from repo_translator.translator.openai_translator import OpenAITranslator


def _fake_response(content: str, prompt_tokens: int, completion_tokens: int):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        usage=SimpleNamespace(
            prompt_tokens=prompt_tokens, completion_tokens=completion_tokens
        ),
    )


def test_translate_raw_extracts_text_and_usage() -> None:
    translator = OpenAITranslator(api_key="fake-key")
    translator.client = MagicMock()
    translator.client.chat.completions.create.return_value = _fake_response(
        "你好", prompt_tokens=12, completion_tokens=7
    )

    text, usage = translator.translate_raw("hello")

    assert text == "你好"
    assert usage == TokenUsage(prompt_tokens=12, completion_tokens=7)


def test_translate_raw_handles_missing_usage_field() -> None:
    """Some OpenAI-compatible endpoints may omit `usage` entirely; this must
    not crash, just report zero usage."""
    translator = OpenAITranslator(api_key="fake-key")
    translator.client = MagicMock()
    translator.client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="你好"))],
        usage=None,
    )

    text, usage = translator.translate_raw("hello")

    assert text == "你好"
    assert usage == TokenUsage(0, 0)


def test_translate_raw_handles_none_content() -> None:
    translator = OpenAITranslator(api_key="fake-key")
    translator.client = MagicMock()
    translator.client.chat.completions.create.return_value = _fake_response(
        None, prompt_tokens=5, completion_tokens=0
    )

    text, usage = translator.translate_raw("hello")

    assert text == ""
    assert usage == TokenUsage(prompt_tokens=5, completion_tokens=0)


def test_translate_raw_rate_limit_error_reraised_as_repo_translator_rate_limit_error() -> None:
    translator = OpenAITranslator(api_key="fake-key")
    translator.client = MagicMock()
    translator.client.chat.completions.create.side_effect = OpenAIRateLimitError(
        "rate limited", response=MagicMock(status_code=429), body=None
    )

    try:
        translator.translate_raw("hello")
        raised = False
    except RateLimitError:
        raised = True

    assert raised
