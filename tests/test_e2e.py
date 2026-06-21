"""End-to-end test: a real local git repo, the real CLI, a fake translator.

This exercises the full `add` -> `translate` flow against an *external*
repo (added by local path, so no network clone happens), with everything
else (parsing, marker embed/extract/splice, cache diffing, output writing)
running for real. Only the LLM call (`create_translator`) is faked.

Patterns adapted from existing tests (duplicated here, not imported, to keep
this file standalone):
- `_setup_temp_paths` / config+cache patching: tests/test_cli.py
- `_init_repo_with_files` (subprocess git init+commit): tests/test_sync.py
- `_make_fake_translate_file` (marker-preserving fake translation):
  tests/test_sync.py
"""

from __future__ import annotations

import json
import re
import subprocess
from collections.abc import Callable
from pathlib import Path
from unittest.mock import patch

import pytest
from click.testing import CliRunner

from repo_translator.cli import main
from repo_translator.config import load_config
from repo_translator.translator.base import TokenUsage


@pytest.fixture
def runner() -> CliRunner:
    return CliRunner()


# ---------------------------------------------------------------------------
# Helpers (adapted from tests/test_cli.py and tests/test_sync.py)
# ---------------------------------------------------------------------------


def _init_repo_with_files(repo_dir: Path, files: dict[str, str]) -> None:
    """git init a repo at *repo_dir* and commit the given {relpath: content}."""
    subprocess.run(["git", "init", "-q", "-b", "main", str(repo_dir)], check=True)
    subprocess.run(
        ["git", "-C", str(repo_dir), "config", "user.email", "test@example.com"],
        check=True,
    )
    subprocess.run(
        ["git", "-C", str(repo_dir), "config", "user.name", "Test"], check=True
    )
    for relpath, content in files.items():
        full_path = repo_dir / relpath
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content)
    subprocess.run(["git", "-C", str(repo_dir), "add", "-A"], check=True)
    subprocess.run(
        ["git", "-C", str(repo_dir), "commit", "-q", "-m", "initial"], check=True
    )


def _commit_all(repo_dir: Path, message: str) -> None:
    subprocess.run(["git", "-C", str(repo_dir), "add", "-A"], check=True)
    subprocess.run(["git", "-C", str(repo_dir), "commit", "-q", "-m", message], check=True)


def _make_fake_translate_file() -> Callable[[str, list], tuple[str, TokenUsage]]:
    """Return a ``translate_file(marked_source, glossary) -> (str, TokenUsage)``
    fake.

    Wraps every marker's content with ``[ZH] ... [/ZH]`` so the resulting
    output is clearly distinguishable from the original and still
    round-trips through ``extract_translations``.
    """

    def _replace(m: re.Match) -> str:
        marker_id = m.group(1)
        content = m.group(2)
        return f"⟦{marker_id}⟧[ZH] {content} [/ZH]⟦/{marker_id}⟧"

    _MARKED_RE = re.compile(r"⟦(\d+)⟧(.*?)⟦/\1⟧", re.DOTALL)

    def _translate_file(marked_source: str, glossary: list) -> tuple[str, TokenUsage]:
        translated = _MARKED_RE.sub(_replace, marked_source)
        return translated, TokenUsage(prompt_tokens=100, completion_tokens=50)

    return _translate_file


def _setup_temp_paths(tmp_path: Path) -> tuple[Path, Path]:
    """Create temp config and cache directories and return (config_path, cache_path)."""
    config_dir = tmp_path / ".repo-translator"
    config_dir.mkdir()
    return config_dir / "config.yaml", config_dir / "cache.json"


def _usage_path_for(cache_path: Path) -> Path:
    return cache_path.parent / "usage.json"


SOURCE_README = (
    "# Demo Project\n"
    "\n"
    "This is a small demo project used for end-to-end testing.\n"
    "\n"
    "## Features\n"
    "\n"
    "- Fast\n"
    "- Simple\n"
    "- Reliable\n"
    "\n"
    "## Installation\n"
    "\n"
    "Run the following command:\n"
    "\n"
    "```bash\n"
    "pip install demo-project\n"
    "```\n"
    "\n"
    "That's it.\n"
)

