"""Git operations (clone/pull/blob-hash lookups) via subprocess calls to the system git binary.

Design decisions (see SCRATCH.md §2, §2.1):
- No GitPython/pygit2 dependency — shell out to the system `git` binary directly.
- `get_file_blob_map` makes a single `git ls-tree -r HEAD` call to build a full
  `{path: blob_hash}` map for the repo, instead of issuing one `git` call per file.
- Managed repos (`RepoConfig.url` set) are cloned into `repos_dir/<name>` on first
  sync and `pull`ed afterwards. External repos (`RepoConfig.path` set) are never
  cloned or pulled — they're treated as read-only, pre-existing local checkouts.
- Any failed `clone`/`pull` raises `GitOperationError`, which `sync.py` is expected
  to catch and handle by skipping that sync cycle and retrying on the next poll
  (design.md §5.3).
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from repo_translator.config import RepoConfig


class GitOperationError(Exception):
    """Raised when a git subprocess invocation (clone/pull) fails.

    `sync.py` is expected to catch this and skip the current sync cycle,
    retrying on the next poll (design.md §5.3).
    """


def clone(url: str, dest: Path) -> None:
    """Clone `url` into `dest`. Raises GitOperationError on failure."""
    try:
        subprocess.run(
            ["git", "clone", url, str(dest)],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise GitOperationError(
            f"git clone failed for {url!r} -> {dest!r}: {exc.stderr}"
        ) from exc


def pull(repo_path: Path) -> None:
    """Run `git pull` in `repo_path`. Raises GitOperationError on failure."""
    try:
        subprocess.run(
            ["git", "-C", str(repo_path), "pull"],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise GitOperationError(
            f"git pull failed in {repo_path!r}: {exc.stderr}"
        ) from exc


def get_file_blob_map(repo_path: Path) -> dict[str, str]:
    """Return a `{file_path: blob_hash}` map for all files at HEAD.

    Uses a single `git ls-tree -r HEAD` call. Each output line has the form:
        <mode> <type> <hash>\t<path>
    (mode/type/hash are space-separated; a single tab separates hash from path).

    Passes `-c core.quotePath=false` so paths containing non-ASCII bytes (or
    tabs/backslashes/quotes) are emitted as literal UTF-8 rather than
    C-style quoted, octal-escaped strings (git's default `core.quotePath=true`
    behavior), which would otherwise cause such paths to be mangled.
    """
    result = subprocess.run(
        [
            "git",
            "-c",
            "core.quotePath=false",
            "-C",
            str(repo_path),
            "ls-tree",
            "-r",
            "HEAD",
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    blob_map: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        meta, _, path = line.partition("\t")
        # meta == "<mode> <type> <hash>"
        parts = meta.split()
        if len(parts) != 3:
            continue
        _mode, _obj_type, blob_hash = parts
        blob_map[path] = blob_hash
    return blob_map


def list_md_files(file_blob_map: dict[str, str]) -> list[str]:
    """Filter a `{path: blob_hash}` map down to `.md` file paths."""
    return [path for path in file_blob_map if path.endswith(".md")]


def clone_or_pull(repo_config: "RepoConfig", repos_dir: Path) -> Path:
    """Ensure `repo_config` is available locally and return its local path.

    - Managed repos (`repo_config.is_managed`): clone into
      `repos_dir/<name>` on first use, `pull` on subsequent calls. The
      presence of `repos_dir/<name>/.git` is used to detect whether the
      repo has already been cloned.
    - External repos (`repo_config.is_external`): never cloned or pulled;
      the configured `path` (expanded via `Path.expanduser()`) is returned
      as-is.

    If `dest` exists but `dest/.git` does not, `dest` is treated as a
    stale/partial directory left behind by a previous interrupted `clone()`
    (e.g. process killed mid-clone) and is removed before cloning again,
    since `git clone` refuses to clone into a non-empty directory.
    """
    if repo_config.is_external:
        assert repo_config.path is not None  # guaranteed by RepoConfig validator
        return Path(repo_config.path).expanduser()

    assert repo_config.url is not None  # guaranteed by RepoConfig validator
    dest = repos_dir / repo_config.name
    git_dir = dest / ".git"

    if git_dir.exists():
        pull(dest)
    else:
        if dest.exists():
            # Stale/partial directory from a previously interrupted clone.
            shutil.rmtree(dest)
        clone(repo_config.url, dest)

    return dest
