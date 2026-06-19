"""Pydantic configuration models for repo-translator.

Schema reference:
- repo-translator-design.md §4.1 (original config.yaml shape)
- SCRATCH.md §2.1 (managed `url` vs external `path` repos, mutually exclusive)
- SCRATCH.md §4   (sync.concurrency semantics: concurrent *files*, not paragraphs)
- SCRATCH.md §5   (glossary)
- SCRATCH.md §6   (output.exclude glob patterns)
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class RepoConfig(BaseModel):
    """A tracked repository.

    Exactly one of `url` (managed: cloned & pulled by the tool) or `path`
    (external: an existing local clone, read-only, never pulled) must be set
    (SCRATCH.md §2.1).
    """

    name: str
    url: str | None = None
    path: str | None = None
    branch: str | None = None
    added_at: datetime | None = None

    @model_validator(mode="after")
    def _check_url_xor_path(self) -> "RepoConfig":
        # Treat empty-string / whitespace-only values as "unset", since YAML
        # or CLI input can easily produce e.g. `url: ""` that would otherwise
        # slip past an `is None` check.
        self.url = self.url.strip() or None if self.url is not None else None
        self.path = self.path.strip() or None if self.path is not None else None

        url_set = self.url is not None
        path_set = self.path is not None
        if url_set == path_set:
            raise ValueError(
                "RepoConfig requires exactly one of 'url' or 'path' to be set "
                "(they are mutually exclusive)"
            )
        return self

    @property
    def is_managed(self) -> bool:
        """True if this repo is tool-managed (cloned from `url`)."""
        return self.url is not None

    @property
    def is_external(self) -> bool:
        """True if this repo points at an existing local clone (`path`)."""
        return self.path is not None


class GlossaryEntry(BaseModel):
    """A single glossary term and how it should be rendered in translations.

    If `translation` is None, the term should be kept verbatim (untranslated)
    in the output (SCRATCH.md §5).
    """

    term: str
    translation: str | None = None


class OutputConfig(BaseModel):
    """Output directory layout configuration."""

    base_dir: str = "~/.repo-translator/output"
    suffix: str = "_zh"
    exclude: list[str] = Field(default_factory=list)


class SyncConfig(BaseModel):
    """Sync/polling configuration.

    `concurrency` is the number of files processed concurrently within a
    single repo sync (SCRATCH.md §4) — not paragraphs/segments.
    """

    interval_hours: int = 6
    concurrency: int = 3


class TranslatorConfig(BaseModel):
    """Translation engine configuration (design.md §4.1)."""

    engine: str = "deepseek"
    api_key: str | None = None
    model: str | None = None
    base_url: str | None = None
    max_tokens: int = 4096
    temperature: float = 0.3


class AppConfig(BaseModel):
    """Top-level application configuration (the parsed shape of config.yaml)."""

    translator: TranslatorConfig = Field(default_factory=TranslatorConfig)
    sync: SyncConfig = Field(default_factory=SyncConfig)
    output: OutputConfig = Field(default_factory=OutputConfig)
    repos: list[RepoConfig] = Field(default_factory=list)
    glossary: list[GlossaryEntry] = Field(default_factory=list)
