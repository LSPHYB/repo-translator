"""Tests for repo_translator.sync -- the main pipeline integration."""

from __future__ import annotations

import re
import subprocess
from collections.abc import Callable
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from repo_translator.config import (
    AppConfig,
    GlossaryEntry,
    OutputConfig,
    RepoConfig,
    SyncConfig,
    TranslatorConfig,
)
from repo_translator.git_manager import GitOperationError
from repo_translator.sync import sync_repo


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _init_repo_with_files(repo_dir: Path, files: dict[str, str]) -> None:
    """git init a repo at *repo_dir* and commit the given {relpath: content}."""
    subprocess.run(
        ["git", "init", "-q", "-b", "main", str(repo_dir)], check=True
    )
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


def _make_fake_translate_file() -> Callable[[str, list], str]:
    """Return a ``translate_file(marked_source, glossary) -> str`` fake.

    The fake wraps every marker's content with ``[ZH] ... [/ZH]`` so the
    resulting output is clearly distinguishable from the original and still
    round-trips through ``extract_translations``.
    """

    def _replace(m: re.Match) -> str:
        marker_id = m.group(1)
        content = m.group(2)
        return f"⟦{marker_id}⟧[ZH] {content} [/ZH]⟦/{marker_id}⟧"

    _MARKED_RE = re.compile(r"⟦(\d+)⟧(.*?)⟦/\1⟧", re.DOTALL)

    def _translate_file(marked_source: str, glossary: list) -> str:
        return _MARKED_RE.sub(_replace, marked_source)

    return _translate_file


def _make_app_config(
    *,
    concurrency: int = 2,
    exclude: list[str] | None = None,
    base_dir: Path | None = None,
    suffix: str = "_zh",
    engine: str = "deepseek",
) -> AppConfig:
    """Build an ``AppConfig`` with sensible test defaults."""
    return AppConfig(
        translator=TranslatorConfig(engine=engine, api_key="fake-key"),
        sync=SyncConfig(interval_hours=6, concurrency=concurrency),
        output=OutputConfig(
            base_dir=str(base_dir) if base_dir is not None else "~/.repo-translator/output",
            suffix=suffix,
            exclude=exclude if exclude is not None else [],
        ),
        glossary=[],
        repos=[],
    )


# ---------------------------------------------------------------------------
# Test: normal sync -- multiple .md files produce correct output structure
# ---------------------------------------------------------------------------


def test_sync_produces_output_structure(tmp_path: Path) -> None:
    """A repo with 3 .md files: all should produce <name>.md + <name>_zh.md."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "README.md": "# Hello\n\nThis is the README.\n",
            "docs/guide.md": "## Guide\n\nSome guide content.\n",
            "api/reference.md": "### API\n\nAPI reference here.\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)

    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()
    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = fake

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ) as mock_factory:
        result_cache = sync_repo(repo_config, app_config, {})

    # Verify create_translator was called
    mock_factory.assert_called_once()

    # Verify translate_file was called for all 3 .md files
    assert mock_translator.translate_file.call_count == 3

    # Verify output structure
    output_repo = output_dir / "test-repo"
    assert output_repo.is_dir()

    expected_files = {
        "README.md",
        "README_zh.md",
        "docs/guide.md",
        "docs/guide_zh.md",
        "api/reference.md",
        "api/reference_zh.md",
    }
    actual_files = {
        str(p.relative_to(output_repo))
        for p in output_repo.rglob("*")
        if p.is_file()
    }
    assert actual_files == expected_files

    # Verify _zh.md files contain [ZH] markers (translated content)
    for zh_path in ["README_zh.md", "docs/guide_zh.md", "api/reference_zh.md"]:
        content = (output_repo / zh_path).read_text()
        assert "[ZH]" in content
        assert "[/ZH]" in content

    # Verify original copies are byte-for-byte identical to source
    for orig_path in ["README.md", "docs/guide.md", "api/reference.md"]:
        copied = (output_repo / orig_path).read_text()
        source = (repo_dir / orig_path).read_text()
        assert copied == source

    # Verify cache was updated with all 3 files
    assert "test-repo" in result_cache
    assert len(result_cache["test-repo"]) == 3
    for f in ["README.md", "docs/guide.md", "api/reference.md"]:
        assert f in result_cache["test-repo"]
        assert "blob_hash" in result_cache["test-repo"][f]
        assert "translated_at" in result_cache["test-repo"][f]


# ---------------------------------------------------------------------------
# Test: exclude glob filtering
# ---------------------------------------------------------------------------


def test_sync_exclude_excludes_matching_files(tmp_path: Path) -> None:
    """Files matching output.exclude globs are skipped entirely."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "README.md": "# Hello\n",
            "CHANGELOG.md": "# Changelog\n\nv1.0 stuff.\n",
            "docs/guide.md": "## Guide\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(
        base_dir=output_dir, exclude=["CHANGELOG.md"]
    )

    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()
    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = fake

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        result_cache = sync_repo(repo_config, app_config, {})

    # CHANGELOG.md should NOT have been translated (only 2 calls, not 3)
    assert mock_translator.translate_file.call_count == 2

    # Verify output: CHANGELOG files should NOT exist
    output_repo = output_dir / "test-repo"
    assert not (output_repo / "CHANGELOG.md").exists()
    assert not (output_repo / "CHANGELOG_zh.md").exists()

    # Other files should exist
    assert (output_repo / "README.md").exists()
    assert (output_repo / "README_zh.md").exists()
    assert (output_repo / "docs/guide.md").exists()
    assert (output_repo / "docs/guide_zh.md").exists()

    # Excluded file should not appear in cache
    assert "CHANGELOG.md" not in result_cache["test-repo"]


