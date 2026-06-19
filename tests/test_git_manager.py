"""Tests for repo_translator.git_manager."""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest

from repo_translator.config import RepoConfig
from repo_translator.git_manager import (
    GitOperationError,
    clone,
    clone_or_pull,
    get_file_blob_map,
    list_md_files,
    pull,
)


def _init_repo_with_files(repo_dir: Path, files: dict[str, str]) -> None:
    """git init a repo at repo_dir and commit the given {relpath: content} files."""
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


def test_get_file_blob_map_returns_path_to_hash(tmp_path: Path) -> None:
    repo_dir = tmp_path / "repo"
    _init_repo_with_files(
        repo_dir,
        {
            "README.md": "hello\n",
            "docs/guide.md": "world\n",
            "script.py": "print('hi')\n",
        },
    )

    blob_map = get_file_blob_map(repo_dir)

    assert set(blob_map.keys()) == {"README.md", "docs/guide.md", "script.py"}
    for blob_hash in blob_map.values():
        assert len(blob_hash) == 40
        assert all(c in "0123456789abcdef" for c in blob_hash)

    # Cross-check against `git hash-object` for one file.
    result = subprocess.run(
        ["git", "-C", str(repo_dir), "hash-object", "README.md"],
        check=True,
        capture_output=True,
        text=True,
    )
    assert blob_map["README.md"] == result.stdout.strip()


def test_get_file_blob_map_handles_non_ascii_filenames(tmp_path: Path) -> None:
    repo_dir = tmp_path / "repo"
    _init_repo_with_files(
        repo_dir,
        {
            "文档.md": "hello\n",
            "README.md": "world\n",
        },
    )

    blob_map = get_file_blob_map(repo_dir)

    assert "文档.md" in blob_map
    assert set(blob_map.keys()) == {"文档.md", "README.md"}

    md_files = list_md_files(blob_map)
    assert set(md_files) == {"文档.md", "README.md"}


def test_get_file_blob_map_empty_repo_with_no_commits_raises(tmp_path: Path) -> None:
    repo_dir = tmp_path / "empty_repo"
    repo_dir.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "main", str(repo_dir)], check=True)

    with pytest.raises(subprocess.CalledProcessError):
        get_file_blob_map(repo_dir)


def test_list_md_files_filters_only_md() -> None:
    blob_map = {
        "README.md": "hash1",
        "docs/guide.md": "hash2",
        "script.py": "hash3",
        "notes.md.bak": "hash4",
    }

    md_files = list_md_files(blob_map)

    assert set(md_files) == {"README.md", "docs/guide.md"}


def test_list_md_files_empty_map_returns_empty_list() -> None:
    assert list_md_files({}) == []


def test_clone_invokes_git_clone_and_succeeds(tmp_path: Path) -> None:
    src_repo = tmp_path / "src"
    _init_repo_with_files(src_repo, {"a.md": "content\n"})
    dest = tmp_path / "cloned"

    clone(str(src_repo), dest)

    assert (dest / ".git").exists()
    assert (dest / "a.md").read_text() == "content\n"


def test_clone_failure_raises_git_operation_error(tmp_path: Path) -> None:
    dest = tmp_path / "cloned"

    with pytest.raises(GitOperationError):
        clone("/nonexistent/path/to/repo", dest)


def test_pull_failure_raises_git_operation_error(tmp_path: Path) -> None:
    # A directory that is not a git repo at all -> `git -C ... pull` fails.
    not_a_repo = tmp_path / "not_a_repo"
    not_a_repo.mkdir()

    with pytest.raises(GitOperationError):
        pull(not_a_repo)


def test_pull_succeeds_on_real_repo_with_remote(tmp_path: Path) -> None:
    src_repo = tmp_path / "src"
    _init_repo_with_files(src_repo, {"a.md": "v1\n"})

    cloned = tmp_path / "cloned"
    clone(str(src_repo), cloned)

    # Make a new commit in src, then pull it into cloned.
    (src_repo / "a.md").write_text("v2\n")
    subprocess.run(["git", "-C", str(src_repo), "add", "-A"], check=True)
    subprocess.run(
        ["git", "-C", str(src_repo), "commit", "-q", "-m", "update"], check=True
    )

    pull(cloned)

    assert (cloned / "a.md").read_text() == "v2\n"