SOURCE_GUIDE = (
    "# Guide\n"
    "\n"
    "## Getting Started\n"
    "\n"
    "First, read this paragraph carefully because it explains the setup.\n"
    "\n"
    "### Configuration\n"
    "\n"
    "Here is an example configuration block:\n"
    "\n"
    "```yaml\n"
    "key: value\n"
    "nested:\n"
    "  - one\n"
    "  - two\n"
    "```\n"
    "\n"
    "### Next Steps\n"
    "\n"
    "Once configured, proceed to the next section for advanced usage.\n"
)


def _build_source_repo(tmp_path: Path) -> Path:
    repo_dir = tmp_path / "demo-project"
    _init_repo_with_files(
        repo_dir,
        {
            "README.md": SOURCE_README,
            "docs/guide.md": SOURCE_GUIDE,
        },
    )
    return repo_dir


# ---------------------------------------------------------------------------
# Test: add (external path) triggers initial sync, output structure correct
# ---------------------------------------------------------------------------


def test_add_external_repo_runs_initial_sync_and_produces_output(
    tmp_path: Path, runner: CliRunner
) -> None:
    """`add <local-path>` on an external repo auto-syncs and writes output/."""
    repo_dir = _build_source_repo(tmp_path)
    config_path, cache_path = _setup_temp_paths(tmp_path)
    usage_path = _usage_path_for(cache_path)
    output_dir = tmp_path / "output"

    fake_translate = _make_fake_translate_file()

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path), \
         patch("repo_translator.usage_manager.DEFAULT_USAGE_PATH", usage_path), \
         patch("repo_translator.sync.create_translator") as mock_factory:
        mock_factory.return_value.translate_file.side_effect = fake_translate

        # Use --set first to point output.base_dir at our tmp dir, since the
        # CLI has no per-invocation --output flag; easiest is to seed config.
        from repo_translator.config import AppConfig, OutputConfig, save_config

        save_config(AppConfig(output=OutputConfig(base_dir=str(output_dir))), config_path)

        result = runner.invoke(
            main, ["add", str(repo_dir), "--name", "demo"]
        )

        assert result.exit_code == 0, result.output
        assert "Using local repository" in result.output
        assert "added and initial sync complete" in result.output

        # Config entry recorded as external (path, not url).
        saved_config = load_config(config_path)
        assert len(saved_config.repos) == 1
        repo_entry = saved_config.repos[0]
        assert repo_entry.name == "demo"
        assert repo_entry.path == str(repo_dir)
        assert repo_entry.url is None
        assert repo_entry.is_external

        output_repo = output_dir / "demo"

        # README.md (original) + README_zh.md (translated)
        readme_orig = output_repo / "README.md"
        readme_zh = output_repo / "README_zh.md"
        assert readme_orig.exists()
        assert readme_zh.exists()
        assert readme_orig.read_text() == SOURCE_README

        zh_content = readme_zh.read_text()
        assert zh_content != SOURCE_README
        assert "[ZH]" in zh_content
        assert "[/ZH]" in zh_content
        # Code block must survive untouched (not wrapped in markers).
        assert "pip install demo-project" in zh_content
        assert "```bash" in zh_content

        # docs/guide.md mirrored with directory structure preserved.
        guide_orig = output_repo / "docs" / "guide.md"
        guide_zh = output_repo / "docs" / "guide_zh.md"
        assert guide_orig.exists()
        assert guide_zh.exists()
        assert guide_orig.read_text() == SOURCE_GUIDE

        guide_zh_content = guide_zh.read_text()
        assert guide_zh_content != SOURCE_GUIDE
        assert "[ZH]" in guide_zh_content
        assert "key: value" in guide_zh_content  # yaml code block preserved

        # cache.json populated for both files.
        cache_data = json.loads(cache_path.read_text())
        assert "demo" in cache_data
        assert set(cache_data["demo"].keys()) == {"README.md", "docs/guide.md"}
        for record in cache_data["demo"].values():
            assert "blob_hash" in record
            assert "translated_at" in record


# ---------------------------------------------------------------------------
# Test: translate <name> after a source change only re-translates that file
# ---------------------------------------------------------------------------