def test_sync_exclude_supports_glob_patterns(tmp_path: Path) -> None:
    """Glob patterns like '**/internal/**' should match nested paths."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "README.md": "# Hello\n",
            "docs/internal/private.md": "# Private\n",
            "docs/public.md": "# Public\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(
        base_dir=output_dir, exclude=["**/internal/**"]
    )

    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()
    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = fake

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        result_cache = sync_repo(repo_config, app_config, {})

    # Only README.md and docs/public.md should be translated
    assert mock_translator.translate_file.call_count == 2

    output_repo = output_dir / "test-repo"
    # internal files should not exist
    assert not (output_repo / "docs/internal/private.md").exists()
    assert not (output_repo / "docs/internal/private_zh.md").exists()

    # But the internal directory might exist if empty -- that's fine
    # The key assertion is that the files don't exist

    # Verify public files are present
    assert (output_repo / "docs/public.md").exists()
    assert (output_repo / "docs/public_zh.md").exists()

    assert "docs/internal/private.md" not in result_cache["test-repo"]


# ---------------------------------------------------------------------------
# Test: second run with no changes -> no translation triggered
# ---------------------------------------------------------------------------


def test_sync_second_run_no_changes_skips_translation(tmp_path: Path) -> None:
    """When no files have changed, translate_file must not be called."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "README.md": "# Hello\n",
            "docs/guide.md": "## Guide\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)

    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()
    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = fake

    # First run
    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        cache = sync_repo(repo_config, app_config, {})

    assert mock_translator.translate_file.call_count == 2

    # Second run -- no file changes
    mock_translator2 = MagicMock()
    mock_translator2.translate_file.side_effect = _make_fake_translate_file()

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator2
    ):
        cache2 = sync_repo(repo_config, app_config, cache)

    # translate_file must NOT have been called on the second run
    mock_translator2.translate_file.assert_not_called()

    # Cache should be unchanged (same entries, same hashes)
    assert cache2 == cache


