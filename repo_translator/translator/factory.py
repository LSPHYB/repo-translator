"""create_translator(config) -> BaseTranslator factory, dispatching on TranslatorConfig.engine."""

from __future__ import annotations

from repo_translator.config import TranslatorConfig
from repo_translator.translator.base import BaseTranslator
from repo_translator.translator.claude_translator import ClaudeTranslator
from repo_translator.translator.deepseek_translator import DeepSeekTranslator
from repo_translator.translator.openai_translator import OpenAITranslator

_ENGINES: dict[str, type[BaseTranslator]] = {
    "openai": OpenAITranslator,
    "deepseek": DeepSeekTranslator,
    "claude": ClaudeTranslator,
}


def create_translator(config: TranslatorConfig) -> BaseTranslator:
    """Instantiate the `BaseTranslator` subclass matching `config.engine`.

    Raises `ValueError` if `config.engine` is not a recognized engine name.
    """
    engine_cls = _ENGINES.get(config.engine)
    if engine_cls is None:
        raise ValueError(
            f"Unknown translator engine '{config.engine}'. "
            f"Supported engines: {sorted(_ENGINES)}"
        )
    return engine_cls(
        api_key=config.api_key,
        model=config.model,
        base_url=config.base_url,
        max_tokens=config.max_tokens,
        temperature=config.temperature,
    )
