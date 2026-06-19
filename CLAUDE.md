# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

`repo-translator` is a Python CLI that tracks GitHub (or local) repos and translates their Markdown docs into Chinese, writing bilingual output (`foo.md` + `foo_zh.md`) alongside incremental re-translation based on git blob hashes. See `README.md` for user-facing usage and `repo-translator-design.md` + `SCRATCH.md` for the original design rationale and decision log (SCRATCH.md resolves several "open questions" from the design doc — e.g. markdown parsing strategy, git tooling choice, glossary support — and is the authoritative source when it disagrees with the design doc).

## Commands

```bash
uv sync --extra dev          # install/update dependencies (incl. pytest)
uv run pytest tests/ -q      # run the full test suite
uv run pytest tests/test_sync.py -q          # run one test file
uv run pytest tests/test_sync.py::test_name  # run one test
uv run repo-translator --help                # run the CLI from source
```

There is no configured linter/type-checker (no ruff/mypy config present) — don't assume one when self-reviewing.

## Architecture

The pipeline is a straight line: `cli.py` → `sync.py` → (`git_manager.py`, `cache_manager.py`, `parser/`, `translator/`). `sync.sync_repo()` is the single entry point used by both the one-shot `translate` CLI command and the `watch` scheduler — it does not persist the cache itself; callers call `cache_manager.save()`.

- **`config.py`** — Pydantic models for `config.yaml`. `RepoConfig` has `url` XOR `path`: `url` repos are *managed* (cloned to `<output.base_dir>/repos/<name>/` and `git pull`ed every sync), `path` repos are *external* (an existing local checkout, read-only, never cloned/pulled). This distinction is load-bearing throughout `cli.py` and `sync.py` — check `RepoConfig.is_managed`/`is_external` rather than re-deriving it.
- **`git_manager.py`** — shells out to the system `git` binary (no GitPython/pygit2). `get_file_blob_map()` does one `git ls-tree -r HEAD` call to get `{path: blob_hash}` for the whole repo, rather than per-file calls — preserve this if touching diffing logic.
- **`cache_manager.py`** — owns `cache.json` (`{repo_name: {file_path: {blob_hash, translated_at}}}`) and `DEFAULT_CACHE_PATH`. A file counts as "changed" purely by blob-hash mismatch (or absence), never by mtime — this is why `git pull` resetting mtimes doesn't cause spurious re-translation. Writes are atomic (tempfile + `os.fsync` + `os.replace`) because `save()` runs every poll cycle of the long-running `watch` daemon; a half-written file would corrupt the cache for every tracked repo.
- **`parser/markdown_parser.py` + `parser/block.py`** — uses markdown-it-py *only* to discover `[start_line, end_line)` ranges per top-level block via token `.map`; it never re-serializes the AST back to Markdown. All reassembly is line-range slicing + string concatenation on the original source text. Translatable block text gets wrapped in `⟦n⟧...⟦/n⟧` markers (U+27E6/U+27E7, not ASCII brackets) before being sent to the translator; `splice()` puts translated text back by marker id and leaves everything else byte-for-byte untouched. `protect_inline`/`restore_inline` is a fallback for protecting inline code/links inside a single block when prompt-only protection fails post-translation validation.
- **`translator/base.py` + `translator/{openai,deepseek,claude}_translator.py` + `translator/factory.py`** — `BaseTranslator.translate_file()` is marker-and-glossary-aware and shared across engines; engine subclasses only implement the raw API call. `factory.create_translator(config)` dispatches on `TranslatorConfig.engine` (`"openai"|"deepseek"|"claude"`).
- **`sync.py`** — per-repo pipeline: clone/pull → blob-map diff → concurrent (`ThreadPoolExecutor`, `sync.concurrency` files at a time) translate+write per changed file → cache update. Graceful degradation throughout (design.md §5.3): a `GitOperationError` on clone/pull skips that repo for the cycle and returns the cache unchanged; a failure translating one file is logged and that file is skipped (not cached as translated) without affecting siblings. `output.exclude` (gitignore-style globs via `pathspec`) filters out files before translation/copying.
- **`scheduler.py`** — `watch` mode via APScheduler `BlockingScheduler`. One independent `interval` job per repo; each job's body (load cache → `sync_repo` → save cache) is wrapped in try/except so one repo's failure never blocks the scheduler thread or sibling jobs. Does not self-daemonize — `contrib/systemd/` and `contrib/launchd/` hold deployment templates for that.
- **`cli.py`** — click command group (`add`/`translate`/`watch`/`list`/`remove`/`config`). Wraps `sync.sync_repo()` calls in try/except → `click.ClickException` with an actionable message, since an unhandled translator-config error (e.g. missing API key) would otherwise surface as a raw traceback.

## Testing conventions

Tests that exercise `cli.py` or `scheduler.py` must never touch the real `~/.repo-translator/` — always patch `repo_translator.config.DEFAULT_CONFIG_PATH` and `repo_translator.cache_manager.DEFAULT_CACHE_PATH` to `tmp_path` locations (see `_setup_temp_paths` in `tests/test_cli.py`). Never call a real translation API in tests — patch `repo_translator.sync.create_translator` (or construct a fake `BaseTranslator`) to return fixed/fake translations; see `_make_fake_translate_file` in `tests/test_sync.py` for the canonical marker-preserving fake. `tests/test_e2e.py` drives the real CLI end-to-end against a real local git repo (added as an *external* repo via local path, so no network call is possible) with only the translator faked — follow that pattern for any new end-to-end coverage rather than mocking `sync_repo` itself.