def test_sync_second_run_with_new_file_only_translates_new(tmp_path: Path) -> None:
    """If a new .md file appears, only that file triggers translation."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "README.md": "# Hello\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)

    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()
    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = fake

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        cache = sync_repo(repo_config, app_config, {})

    assert mock_translator.translate_file.call_count == 1

    # Add a new file and commit
    (repo_dir / "NEWS.md").write_text("# News\n")
    subprocess.run(["git", "-C", str(repo_dir), "add", "-A"], check=True)
    subprocess.run(
        ["git", "-C", str(repo_dir), "commit", "-q", "-m", "add news"], check=True
    )

    mock_translator2 = MagicMock()
    mock_translator2.translate_file.side_effect = _make_fake_translate_file()

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator2
    ):
        cache2 = sync_repo(repo_config, app_config, cache)

    # Only NEWS.md should be translated (1 call, not 2)
    assert mock_translator2.translate_file.call_count == 1

    # Cache should have 2 entries now
    assert len(cache2["test-repo"]) == 2
    assert "NEWS.md" in cache2["test-repo"]
    assert "README.md" in cache2["test-repo"]


# ---------------------------------------------------------------------------
# Test: GitOperationError -> returns original cache
# ---------------------------------------------------------------------------


def test_sync_clone_or_pull_git_operation_error_returns_original_cache(
    tmp_path: Path,
) -> None:
    """When clone_or_pull raises GitOperationError, sync_repo logs and
    returns the original cache unchanged (no crash)."""
    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)

    repo_config = RepoConfig(
        name="broken-repo", url="https://invalid.example/nonexistent.git"
    )

    original_cache = {"other-repo": {"file.md": {"blob_hash": "abc", "translated_at": "2025-01-01T00:00:00+00:00"}}}

    # mock clone_or_pull directly to simulate the error at the function
    # level used by sync_repo
    with patch(
        "repo_translator.sync.clone_or_pull",
        side_effect=GitOperationError("simulated clone failure"),
    ):
        result = sync_repo(repo_config, app_config, original_cache)

    # Cache must be returned as-is (by identity, since we return it directly)
    assert result is original_cache


# ---------------------------------------------------------------------------
# Test: OSError on file write -- isolated failure
# ---------------------------------------------------------------------------


def test_sync_oserror_on_write_isolates_failure(tmp_path: Path) -> None:
    """When one file write raises OSError, other files still succeed, and
    the failed file is NOT recorded in cache."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "README.md": "# Hello\n",
            "docs/guide.md": "## Guide\n",
            "api/reference.md": "### API\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)

    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()

    # Create a mock that succeeds for all but "docs/guide.md"
    real_write_text = Path.write_text

    # We need to make writes for docs/guide.md fail
    original_mkdir = Path.mkdir

    def _failing_write_text(self, content, encoding=None):
        # Check if this is the guide.md file (either _zh.md or original copy)
        if self.name in ("guide.md", "guide_zh.md"):
            raise OSError("Simulated disk full")
        return real_write_text(self, content, encoding=encoding)

    with patch(
        "repo_translator.sync.create_translator",
        return_value=MagicMock(translate_file=MagicMock(side_effect=fake)),
    ), patch.object(Path, "write_text", _failing_write_text):
        result_cache = sync_repo(repo_config, app_config, {})

    # Verify: README.md and api/reference.md should have been written
    # (write_text is patched globally, so our failing mock prevents
    # all writes -- we need a more targeted approach)

    # Actually, the patching above patches ALL Path.write_text calls globally
    # which means even README.md write will check the condition. Let me verify
    # the condition logic covers only docs/guide.* files.

    # Files that should succeed: README.md, README_zh.md, api/reference.md, api/reference_zh.md
    # Files that should fail: docs/guide.md, docs/guide_zh.md

    output_repo = output_dir / "test-repo"

    # Failing files should not exist (or be partial)
    # Passing files should exist
    assert (output_repo / "README.md").exists()
    assert (output_repo / "README_zh.md").exists()
    assert (output_repo / "api/reference.md").exists()
    assert (output_repo / "api/reference_zh.md").exists()

    # failed file: cache should NOT contain docs/guide.md
    assert "docs/guide.md" not in result_cache.get("test-repo", {})

    # successful files should be in cache
    assert "README.md" in result_cache.get("test-repo", {})
    assert "api/reference.md" in result_cache.get("test-repo", {})


