"""OpenAI-backed BaseTranslator implementation."""

from __future__ import annotations

from openai import APITimeoutError, OpenAI, RateLimitError as OpenAIRateLimitError

from repo_translator.translator.base import BaseTranslator, RateLimitError

#: Per-call timeout in seconds (design.md §5.3: "单段落超时 30s").
DEFAULT_TIMEOUT = 30.0
DEFAULT_MODEL = "gpt-4o-mini"


class OpenAITranslator(BaseTranslator):
    """Translator backed by the OpenAI Chat Completions API."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.3,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        self.model = model or DEFAULT_MODEL
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.client = OpenAI(api_key=api_key, base_url=base_url, timeout=timeout)

    def translate_raw(self, prompt: str) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                messages=[{"role": "user", "content": prompt}],
            )
        except OpenAIRateLimitError as exc:
            raise RateLimitError(str(exc)) from exc
        except APITimeoutError as exc:
            raise TimeoutError(str(exc)) from exc
        return response.choices[0].message.content or ""
