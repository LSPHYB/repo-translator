"""Tests for repo_translator.translator.deepseek_translator.

DeepSeekTranslator inherits OpenAITranslator unchanged (same OpenAI-compatible
response shape) -- this just confirms usage extraction still works through
the inherited `translate_raw`, using the same fake-response pattern as
test_openai_translator.py.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from repo_translator.translator.base import TokenUsage
from repo_translator.translator.deepseek_translator import (
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    DeepSeekTranslator,
)


def test_translate_raw_extracts_text_and_usage() -> None:
    translator = DeepSeekTranslator(api_key="fake-key")
    translator.client = MagicMock()
    translator.client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="你好"))],
        usage=SimpleNamespace(prompt_tokens=8, completion_tokens=4),
    )

    text, usage = translator.translate_raw("hello")

    assert text == "你好"
    assert usage == TokenUsage(prompt_tokens=8, completion_tokens=4)


def test_defaults_use_deepseek_base_url_and_model() -> None:
    translator = DeepSeekTranslator(api_key="fake-key")

    assert translator.model == DEFAULT_MODEL
    # base_url isn't stored as an attribute on the translator itself (it's
    # passed straight to the OpenAI client), so just confirm the constant
    # used to build that client is DeepSeek's endpoint.
    assert DEFAULT_BASE_URL == "https://api.deepseek.com"