def test_sync_oserror_on_write_does_not_affect_cache_for_successful(
    tmp_path: Path,
) -> None:
    """Cache records for successfully written files are preserved; only
    the failed file is absent from cache."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "a.md": "# A\n",
            "b.md": "# B\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)

    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()

    # Make writes to a.md / a_zh.md fail
    real_write_text = Path.write_text

    def _failing_write_text(self, content, encoding=None):
        if self.name in ("a.md", "a_zh.md"):
            raise OSError("Simulated disk full")
        return real_write_text(self, content, encoding=encoding)

    with patch(
        "repo_translator.sync.create_translator",
        return_value=MagicMock(translate_file=MagicMock(side_effect=fake)),
    ), patch.object(Path, "write_text", _failing_write_text):
        result_cache = sync_repo(repo_config, app_config, {})

    # b.md should succeed and be in cache; a.md should not
    repo_cache = result_cache.get("test-repo", {})
    assert "a.md" not in repo_cache
    assert "b.md" in repo_cache
    assert "blob_hash" in repo_cache["b.md"]

    # b.md output should exist on disk
    assert (output_dir / "test-repo" / "b.md").exists()
    assert (output_dir / "test-repo" / "b_zh.md").exists()


# ---------------------------------------------------------------------------
# Test: output suffix from config is respected
# ---------------------------------------------------------------------------


def test_sync_respects_output_suffix(tmp_path: Path) -> None:
    """The configured output.suffix is used for the translation filename."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(repo_dir, {"README.md": "# Hello\n"})

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir, suffix="_cn")

    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()
    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = fake

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        sync_repo(repo_config, app_config, {})

    # Should produce README_cn.md (not README_zh.md)
    assert (output_dir / "test-repo" / "README_cn.md").exists()
    assert not (output_dir / "test-repo" / "README_zh.md").exists()
    # Original copy should still be README.md
    assert (output_dir / "test-repo" / "README.md").exists()


# ---------------------------------------------------------------------------
# Test: directory structure mirrors source repo
# ---------------------------------------------------------------------------


def test_sync_output_directory_mirrors_source(tmp_path: Path) -> None:
    """Deeply nested .md files preserve their directory structure in output."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "a/b/c/d/deep.md": "# Deep\n",
            "x/y/mid.md": "## Mid\n",
            "top.md": "### Top\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)

    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()
    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = fake

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        sync_repo(repo_config, app_config, {})

    output_repo = output_dir / "test-repo"
    assert (output_repo / "a/b/c/d/deep.md").exists()
    assert (output_repo / "a/b/c/d/deep_zh.md").exists()
    assert (output_repo / "x/y/mid.md").exists()
    assert (output_repo / "x/y/mid_zh.md").exists()
    assert (output_repo / "top.md").exists()
    assert (output_repo / "top_zh.md").exists()


# ---------------------------------------------------------------------------
# Test: empty repo (no .md files) is handled gracefully
# ---------------------------------------------------------------------------


def test_sync_empty_repo_no_md_files(tmp_path: Path) -> None:
    """A repo with no .md files should not crash and not call translation."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "script.py": "print('hi')\n",
            "data.json": "{}",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)

    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()
    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = fake

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        result = sync_repo(repo_config, app_config, {})

    mock_translator.translate_file.assert_not_called()
    assert result == {}


# ---------------------------------------------------------------------------
# Test: translation failure within a file is isolated
# ---------------------------------------------------------------------------


def test_sync_translation_failure_isolated(tmp_path: Path) -> None:
    """If one file's translation raises, other files still succeed."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "ok.md": "# OK\n",
            "fail.md": "# Will Fail\n",
            "also_ok.md": "# Also OK\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)

    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    def _selective_fail(marked_source, glossary):
        if "Will Fail" in marked_source:
            raise RuntimeError("Simulated translation failure")
        return _make_fake_translate_file()(marked_source, glossary)

    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = _selective_fail

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        result_cache = sync_repo(repo_config, app_config, {})

    # translate_file should have been called 3 times (all files attempted)
    assert mock_translator.translate_file.call_count == 3

    # "fail.md" should NOT be in cache
    assert "fail.md" not in result_cache.get("test-repo", {})

    # "ok.md" and "also_ok.md" SHOULD be in cache
    assert "ok.md" in result_cache.get("test-repo", {})
    assert "also_ok.md" in result_cache.get("test-repo", {})

    # Output for successful files should exist
    output_repo = output_dir / "test-repo"
    assert (output_repo / "ok.md").exists()
    assert (output_repo / "ok_zh.md").exists()
    assert (output_repo / "also_ok.md").exists()
    assert (output_repo / "also_ok_zh.md").exists()

    # Output for failed file should NOT exist
    assert not (output_repo / "fail.md").exists()
    assert not (output_repo / "fail_zh.md").exists()


# ---------------------------------------------------------------------------
# Test: concurrency setting is respected
# ---------------------------------------------------------------------------


def test_sync_respects_concurrency_setting(tmp_path: Path) -> None:
    """sync_repo uses app_config.sync.concurrency to set max_workers."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "a.md": "# A\n",
            "b.md": "# B\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir, concurrency=5)

    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()
    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = fake

    with patch(
        "repo_translator.sync.ThreadPoolExecutor",
        wraps=__import__("concurrent.futures").futures.ThreadPoolExecutor,
    ) as mock_executor:
        with patch(
            "repo_translator.sync.create_translator", return_value=mock_translator
        ):
            sync_repo(repo_config, app_config, {})

    # ThreadPoolExecutor should have been called with max_workers=5
    mock_executor.assert_called_once_with(max_workers=5)


