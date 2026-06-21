"""Tests for repo_translator.usage_manager."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from repo_translator.usage_manager import load, record, save


def test_load_returns_empty_skeleton_when_file_missing(tmp_path: Path) -> None:
    usage_path = tmp_path / "usage.json"

    assert load(usage_path) == {"daily": {}, "repos": {}}


def test_load_parses_existing_json_file(tmp_path: Path) -> None:
    usage_path = tmp_path / "usage.json"
    data = {
        "daily": {
            "2026-06-21": {
                "deepseek": {"prompt_tokens": 100, "completion_tokens": 50, "files": 1}
            }
        },
        "repos": {
            "langchain": {
                "deepseek": {"prompt_tokens": 100, "completion_tokens": 50, "files": 1}
            }
        },
    }
    usage_path.write_text(json.dumps(data), encoding="utf-8")

    assert load(usage_path) == data


def test_save_then_load_round_trips(tmp_path: Path) -> None:
    usage_path = tmp_path / "usage.json"
    data = {
        "daily": {"2026-06-21": {"openai": {"prompt_tokens": 10, "completion_tokens": 5, "files": 1}}},
        "repos": {"my-repo": {"openai": {"prompt_tokens": 10, "completion_tokens": 5, "files": 1}}},
    }

    save(usage_path, data)
    loaded = load(usage_path)

    assert loaded == data


def test_save_creates_parent_directories(tmp_path: Path) -> None:
    usage_path = tmp_path / "nested" / "dir" / "usage.json"

    save(usage_path, {"daily": {}, "repos": {}})

    assert usage_path.exists()
    assert load(usage_path) == {"daily": {}, "repos": {}}


def test_save_writes_non_ascii_content_readable(tmp_path: Path) -> None:
    usage_path = tmp_path / "usage.json"
    data = {"daily": {}, "repos": {"文档repo": {"claude": {"prompt_tokens": 1, "completion_tokens": 1, "files": 1}}}}

    save(usage_path, data)

    assert load(usage_path) == data
    raw = usage_path.read_text(encoding="utf-8")
    assert "文档repo" in raw


def test_save_leaves_existing_usage_untouched_when_interrupted_before_replace(
    tmp_path: Path,
) -> None:
    """Mirrors cache_manager's atomic-write regression test: the original
    usage.json must be left fully intact if os.replace() fails mid-save."""
    usage_path = tmp_path / "usage.json"
    original_data = {"daily": {"2026-06-21": {"deepseek": {"prompt_tokens": 1, "completion_tokens": 1, "files": 1}}}, "repos": {}}
    save(usage_path, original_data)

    new_data = {"daily": {}, "repos": {}}

    with patch(
        "repo_translator.usage_manager.os.replace",
        side_effect=OSError("simulated interruption before replace"),
    ):
        with pytest.raises(OSError, match="simulated interruption"):
            save(usage_path, new_data)

    assert load(usage_path) == original_data

    leftover_tmp_files = [p for p in tmp_path.iterdir() if p.name != "usage.json"]
    assert leftover_tmp_files == []


def test_save_writes_to_same_directory_as_target_then_replaces(tmp_path: Path) -> None:
    usage_path = tmp_path / "usage.json"
    data = {"daily": {}, "repos": {}}

    seen_tmp_dirs = []
    real_replace = __import__("os").replace

    def spy_replace(src, dst):
        seen_tmp_dirs.append(Path(src).parent)
        return real_replace(src, dst)

    with patch("repo_translator.usage_manager.os.replace", side_effect=spy_replace):
        save(usage_path, data)

    assert seen_tmp_dirs == [tmp_path]
    assert load(usage_path) == data
    assert [p.name for p in tmp_path.iterdir()] == ["usage.json"]


# ---------------------------------------------------------------------------
# record()
# ---------------------------------------------------------------------------


def test_record_creates_both_daily_and_repo_entries_from_empty() -> None:
    usage: dict = {}

    result = record(usage, "langchain", "deepseek", "2026-06-21", 100, 50)

    assert result == {
        "daily": {
            "2026-06-21": {
                "deepseek": {"prompt_tokens": 100, "completion_tokens": 50, "files": 1}
            }
        },
        "repos": {
            "langchain": {
                "deepseek": {"prompt_tokens": 100, "completion_tokens": 50, "files": 1}
            }
        },
    }
    # Mutates and returns the same object.
    assert result is usage


def test_record_accumulates_across_multiple_calls_same_day_same_engine() -> None:
    usage: dict = {}
    record(usage, "langchain", "deepseek", "2026-06-21", 100, 50)
    record(usage, "langchain", "deepseek", "2026-06-21", 30, 10)

    assert usage["daily"]["2026-06-21"]["deepseek"] == {
        "prompt_tokens": 130,
        "completion_tokens": 60,
        "files": 2,
    }
    assert usage["repos"]["langchain"]["deepseek"] == {
        "prompt_tokens": 130,
        "completion_tokens": 60,
        "files": 2,
    }


def test_record_separates_different_engines_within_same_day_and_repo() -> None:
    usage: dict = {}
    record(usage, "langchain", "deepseek", "2026-06-21", 100, 50)
    record(usage, "langchain", "claude", "2026-06-21", 20, 5)

    assert usage["daily"]["2026-06-21"]["deepseek"]["files"] == 1
    assert usage["daily"]["2026-06-21"]["claude"]["files"] == 1
    assert usage["repos"]["langchain"]["deepseek"]["files"] == 1
    assert usage["repos"]["langchain"]["claude"]["files"] == 1


def test_record_separates_different_days() -> None:
    usage: dict = {}
    record(usage, "langchain", "deepseek", "2026-06-20", 100, 50)
    record(usage, "langchain", "deepseek", "2026-06-21", 5, 5)

    assert usage["daily"]["2026-06-20"]["deepseek"]["prompt_tokens"] == 100
    assert usage["daily"]["2026-06-21"]["deepseek"]["prompt_tokens"] == 5


def test_record_separates_different_repos() -> None:
    usage: dict = {}
    record(usage, "repo-a", "deepseek", "2026-06-21", 100, 50)
    record(usage, "repo-b", "deepseek", "2026-06-21", 7, 3)

    assert usage["repos"]["repo-a"]["deepseek"]["prompt_tokens"] == 100
    assert usage["repos"]["repo-b"]["deepseek"]["prompt_tokens"] == 7
    # Daily view aggregates across repos for the same day/engine.
    assert usage["daily"]["2026-06-21"]["deepseek"]["prompt_tokens"] == 107


def test_record_then_save_then_load_round_trips(tmp_path: Path) -> None:
    usage_path = tmp_path / "usage.json"
    usage: dict = {}
    record(usage, "langchain", "deepseek", "2026-06-21", 100, 50)

    save(usage_path, usage)
    loaded = load(usage_path)

    assert loaded == usage
