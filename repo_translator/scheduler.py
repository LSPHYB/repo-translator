"""Watch-mode scheduling via APScheduler's BlockingScheduler.

Design rationale (TODO.md "阶段 7：Scheduler", SCRATCH.md §3 "watch 模式的进程
管理"):

- Each tracked repo gets its own independent APScheduler job/interval, so one
  repo's sync cadence never blocks or is coupled to another's.
- Each job body is wrapped in try/except: a failure while syncing one repo
  (network error, translator outage, etc.) is logged and swallowed, never
  propagated -- it must not crash the scheduler thread or prevent other
  repos' jobs from continuing to fire on their own schedule.
- `run_watch` does NOT self-daemonize. It calls `BlockingScheduler.start()`,
  which blocks the calling (foreground) process forever. Long-running
  deployment (survive logout, restart on crash, start on boot) is left to
  external tooling -- `nohup`/`tmux` for ad-hoc use, or the systemd/launchd
  templates under `contrib/` for a proper system service. This keeps the
  scheduling logic itself tiny and decoupled from process supervision.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.schedulers.blocking import BlockingScheduler

from repo_translator import cache_manager, sync
from repo_translator.cache_manager import DEFAULT_CACHE_PATH
from repo_translator.config import AppConfig, RepoConfig

logger = logging.getLogger(__name__)


def _make_job(repo_config: RepoConfig, app_config: AppConfig) -> callable:
    """Build the job function for one repo: load cache -> sync -> save cache.

    The returned callable takes no arguments (as required by APScheduler) and
    never raises -- any exception is logged and swallowed so that a single
    repo's failure can't take down the scheduler or block sibling jobs.
    """

    def _job() -> None:
        try:
            cache = cache_manager.load(DEFAULT_CACHE_PATH)
            cache = sync.sync_repo(repo_config, app_config, cache)
            cache_manager.save(DEFAULT_CACHE_PATH, cache)
        except Exception:
            logger.exception(
                "Watch job failed for repo %r; will retry on next interval",
                repo_config.name,
            )

    return _job


def run_watch(app_config: AppConfig, interval_override: int | None) -> None:
    """Run the watch-mode daemon: poll every tracked repo on its own interval.

    Registers one independent job per repo in `app_config.repos`, each on an
    interval (in hours) of `interval_override or app_config.sync.interval_hours`.
    Then calls `scheduler.start()`, which blocks the current process forever
    (see module docstring -- this function never returns under normal use).
    """
    scheduler = BlockingScheduler()
    interval_hours = interval_override or app_config.sync.interval_hours

    for repo_config in app_config.repos:
        scheduler.add_job(
            _make_job(repo_config, app_config),
            "interval",
            hours=interval_hours,
            id=repo_config.name,
            name=repo_config.name,
        )

    scheduler.start()


def start_background(
    app_config: AppConfig, interval_override: int | None = None
) -> BackgroundScheduler:
    """Start watch-mode scheduling without blocking the caller.

    Registers the same one-job-per-repo structure as `run_watch`, but uses
    `BackgroundScheduler` (runs jobs on daemon threads) instead of
    `BlockingScheduler`, so the caller (the desktop API server's startup
    hook) can return immediately. `run_watch` itself is unchanged and still
    used by the CLI's `watch` command.
    """
    bg_scheduler = BackgroundScheduler()
    interval_hours = interval_override or app_config.sync.interval_hours

    for repo_config in app_config.repos:
        bg_scheduler.add_job(
            _make_job(repo_config, app_config),
            "interval",
            hours=interval_hours,
            id=repo_config.name,
            name=repo_config.name,
        )

    bg_scheduler.start()
    return bg_scheduler


def stop_background(bg_scheduler: BackgroundScheduler) -> None:
    """Shut down a scheduler started by `start_background`.

    Waits for any currently-running job to finish before returning.
    """
    bg_scheduler.shutdown(wait=True)