# ---------------------------------------------------------------------------
# Test: managed repo (url-based) end-to-end
# ---------------------------------------------------------------------------


def test_sync_managed_repo_end_to_end(tmp_path: Path) -> None:
    """Full sync of a managed repo (cloned from URL) produces correct output."""
    src_repo = tmp_path / "src-repo"
    _init_repo_with_files(src_repo, {"README.md": "# Hello\n", "docs/guide.md": "## Guide\n"})

    # Clone src_repo into a bare-ish location to act as remote
    remote_bare = tmp_path / "remote.git"
    subprocess.run(
        ["git", "clone", "--bare", "-q", str(src_repo), str(remote_bare)], check=True
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)

    repo_config = RepoConfig(name="managed-repo", url=str(remote_bare))

    fake = _make_fake_translate_file()
    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = fake

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        cache = sync_repo(repo_config, app_config, {})

    # Verify output
    output_repo = output_dir / "managed-repo"
    assert (output_repo / "README.md").exists()
    assert (output_repo / "README_zh.md").exists()
    assert (output_repo / "docs/guide.md").exists()
    assert (output_repo / "docs/guide_zh.md").exists()

    assert mock_translator.translate_file.call_count == 2

    # Verify cache
    assert "managed-repo" in cache
    assert len(cache["managed-repo"]) == 2

    # Second run: add a new commit to source, verify only new is translated
    (src_repo / "NEWS.md").write_text("# News\n")
    subprocess.run(["git", "-C", str(src_repo), "add", "-A"], check=True)
    subprocess.run(
        ["git", "-C", str(src_repo), "commit", "-q", "-m", "add news"], check=True
    )
    subprocess.run(
        ["git", "-C", str(remote_bare), "fetch", str(src_repo), "+refs/heads/*:refs/heads/*"],
        check=True,
    )

    mock_translator2 = MagicMock()
    mock_translator2.translate_file.side_effect = _make_fake_translate_file()

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator2
    ):
        cache2 = sync_repo(repo_config, app_config, cache)

    assert mock_translator2.translate_file.call_count == 1

    # Cache should now have 3 entries
    assert len(cache2["managed-repo"]) == 3
    assert "NEWS.md" in cache2["managed-repo"]


# ---------------------------------------------------------------------------
# Test: only_files parameter restricts processing to requested files
# ---------------------------------------------------------------------------


def test_sync_repo_only_files_skips_unrequested_files(tmp_path: Path) -> None:
    """only_files restricts processing to the given paths, ignoring the rest."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "README.md": "# Hello\n",
            "docs/guide.md": "## Guide\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)
    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()
    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = fake

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        result_cache = sync_repo(
            repo_config, app_config, {}, only_files=["docs/guide.md"]
        )

    assert mock_translator.translate_file.call_count == 1
    assert list(result_cache["test-repo"]) == ["docs/guide.md"]

    output_repo = output_dir / "test-repo"
    assert not (output_repo / "README.md").exists()
    assert (output_repo / "docs" / "guide_zh.md").exists()


def test_sync_repo_only_files_ignores_unknown_path(tmp_path: Path) -> None:
    """A path in only_files that doesn't exist in the repo is skipped, not an error."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(repo_dir, {"README.md": "# Hello\n"})

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)
    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = _make_fake_translate_file()

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        result_cache = sync_repo(
            repo_config, app_config, {}, only_files=["does/not/exist.md"]
        )

    assert mock_translator.translate_file.call_count == 0
    assert result_cache == {}
