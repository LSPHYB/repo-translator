"""Incremental-translation cache (cache.json) read/write and diffing helpers.

Schema reference: repo-translator-design.md §3.2 (CacheManager) and §4.2
(cache.json data structure):

    {
      "<repo_name>": {
        "<file_path>": {
          "blob_hash": "<git blob sha>",
          "translated_at": "<ISO8601 timestamp string>"
        },
        ...
      },
      ...
    }

Design notes:
- `get_changed_files` always restricts its result to `.md` files, regardless
  of what `file_blob_map` contains. Callers (e.g. `sync.py`) are expected to
  pass the full per-repo blob map (as returned by
  `git_manager.get_file_blob_map`), which may include non-`.md` files
  (`.py`, `.txt`, etc.) that are never translated and must never trigger a
  "changed" result. Filtering here makes the function correct on its own,
  independent of whether a caller has already pre-filtered.
- A file counts as "changed" if it's a `.md` file and either:
    - `repo_name` has no cache entry at all (first translation -> every
      `.md` file is "changed"), or
    - the file has no cached record for `repo_name`, or
    - the cached `blob_hash` differs from the current one in `file_blob_map`.
"""

from __future__ import annotations

import json
from pathlib import Path


def load(cache_path: Path) -> dict:
    """Load and parse `cache_path` as JSON. Returns `{}` if the file doesn't exist."""
    if not cache_path.exists():
        return {}
    with cache_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save(cache_path: Path, data: dict) -> None:
    """Write `data` to `cache_path` as JSON, creating parent dirs if needed."""
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with cache_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def get_changed_files(
    repo_name: str, file_blob_map: dict[str, str], cache: dict
) -> list[str]:
    """Return the `.md` files in `file_blob_map` that have changed since the
    last translation of `repo_name`.

    A `.md` file is considered changed if `repo_name` has no cache entry at
    all (first translation), the file itself has no cached record, or its
    cached `blob_hash` doesn't match the current one in `file_blob_map`.
    """
    repo_cache = cache.get(repo_name)
    md_files = [path for path in file_blob_map if path.endswith(".md")]

    if repo_cache is None:
        return md_files

    changed = []
    for path in md_files:
        record = repo_cache.get(path)
        if record is None or record.get("blob_hash") != file_blob_map[path]:
            changed.append(path)
    return changed


def update(
    cache: dict, repo_name: str, file_path: str, blob_hash: str, translated_at: str
) -> dict:
    """Write/update the cache record for `file_path` under `repo_name`.

    Mutates and returns `cache`.
    """
    repo_cache = cache.setdefault(repo_name, {})
    repo_cache[file_path] = {"blob_hash": blob_hash, "translated_at": translated_at}
    return cache
