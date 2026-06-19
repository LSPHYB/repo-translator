"""Main sync pipeline: clone/pull -> diff -> translate -> write output."""

from __future__ import annotations

import fnmatch
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from repo_translator import cache_manager, git_manager

if TYPE_CHECKING:
    from repo_translator.config import AppConfig, RepoConfig

logger = logging.getLogger(__name__)


def sync_repo(
    repo_config: "RepoConfig", app_config: "AppConfig", cache: dict
) -> dict:
    """Synchronize a single repo: clone/pull, detect changed files, process
    each changed file, update cache.

    Does NOT save cache to disk -- the caller is responsible for calling
    ``cache_manager.save()``.

    Returns the updated cache dict.  On ``GitOperationError`` the original
    ``cache`` is returned unchanged (the sync is skipped for this cycle).
    """
    repos_dir = Path(app_config.output.base_dir).expanduser() / "repos"
    output_dir = Path(app_config.output.base_dir).expanduser()
    exclude_patterns = app_config.output.exclude or []
    suffix = app_config.output.suffix

    # 1. Clone or pull (managed) / resolve path (external).
    try:
        local_path = git_manager.clone_or_pull(repo_config, repos_dir)
    except git_manager.GitOperationError as e:
        logger.error("Git operation failed for %s: %s", repo_config.name, e)
        return cache

    # 2. Full blob map + filter to .md files.
    try:
        file_blob_map = git_manager.get_file_blob_map(local_path)
    except Exception as e:
        logger.error("Failed to get file blob map for %s: %s", repo_config.name, e)
        return cache

    # 3. Determine which .md files have changed.
    changed = cache_manager.get_changed_files(repo_config.name, file_blob_map, cache)

    if not changed:
        return cache

    # 4. Process each changed .md file.
    now_iso = datetime.now(timezone.utc).isoformat()
    processed_count = 0

    for rel_path in sorted(changed):
        # Apply exclude glob patterns.
        if any(fnmatch.fnmatch(rel_path, pat) for pat in exclude_patterns):
            logger.debug("Skipping excluded file: %s", rel_path)
            continue

        src_file = local_path / rel_path

        try:
            content = src_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            logger.error("Failed to read %s: %s", src_file, e)
            continue

        # Mirror directory structure under output/<repo>/.
        dest_orig = output_dir / repo_config.name / rel_path
        dest_trans = output_dir / repo_config.name / f"{rel_path}{suffix}.md"

        try:
            dest_orig.parent.mkdir(parents=True, exist_ok=True)
            dest_orig.write_text(content, encoding="utf-8")
            # Write translation (original content is a stub until the real
            # translator pipeline -- Phase 3-4 -- is integrated).
            dest_trans.write_text(content, encoding="utf-8")
        except OSError as e:
            logger.error("Failed to write output for %s: %s", rel_path, e)
            # Do not update the cache for this file -- we don't want to mark
            # it as translated when the write failed.
            continue

        # 5. Update cache for the successfully processed file.
        cache = cache_manager.update(
            cache,
            repo_config.name,
            rel_path,
            file_blob_map[rel_path],
            now_iso,
        )
        processed_count += 1

    logger.info(
        "sync_repo(%s): %d file(s) processed, %d changed total",
        repo_config.name,
        processed_count,
        len(changed),
    )

    return cache
