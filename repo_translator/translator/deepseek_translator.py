"""DeepSeek-backed BaseTranslator implementation (OpenAI-compatible endpoint)."""

from __future__ import annotations

from repo_translator.translator.openai_translator import DEFAULT_TIMEOUT, OpenAITranslator

#: DeepSeek's OpenAI-compatible API base URL, used when no explicit
#: `base_url` is supplied via config.
DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"


class DeepSeekTranslator(OpenAITranslator):
    """Translator backed by DeepSeek's OpenAI-compatible chat completions API.

    DeepSeek exposes an OpenAI-compatible endpoint, so this simply reuses
    `OpenAITranslator` with DeepSeek-specific defaults for `base_url` and
    `model`.
    """

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.3,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        super().__init__(
            api_key=api_key,
            model=model or DEFAULT_MODEL,
            base_url=base_url or DEFAULT_BASE_URL,
            max_tokens=max_tokens,
            temperature=temperature,
            timeout=timeout,
        )