def test_translate_after_change_only_updates_changed_file(
    tmp_path: Path, runner: CliRunner
) -> None:
    """After `add`, modifying one file and running `translate` updates only it."""
    repo_dir = _build_source_repo(tmp_path)
    config_path, cache_path = _setup_temp_paths(tmp_path)
    usage_path = _usage_path_for(cache_path)
    output_dir = tmp_path / "output"

    fake_translate = _make_fake_translate_file()

    from repo_translator.config import AppConfig, OutputConfig, save_config

    save_config(AppConfig(output=OutputConfig(base_dir=str(output_dir))), config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path), \
         patch("repo_translator.usage_manager.DEFAULT_USAGE_PATH", usage_path), \
         patch("repo_translator.sync.create_translator") as mock_factory:
        mock_factory.return_value.translate_file.side_effect = fake_translate

        result = runner.invoke(main, ["add", str(repo_dir), "--name", "demo"])
        assert result.exit_code == 0, result.output

    cache_after_add = json.loads(cache_path.read_text())
    readme_hash_before = cache_after_add["demo"]["README.md"]["blob_hash"]
    guide_hash_before = cache_after_add["demo"]["docs/guide.md"]["blob_hash"]
    guide_translated_at_before = cache_after_add["demo"]["docs/guide.md"]["translated_at"]

    # Modify only README.md and commit.
    updated_readme = SOURCE_README + "\n## Changelog\n\nInitial release notes.\n"
    (repo_dir / "README.md").write_text(updated_readme)
    _commit_all(repo_dir, "update readme")

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path), \
         patch("repo_translator.usage_manager.DEFAULT_USAGE_PATH", usage_path), \
         patch("repo_translator.sync.create_translator") as mock_factory2:
        mock_factory2.return_value.translate_file.side_effect = (
            _make_fake_translate_file()
        )

        result = runner.invoke(main, ["translate", "demo"])
        assert result.exit_code == 0, result.output
        assert "1 file(s) processed" in result.output

        # Only README.md should have been retranslated.
        mock_factory2.return_value.translate_file.assert_called_once()

    cache_after_translate = json.loads(cache_path.read_text())

    # README.md's blob_hash changed (content changed).
    readme_hash_after = cache_after_translate["demo"]["README.md"]["blob_hash"]
    assert readme_hash_after != readme_hash_before

    # docs/guide.md is untouched: same blob_hash AND same translated_at
    # (proves it was not reprocessed, per the documented cache.json mechanism).
    guide_hash_after = cache_after_translate["demo"]["docs/guide.md"]["blob_hash"]
    guide_translated_at_after = cache_after_translate["demo"]["docs/guide.md"]["translated_at"]
    assert guide_hash_after == guide_hash_before
    assert guide_translated_at_after == guide_translated_at_before

    # Output on disk reflects the new README content.
    output_repo = output_dir / "demo"
    new_readme_zh = (output_repo / "README_zh.md").read_text()
    assert "[ZH]" in new_readme_zh
    assert "release notes" in new_readme_zh  # new content went through translation
    new_readme_orig = (output_repo / "README.md").read_text()
    assert new_readme_orig == updated_readme

    # guide.md's _zh.md output should be byte-for-byte the same as after `add`
    # (it was never rewritten on this second run).
    guide_zh_content = (output_repo / "docs" / "guide_zh.md").read_text()
    assert "[ZH]" in guide_zh_content


# ---------------------------------------------------------------------------
# Test (nice-to-have): list shows a non-"never synced" last-sync value
# ---------------------------------------------------------------------------


def test_list_shows_synced_status_after_add(
    tmp_path: Path, runner: CliRunner
) -> None:
    """After a successful `add` + initial sync, `list` reports a real timestamp."""
    repo_dir = _build_source_repo(tmp_path)
    config_path, cache_path = _setup_temp_paths(tmp_path)
    usage_path = _usage_path_for(cache_path)
    output_dir = tmp_path / "output"

    from repo_translator.config import AppConfig, OutputConfig, save_config

    save_config(AppConfig(output=OutputConfig(base_dir=str(output_dir))), config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path), \
         patch("repo_translator.usage_manager.DEFAULT_USAGE_PATH", usage_path), \
         patch("repo_translator.sync.create_translator") as mock_factory:
        mock_factory.return_value.translate_file.side_effect = (
            _make_fake_translate_file()
        )
        result = runner.invoke(main, ["add", str(repo_dir), "--name", "demo"])
        assert result.exit_code == 0, result.output

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path):
        result = runner.invoke(main, ["list"])

    assert result.exit_code == 0, result.output
    assert "demo" in result.output
    assert "external" in result.output
    assert "never synced" not in result.output
