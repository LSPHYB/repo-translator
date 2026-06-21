"""Main sync pipeline: clone/pull -> diff -> translate -> write output.

Implements design.md S3.1: the core per-repo sync loop that wires together
git_manager, cache_manager, markdown_parser, and translator modules.

`sync_repo` is the single entry point -- it is designed to be called both by
the `translate` CLI command (one-shot) and by the watch-mode scheduler
(polling), hence it does NOT persist cache to disk itself; the caller is
responsible for calling `cache_manager.save()` when appropriate.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

import pathspec

from repo_translator import cache_manager, usage_manager
from repo_translator.git_manager import (
    GitOperationError,
    clone_or_pull,
    get_file_blob_map,
    list_md_files,
)
from repo_translator.parser.markdown_parser import (
    embed_markers,
    extract_translations,
    parse_blocks,
    splice,
)
from repo_translator.translator.base import TokenUsage
from repo_translator.translator.factory import create_translator

if TYPE_CHECKING:
    from repo_translator.config import AppConfig, GlossaryEntry, RepoConfig
    from repo_translator.translator.base import BaseTranslator

logger = logging.getLogger(__name__)


def sync_repo(
    repo_config: RepoConfig,
    app_config: AppConfig,
    cache: dict,
    *,
    only_files: list[str] | None = None,
    should_cancel: Callable[[], bool] | None = None,
    usage: dict | None = None,
) -> dict:
    """Run one full sync cycle for ``repo_config``.

    Steps (per design.md S3.1):
    1. ``clone_or_pull`` -- obtain/update the local checkout.
    2. ``get_file_blob_map`` -- build ``{path: blob_hash}`` for HEAD.
    3. ``cache_manager.get_changed_files`` -- diff against ``cache`` (skipped
       in favor of ``only_files`` when that argument is given).
    4. Concurrently translate + write output for every changed file.
    5. Update and return the ``cache`` dict (not persisted to disk here).

    On ``GitOperationError`` (clone/pull failure) the function logs a warning
    and returns ``cache`` unchanged (design.md S5.3).

    Files matching any glob in ``app_config.output.exclude`` are skipped
    entirely (never translated, never copied to output -- SCRATCH S6).

    ``usage``, if given, is a `usage_manager`-shaped dict that is mutated in
    place (same mutate-and-return convention as `cache_manager.update`) to
    record per-file token usage via `usage_manager.record` -- this is purely
    additive: omitting it (the default) behaves exactly as before. The
    return type of this function does NOT change; only ``cache`` is
    returned, regardless of whether ``usage`` was passed.
    """

    base_dir = Path(app_config.output.base_dir).expanduser()
    repos_dir = base_dir / "repos"

    # 1. Clone or pull
    try:
        repo_path = clone_or_pull(repo_config, repos_dir)
    except GitOperationError:
        logger.warning(
            "Failed to clone/pull repo %r, skipping this sync cycle",
            repo_config.name,
        )
        return cache

    logger.info("Starting sync for repo %r", repo_config.name)

    # 2. Get blob map and filter to .md files
    file_blob_map = get_file_blob_map(repo_path)
    md_files = list_md_files(file_blob_map)

    # 3. Diff against cache to find changed files, unless the caller asked
    # for a specific subset (only_files) -- used by the desktop API's
    # single-file resync endpoint to bypass the blob-hash diff entirely.
    if only_files is not None:
        changed_files = [
            f for f in only_files if f in file_blob_map and f.endswith(".md")
        ]
        for requested in only_files:
            if requested not in file_blob_map:
                logger.warning(
                    "Requested file %r not found in repo %r, skipping",
                    requested,
                    repo_config.name,
                )
    else:
        changed_files = cache_manager.get_changed_files(
            repo_config.name, file_blob_map, cache
        )

    # Filter out files matching output.exclude glob patterns
    exclude_patterns = app_config.output.exclude
    if exclude_patterns:
        changed_files = [
            f for f in changed_files if not _is_excluded(f, exclude_patterns)
        ]

    if not changed_files:
        logger.info(
            "No changed .md files for repo %r (out of %d total .md files)",
            repo_config.name,
            len(md_files),
        )
        return cache

    logger.info(
        "Detected %d changed .md file(s) for repo %r (out of %d total .md files)",
        len(changed_files),
        repo_config.name,
        len(md_files),
    )

    # 4. Process files concurrently
    output_base = base_dir / repo_config.name
    translator = create_translator(app_config.translator)
    concurrency = app_config.sync.concurrency

    results: list[tuple[str, bool, str | None, TokenUsage]] = []

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        future_to_path = {}
        for i, file_path in enumerate(changed_files):
            if should_cancel is not None and should_cancel():
                logger.info(
                    "Sync repo %r: cancelled, %d file(s) already submitted, "
                    "%d file(s) not started",
                    repo_config.name,
                    len(future_to_path),
                    len(changed_files) - i,
                )
                break
            future = executor.submit(
                _process_one_file,
                file_path=file_path,
                repo_path=repo_path,
                output_base=output_base,
                translator=translator,
                glossary=app_config.glossary,
                output_suffix=app_config.output.suffix,
            )
            future_to_path[future] = file_path

        try:
            for future in as_completed(future_to_path, timeout=600):
                file_path = future_to_path[future]
                try:
                    success, error_message, file_usage = future.result()
                    results.append((file_path, success, error_message, file_usage))
                except Exception as exc:
                    logger.warning(
                        "Unexpected error processing %r in repo %r",
                        file_path,
                        repo_config.name,
                        exc_info=True,
                    )
                    results.append((file_path, False, str(exc), TokenUsage(0, 0)))
        except TimeoutError:
            logger.warning(
                "Sync repo %r: timed out waiting for futures to complete",
                repo_config.name,
            )

        # Handle any futures that did not complete within the timeout
        remaining = [f for f in future_to_path if not f.done()]
        if remaining:
            logger.warning(
                "Sync repo %r: %d future(s) did not complete, cancelling",
                repo_config.name,
                len(remaining),
            )
            for f in remaining:
                f.cancel()

    # 5. Update cache for successfully processed files; record an error-only
    # entry for failed ones (cache_manager.record_error) so the desktop API's
    # per-file status endpoint has somewhere to read the failure reason from.
    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat()
    today = now_dt.date().isoformat()
    succeeded = 0
    for file_path, success, error_message, file_usage in results:
        if success:
            blob_hash = file_blob_map[file_path]
            cache = cache_manager.update(
                cache, repo_config.name, file_path, blob_hash, now
            )
            succeeded += 1
        else:
            cache = cache_manager.record_error(
                cache, repo_config.name, file_path, error_message or "", now
            )

        # Record usage whenever a file's TokenUsage is nonzero, regardless
        # of whether the file ultimately succeeded -- a write failure after
        # a successful LLM call still consumed billed tokens.
        if usage is not None and (
            file_usage.prompt_tokens or file_usage.completion_tokens
        ):
            usage_manager.record(
                usage,
                repo_config.name,
                app_config.translator.engine,
                today,
                file_usage.prompt_tokens,
                file_usage.completion_tokens,
            )

    logger.info(
        "Sync complete for repo %r: %d file(s) processed, %d succeeded",
        repo_config.name,
        len(results),
        succeeded,
    )

    return cache


def sync_all(
    app_config: AppConfig,
    cache: dict,
    should_cancel: Callable[[], bool] | None = None,
    *,
    usage: dict | None = None,
) -> dict:
    """Sync every repo in ``app_config.repos`` sequentially.

    Checks ``should_cancel()`` before starting *each repo* (in addition to
    ``sync_repo``'s own per-file check) so a batch run can be stopped between
    repos, not just between files within one repo.

    ``usage``, if given, is forwarded to each ``sync_repo`` call and mutated
    in place exactly as described in ``sync_repo``'s docstring.
    """
    for repo_config in app_config.repos:
        if should_cancel is not None and should_cancel():
            logger.info(
                "sync_all: cancelled before repo %r", repo_config.name
            )
            break
        cache = sync_repo(
            repo_config,
            app_config,
            cache,
            should_cancel=should_cancel,
            usage=usage,
        )
    return cache


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _is_excluded(file_path: str, patterns: list[str]) -> bool:
    """Return True if *file_path* matches any glob in *patterns*.

    Uses ``pathspec`` with gitwildmatch syntax, which implements real
    ``.gitignore``-style matching: ``*`` does NOT cross directory
    boundaries, ``**`` matches zero or more directories.
    """
    spec = pathspec.PathSpec.from_lines("gitignore", patterns)
    if spec.match_file(file_path):
        # Re-scan to find which pattern matched (for logging).
        for pat in patterns:
            sub = pathspec.PathSpec.from_lines("gitignore", [pat])
            if sub.match_file(file_path):
                logger.info(
                    "Skipping %r (matches exclude pattern %r)", file_path, pat
                )
                break
        return True
    return False


def _process_one_file(
    *,
    file_path: str,
    repo_path: Path,
    output_base: Path,
    translator: BaseTranslator,
    glossary: list[GlossaryEntry],
    output_suffix: str,
) -> tuple[bool, str | None, TokenUsage]:
    """Translate *file_path* and write output files.

    Returns a ``(success, error_message, usage)`` tuple: ``(True, None,
    usage)`` on success, ``(False, str(exc), usage)`` on any failure (read
    error, translation error, write error). ``usage`` is whatever
    `BaseTranslator.translate_file` accumulated and returned -- it is
    `TokenUsage(0, 0)` for a read failure (no LLM call was ever made), but
    can be nonzero even on a *write* failure, since the LLM call already
    succeeded and was billed before the write was attempted. Every failure
    case also logs a warning so the caller can skip the cache update for
    this file (recording the error instead, see ``sync_repo``) without
    affecting other files.
    """

    # Read source
    source_file = repo_path / file_path
    try:
        source_content = source_file.read_text(encoding="utf-8")
    except OSError as exc:
        logger.warning(
            "Failed to read %r: %s",
            file_path,
            exc,
            extra={"event": "file_failed", "path": file_path, "error": str(exc)},
        )
        return False, str(exc), TokenUsage(0, 0)

    # Parse -> embed markers -> translate -> extract -> splice
    usage = TokenUsage(0, 0)
    try:
        logger.info(
            "Translating %r ...",
            file_path,
            extra={"event": "file_start", "path": file_path},
        )
        blocks = parse_blocks(source_content)
        marked = embed_markers(source_content, blocks)
        translated_marked, usage = translator.translate_file(marked, glossary)
        translations = extract_translations(translated_marked)
        translated_content = splice(source_content, blocks, translations)
    except Exception as exc:
        logger.warning(
            "Translation failed for %r: %s",
            file_path,
            exc,
            extra={"event": "file_failed", "path": file_path, "error": str(exc)},
        )
        return False, str(exc), usage

    # Compute output paths: docs/guide.md -> docs/guide_zh.md
    assert file_path.endswith(".md"), (
        f"_process_one_file called on non-.md path {file_path!r}"
    )
    stem = file_path[:-3]  # strip trailing ".md"
    dest_zh = output_base / f"{stem}{output_suffix}.md"
    dest_original = output_base / file_path

    # Write both files (translated + original copy, SCRATCH S6.1)
    try:
        dest_zh.parent.mkdir(parents=True, exist_ok=True)
        dest_zh.write_text(translated_content, encoding="utf-8")

        dest_original.parent.mkdir(parents=True, exist_ok=True)
        dest_original.write_text(source_content, encoding="utf-8")
    except OSError as exc:
        logger.warning(
            "Failed to write output for %r: %s",
            file_path,
            exc,
            extra={"event": "file_failed", "path": file_path, "error": str(exc)},
        )
        return False, str(exc), usage

    logger.info(
        "Translated %r",
        file_path,
        extra={"event": "file_translated", "path": file_path},
    )
    return True, None, usage
