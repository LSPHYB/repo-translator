"""Tests for repo_translator.scheduler -- watch-mode job registration.

These tests never call `BlockingScheduler.start()` (it blocks forever).
Instead they patch it to a no-op and introspect the jobs APScheduler
registered via `scheduler.get_jobs()`, calling each job's `.func()` directly
to exercise the per-repo job body without waiting for real intervals.
"""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

import pytest

from repo_translator import scheduler
from repo_translator.config import AppConfig, RepoConfig, SyncConfig
from repo_translator.scheduler import start_background, stop_background


def _make_app_config(num_repos: int, interval_hours: int = 6) -> AppConfig:
    repos = [
        RepoConfig(name=f"repo{i}", url=f"https://example.com/repo{i}.git")
        for i in range(num_repos)
    ]
    return AppConfig(repos=repos, sync=SyncConfig(interval_hours=interval_hours))


def _captured_jobs(app_config: AppConfig, interval_override: int | None = None):
    """Run `run_watch` with `BlockingScheduler.start` patched out, returning
    the list of registered jobs (via `get_jobs()`) for inspection."""
    captured: list = []

    def _fake_start(self) -> None:
        captured.extend(self.get_jobs())

    with patch(
        "repo_translator.scheduler.BlockingScheduler.start", _fake_start
    ):
        scheduler.run_watch(app_config, interval_override)

    return captured


# ---------------------------------------------------------------------------
# Job registration
# ---------------------------------------------------------------------------


def test_run_watch_registers_one_job_per_repo() -> None:
    app_config = _make_app_config(3)

    jobs = _captured_jobs(app_config)

    assert len(jobs) == 3
    assert {job.id for job in jobs} == {"repo0", "repo1", "repo2"}


def test_run_watch_uses_default_interval_when_no_override() -> None:
    app_config = _make_app_config(1, interval_hours=12)

    jobs = _captured_jobs(app_config, interval_override=None)

    assert len(jobs) == 1
    trigger = jobs[0].trigger
    assert trigger.interval.total_seconds() == 12 * 3600


def test_run_watch_interval_override_takes_precedence() -> None:
    app_config = _make_app_config(1, interval_hours=12)

    jobs = _captured_jobs(app_config, interval_override=2)

    assert len(jobs) == 1
    trigger = jobs[0].trigger
    assert trigger.interval.total_seconds() == 2 * 3600


def test_run_watch_with_no_repos_registers_no_jobs() -> None:
    app_config = _make_app_config(0)

    jobs = _captured_jobs(app_config)

    assert jobs == []


# ---------------------------------------------------------------------------
# Job body behavior: load -> sync -> save, exceptions swallowed
# ---------------------------------------------------------------------------


def test_job_calls_sync_repo_and_saves_cache(tmp_path: Path) -> None:
    cache_path = tmp_path / "cache.json"
    usage_path = tmp_path / "usage.json"
    app_config = _make_app_config(1)

    fake_cache = {"loaded": True}
    updated_cache = {"loaded": True, "synced": True}
    fake_usage = {"daily": {}, "repos": {}}

    with patch(
        "repo_translator.scheduler.DEFAULT_CACHE_PATH", cache_path
    ), patch(
        "repo_translator.scheduler.DEFAULT_USAGE_PATH", usage_path
    ), patch(
        "repo_translator.scheduler.cache_manager.load", return_value=fake_cache
    ) as mock_load, patch(
        "repo_translator.scheduler.usage_manager.load", return_value=fake_usage
    ) as mock_usage_load, patch(
        "repo_translator.scheduler.sync.sync_repo", return_value=updated_cache
    ) as mock_sync, patch(
        "repo_translator.scheduler.cache_manager.save"
    ) as mock_save, patch(
        "repo_translator.scheduler.usage_manager.save"
    ) as mock_usage_save:
        jobs = _captured_jobs(app_config)
        assert len(jobs) == 1
        jobs[0].func()

    mock_load.assert_called_once_with(cache_path)
    mock_usage_load.assert_called_once_with(usage_path)
    mock_sync.assert_called_once_with(
        app_config.repos[0], app_config, fake_cache, usage=fake_usage
    )
    mock_save.assert_called_once_with(cache_path, updated_cache)
    mock_usage_save.assert_called_once_with(usage_path, fake_usage)


def test_one_job_exception_does_not_prevent_other_jobs_from_running() -> None:
    """A failing job's sync_repo call should not stop sibling jobs."""
    app_config = _make_app_config(3)

    calls: list[str] = []

    def _fake_sync_repo(repo_config, app_cfg, cache, **kwargs):
        calls.append(repo_config.name)
        if repo_config.name == "repo1":
            raise RuntimeError("simulated sync failure")
        return cache

    with patch("repo_translator.scheduler.cache_manager.load", return_value={}), \
         patch("repo_translator.scheduler.usage_manager.load", return_value={}), \
         patch("repo_translator.scheduler.cache_manager.save"), \
         patch("repo_translator.scheduler.usage_manager.save"), \
         patch("repo_translator.scheduler.sync.sync_repo", side_effect=_fake_sync_repo):
        jobs = _captured_jobs(app_config)
        assert len(jobs) == 3

        # Call every job's function directly -- none should raise, even
        # though repo1's underlying sync_repo blows up.
        for job in jobs:
            job.func()

    assert sorted(calls) == ["repo0", "repo1", "repo2"]


def test_job_exception_is_logged_not_raised(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    app_config = _make_app_config(1)

    with patch("repo_translator.scheduler.cache_manager.load", return_value={}), \
         patch("repo_translator.scheduler.usage_manager.load", return_value={}), \
         patch("repo_translator.scheduler.cache_manager.save"), \
         patch("repo_translator.scheduler.usage_manager.save"), \
         patch(
             "repo_translator.scheduler.sync.sync_repo",
             side_effect=RuntimeError("boom"),
         ):
        jobs = _captured_jobs(app_config)
        assert len(jobs) == 1

        with caplog.at_level("ERROR", logger="repo_translator.scheduler"):
            jobs[0].func()  # must not raise

    assert "repo0" in caplog.text


# ---------------------------------------------------------------------------
# Non-blocking background scheduler (used by the desktop API server)
# ---------------------------------------------------------------------------


def test_start_background_registers_one_job_per_repo(tmp_path: Path) -> None:
    app_config = AppConfig(
        repos=[
            RepoConfig(name="a", path=str(tmp_path / "a")),
            RepoConfig(name="b", path=str(tmp_path / "b")),
        ],
        sync=SyncConfig(interval_hours=6),
    )
    bg = start_background(app_config)
    try:
        jobs = {j.id: j for j in bg.get_jobs()}
        assert set(jobs) == {"a", "b"}
        assert jobs["a"].trigger.interval == timedelta(hours=6)
    finally:
        stop_background(bg)


def test_start_background_interval_override(tmp_path: Path) -> None:
    app_config = AppConfig(
        repos=[RepoConfig(name="a", path=str(tmp_path / "a"))],
        sync=SyncConfig(interval_hours=6),
    )
    bg = start_background(app_config, interval_override=2)
    try:
        job = bg.get_job("a")
        assert job.trigger.interval == timedelta(hours=2)
    finally:
        stop_background(bg)


def test_start_background_returns_running_scheduler(tmp_path: Path) -> None:
    app_config = AppConfig(repos=[])
    bg = start_background(app_config)
    try:
        assert bg.running is True
    finally:
        stop_background(bg)


def test_stop_background_shuts_down_scheduler(tmp_path: Path) -> None:
    app_config = AppConfig(repos=[])
    bg = start_background(app_config)
    stop_background(bg)
    assert bg.running is False
