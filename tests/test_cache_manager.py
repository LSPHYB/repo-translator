"""Tests for repo_translator.cache_manager."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from repo_translator.cache_manager import (
    get_changed_files,
    load,
    record_error,
    save,
    update,
)


def test_load_returns_empty_dict_when_file_missing(tmp_path: Path) -> None:
    cache_path = tmp_path / "cache.json"

    assert load(cache_path) == {}


def test_load_parses_existing_json_file(tmp_path: Path) -> None:
    cache_path = tmp_path / "cache.json"
    data = {
        "langchain": {
            "README.md": {
                "blob_hash": "abc123",
                "translated_at": "2026-06-12T10:30:00Z",
            }
        }
    }
    cache_path.write_text(json.dumps(data), encoding="utf-8")

    assert load(cache_path) == data


def test_save_then_load_round_trips(tmp_path: Path) -> None:
    cache_path = tmp_path / "cache.json"
    data = {
        "langchain": {
            "README.md": {
                "blob_hash": "abc123",
                "translated_at": "2026-06-12T10:30:00Z",
            },
            "docs/intro.md": {
                "blob_hash": "def456",
                "translated_at": "2026-06-12T10:31:00Z",
            },
        }
    }

    save(cache_path, data)
    loaded = load(cache_path)

    assert loaded == data


def test_save_creates_parent_directories(tmp_path: Path) -> None:
    cache_path = tmp_path / "nested" / "dir" / "cache.json"

    save(cache_path, {"repo": {}})

    assert cache_path.exists()
    assert load(cache_path) == {"repo": {}}


def test_save_writes_non_ascii_content_readable(tmp_path: Path) -> None:
    cache_path = tmp_path / "cache.json"
    data = {"repo": {"文档.md": {"blob_hash": "abc", "translated_at": "now"}}}

    save(cache_path, data)

    assert load(cache_path) == data
    # Confirm it's written as readable UTF-8, not escaped \uXXXX sequences.
    raw = cache_path.read_text(encoding="utf-8")
    assert "文档.md" in raw


def test_save_leaves_existing_cache_untouched_when_interrupted_before_replace(
    tmp_path: Path,
) -> None:
    """Simulates the process being killed after the temp file is written but
    before the atomic `os.replace()` happens (or `os.replace()` itself
    failing, e.g. disk full). The original `cache.json` must be left fully
    intact -- never truncated or partially overwritten.
    """
    cache_path = tmp_path / "cache.json"
    original_data = {
        "langchain": {
            "README.md": {
                "blob_hash": "original_hash",
                "translated_at": "2026-06-12T10:30:00Z",
            }
        }
    }
    save(cache_path, original_data)

    new_data = {"langchain": {"README.md": {"blob_hash": "new_hash"}}}

    with patch(
        "repo_translator.cache_manager.os.replace",
        side_effect=OSError("simulated interruption before replace"),
    ):
        with pytest.raises(OSError, match="simulated interruption"):
            save(cache_path, new_data)

    # Original file must be completely intact, not truncated/corrupted.
    assert load(cache_path) == original_data

    # No leftover temp files in the cache directory.
    leftover_tmp_files = [
        p for p in tmp_path.iterdir() if p.name != "cache.json"
    ]
    assert leftover_tmp_files == []


def test_save_writes_to_same_directory_as_target_then_replaces(
    tmp_path: Path,
) -> None:
    """Regression test: the temp file used for the atomic write must live in
    the same directory as `cache_path` (required for `os.replace` to be
    atomic across what could otherwise be different filesystems), and after
    a successful `save()` no temp file should remain behind.
    """
    cache_path = tmp_path / "cache.json"
    data = {"langchain": {"README.md": {"blob_hash": "abc"}}}

    seen_tmp_dirs = []
    real_replace = __import__("os").replace

    def spy_replace(src, dst):
        seen_tmp_dirs.append(Path(src).parent)
        return real_replace(src, dst)

    with patch("repo_translator.cache_manager.os.replace", side_effect=spy_replace):
        save(cache_path, data)

    assert seen_tmp_dirs == [tmp_path]
    # Final result is correct and no temp files are left behind.
    assert load(cache_path) == data
    assert [p.name for p in tmp_path.iterdir()] == ["cache.json"]


def test_get_changed_files_first_translation_returns_all_md_files() -> None:
    file_blob_map = {
        "README.md": "hash1",
        "docs/intro.md": "hash2",
        "script.py": "hash3",
    }
    cache: dict = {}

    changed = get_changed_files("langchain", file_blob_map, cache)

    assert set(changed) == {"README.md", "docs/intro.md"}


def test_get_changed_files_skips_files_with_unchanged_hash() -> None:
    file_blob_map = {
        "README.md": "hash1",
        "docs/intro.md": "hash2",
    }
    cache = {
        "langchain": {
            "README.md": {
                "blob_hash": "hash1",
                "translated_at": "2026-06-12T10:30:00Z",
            },
            "docs/intro.md": {
                "blob_hash": "hash2",
                "translated_at": "2026-06-12T10:31:00Z",
            },
        }
    }

    changed = get_changed_files("langchain", file_blob_map, cache)

    assert changed == []


def test_get_changed_files_detects_hash_change_for_some_files() -> None:
    file_blob_map = {
        "README.md": "hash1_new",  # changed
        "docs/intro.md": "hash2",  # unchanged
        "docs/new_file.md": "hash3",  # never seen before
    }
    cache = {
        "langchain": {
            "README.md": {
                "blob_hash": "hash1_old",
                "translated_at": "2026-06-12T10:30:00Z",
            },
            "docs/intro.md": {
                "blob_hash": "hash2",
                "translated_at": "2026-06-12T10:31:00Z",
            },
        }
    }

    changed = get_changed_files("langchain", file_blob_map, cache)

    assert set(changed) == {"README.md", "docs/new_file.md"}


def test_get_changed_files_ignores_non_md_files_on_first_translation() -> None:
    file_blob_map = {
        "script.py": "hash1",
        "notes.txt": "hash2",
    }
    cache: dict = {}

    changed = get_changed_files("langchain", file_blob_map, cache)

    assert changed == []


def test_get_changed_files_ignores_non_md_files_when_changed() -> None:
    file_blob_map = {
        "README.md": "hash1",
        "script.py": "hash_changed",
    }
    cache = {
        "langchain": {
            "README.md": {
                "blob_hash": "hash1",
                "translated_at": "2026-06-12T10:30:00Z",
            },
            "script.py": {
                "blob_hash": "hash_old",
                "translated_at": "2026-06-12T10:30:00Z",
            },
        }
    }

    changed = get_changed_files("langchain", file_blob_map, cache)

    assert changed == []


def test_get_changed_files_other_repo_unaffected_by_unrelated_cache() -> None:
    file_blob_map = {"README.md": "hash1"}
    cache = {
        "other-repo": {
            "README.md": {"blob_hash": "hash1", "translated_at": "2026-06-12T10:30:00Z"}
        }
    }

    changed = get_changed_files("langchain", file_blob_map, cache)

    assert changed == ["README.md"]


def test_update_adds_new_record_to_empty_cache() -> None:
    cache: dict = {}

    result = update(cache, "langchain", "README.md", "hash1", "2026-06-12T10:30:00Z")

    assert result == {
        "langchain": {
            "README.md": {
                "blob_hash": "hash1",
                "translated_at": "2026-06-12T10:30:00Z",
            }
        }
    }
    # Mutates and returns the same object.
    assert result is cache


def test_update_overwrites_existing_record() -> None:
    cache = {
        "langchain": {
            "README.md": {
                "blob_hash": "old_hash",
                "translated_at": "2026-06-12T10:30:00Z",
            }
        }
    }

    update(cache, "langchain", "README.md", "new_hash", "2026-06-13T09:00:00Z")

    assert cache["langchain"]["README.md"] == {
        "blob_hash": "new_hash",
        "translated_at": "2026-06-13T09:00:00Z",
    }


def test_update_preserves_other_files_and_repos() -> None:
    cache = {
        "langchain": {
            "README.md": {"blob_hash": "hash1", "translated_at": "t1"},
        },
        "other-repo": {
            "docs.md": {"blob_hash": "hashX", "translated_at": "tX"},
        },
    }

    update(cache, "langchain", "docs/intro.md", "hash2", "t2")

    assert cache["langchain"]["README.md"] == {
        "blob_hash": "hash1",
        "translated_at": "t1",
    }
    assert cache["langchain"]["docs/intro.md"] == {
        "blob_hash": "hash2",
        "translated_at": "t2",
    }
    assert cache["other-repo"]["docs.md"] == {
        "blob_hash": "hashX",
        "translated_at": "tX",
    }


def test_record_error_creates_error_only_record_for_never_succeeded_file() -> None:
    cache: dict = {}

    result = record_error(
        cache, "langchain", "docs/guide.md", "boom", "2026-06-21T10:00:00Z"
    )

    assert result == {
        "langchain": {
            "docs/guide.md": {
                "last_error": {"message": "boom", "occurred_at": "2026-06-21T10:00:00Z"}
            }
        }
    }
    # Mutates and returns the same object.
    assert result is cache
    # No blob_hash key at all -- get_changed_files must treat this as changed.
    assert "blob_hash" not in cache["langchain"]["docs/guide.md"]


def test_record_error_preserves_existing_blob_hash_and_translated_at() -> None:
    cache = {
        "langchain": {
            "docs/guide.md": {
                "blob_hash": "old_hash",
                "translated_at": "2026-06-12T10:30:00Z",
            }
        }
    }

    record_error(cache, "langchain", "docs/guide.md", "timeout", "2026-06-21T10:00:00Z")

    record = cache["langchain"]["docs/guide.md"]
    assert record["blob_hash"] == "old_hash"
    assert record["translated_at"] == "2026-06-12T10:30:00Z"
    assert record["last_error"] == {
        "message": "timeout",
        "occurred_at": "2026-06-21T10:00:00Z",
    }


def test_record_error_then_get_changed_files_reports_file_as_changed() -> None:
    """A file with only an error record (never successfully translated) must
    still be reported as 'changed' by get_changed_files, since its blob_hash
    never matches anything."""
    cache: dict = {}
    record_error(cache, "langchain", "docs/guide.md", "boom", "2026-06-21T10:00:00Z")

    file_blob_map = {"docs/guide.md": "hash1"}
    changed = get_changed_files("langchain", file_blob_map, cache)

    assert changed == ["docs/guide.md"]


def test_record_error_overwrites_previous_error_message() -> None:
    cache: dict = {}
    record_error(cache, "langchain", "docs/guide.md", "first failure", "t1")
    record_error(cache, "langchain", "docs/guide.md", "second failure", "t2")

    assert cache["langchain"]["docs/guide.md"]["last_error"] == {
        "message": "second failure",
        "occurred_at": "t2",
    }


def test_update_after_record_error_clears_stale_last_error() -> None:
    """A subsequent successful translation must clear any stale last_error,
    since update() replaces the whole per-file record wholesale."""
    cache: dict = {}
    record_error(cache, "langchain", "docs/guide.md", "boom", "t1")

    update(cache, "langchain", "docs/guide.md", "hash1", "t2")

    assert cache["langchain"]["docs/guide.md"] == {
        "blob_hash": "hash1",
        "translated_at": "t2",
    }
    assert "last_error" not in cache["langchain"]["docs/guide.md"]


def test_end_to_end_first_translation_then_partial_rechange(tmp_path: Path) -> None:
    """Integration scenario combining load/save/get_changed_files/update:

    1. First translation of a repo: all .md files are "changed".
    2. After translating and updating+saving the cache, a second diff with
       the same blob map yields no changed files.
    3. Changing one file's hash makes only that file "changed" again.
    """
    cache_path = tmp_path / "cache.json"
    repo_name = "langchain"

    file_blob_map = {
        "README.md": "hash1",
        "docs/intro.md": "hash2",
        "script.py": "hash3",
    }

    # 1. First translation: cache.json doesn't exist yet.
    cache = load(cache_path)
    changed = get_changed_files(repo_name, file_blob_map, cache)
    assert set(changed) == {"README.md", "docs/intro.md"}

    for path in changed:
        cache = update(cache, repo_name, path, file_blob_map[path], "2026-06-12T10:30:00Z")
    save(cache_path, cache)

    # 2. Second run, nothing changed upstream.
    cache_reloaded = load(cache_path)
    changed_again = get_changed_files(repo_name, file_blob_map, cache_reloaded)
    assert changed_again == []

    # 3. One file's content (and thus blob hash) changes.
    file_blob_map_v2 = dict(file_blob_map)
    file_blob_map_v2["docs/intro.md"] = "hash2_v2"

    changed_v2 = get_changed_files(repo_name, file_blob_map_v2, cache_reloaded)
    assert changed_v2 == ["docs/intro.md"]