def test_clone_or_pull_external_repo_does_not_clone_or_pull(tmp_path: Path) -> None:
    external_dir = tmp_path / "external"
    external_dir.mkdir()
    repo_config = RepoConfig(name="external-repo", path=str(external_dir))
    repos_dir = tmp_path / "managed_repos"

    with patch("repo_translator.git_manager.clone") as mock_clone, patch(
        "repo_translator.git_manager.pull"
    ) as mock_pull:
        result = clone_or_pull(repo_config, repos_dir)

    mock_clone.assert_not_called()
    mock_pull.assert_not_called()
    assert result == external_dir


def test_clone_or_pull_external_repo_expands_user(tmp_path: Path) -> None:
    repo_config = RepoConfig(name="external-repo", path="~/some/external/repo")
    repos_dir = tmp_path / "managed_repos"

    with patch("repo_translator.git_manager.clone") as mock_clone, patch(
        "repo_translator.git_manager.pull"
    ) as mock_pull:
        result = clone_or_pull(repo_config, repos_dir)

    mock_clone.assert_not_called()
    mock_pull.assert_not_called()
    assert result == Path("~/some/external/repo").expanduser()


def test_clone_or_pull_managed_repo_clones_on_first_call(tmp_path: Path) -> None:
    src_repo = tmp_path / "src"
    _init_repo_with_files(src_repo, {"a.md": "content\n"})

    repo_config = RepoConfig(name="managed-repo", url=str(src_repo))
    repos_dir = tmp_path / "managed_repos"

    with patch("repo_translator.git_manager.clone") as mock_clone, patch(
        "repo_translator.git_manager.pull"
    ) as mock_pull:
        result = clone_or_pull(repo_config, repos_dir)

    mock_clone.assert_called_once_with(str(src_repo), repos_dir / "managed-repo")
    mock_pull.assert_not_called()
    assert result == repos_dir / "managed-repo"


def test_clone_or_pull_managed_repo_pulls_when_already_cloned(tmp_path: Path) -> None:
    src_repo = tmp_path / "src"
    _init_repo_with_files(src_repo, {"a.md": "content\n"})

    repo_config = RepoConfig(name="managed-repo", url=str(src_repo))
    repos_dir = tmp_path / "managed_repos"
    dest = repos_dir / "managed-repo"

    # Actually clone first (real git call) so `.git` exists at dest.
    clone(str(src_repo), dest)

    with patch("repo_translator.git_manager.clone") as mock_clone, patch(
        "repo_translator.git_manager.pull"
    ) as mock_pull:
        result = clone_or_pull(repo_config, repos_dir)

    mock_clone.assert_not_called()
    mock_pull.assert_called_once_with(dest)
    assert result == dest


def test_clone_or_pull_recovers_from_stale_partial_dest(tmp_path: Path) -> None:
    """A dest dir left behind by a previously interrupted clone (exists, but
    no .git inside) must not permanently block future clone attempts."""
    src_repo = tmp_path / "src"
    _init_repo_with_files(src_repo, {"a.md": "content\n"})

    repo_config = RepoConfig(name="managed-repo", url=str(src_repo))
    repos_dir = tmp_path / "managed_repos"
    dest = repos_dir / "managed-repo"

    # Simulate a partial/interrupted clone: dest exists, non-empty, no .git.
    dest.mkdir(parents=True)
    (dest / "leftover.tmp").write_text("partial clone debris\n")
    assert dest.exists()
    assert not (dest / ".git").exists()

    result = clone_or_pull(repo_config, repos_dir)

    assert result == dest
    assert (dest / ".git").exists()
    assert (dest / "a.md").read_text() == "content\n"
    assert not (dest / "leftover.tmp").exists()


def test_clone_or_pull_managed_repo_end_to_end_real_git(tmp_path: Path) -> None:
    """No mocking: real clone then real pull picks up a new commit."""
    src_repo = tmp_path / "src"
    _init_repo_with_files(src_repo, {"a.md": "v1\n"})

    repo_config = RepoConfig(name="managed-repo", url=str(src_repo))
    repos_dir = tmp_path / "managed_repos"

    first_result = clone_or_pull(repo_config, repos_dir)
    assert first_result == repos_dir / "managed-repo"
    assert (first_result / "a.md").read_text() == "v1\n"

    (src_repo / "a.md").write_text("v2\n")
    subprocess.run(["git", "-C", str(src_repo), "add", "-A"], check=True)
    subprocess.run(
        ["git", "-C", str(src_repo), "commit", "-q", "-m", "update"], check=True
    )

    second_result = clone_or_pull(repo_config, repos_dir)
    assert second_result == first_result
    assert (second_result / "a.md").read_text() == "v2\n"
