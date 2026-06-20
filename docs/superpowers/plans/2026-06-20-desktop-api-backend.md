# Desktop API Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `repo_translator/api_server.py` FastAPI app that exposes the existing `repo_translator` core library (config, cache_manager, git_manager, sync, scheduler) over local HTTP/WebSocket, so a future Tauri desktop GUI can drive the tool without touching the CLI. This plan covers the backend only; the Tauri/React frontend is a separate follow-up plan.

**Architecture:** `api_server.py` is a thin wrapper layer. It imports and calls the *exact same* functions the CLI (`cli.py`) already calls — `sync.sync_repo`, `config.load_config`/`save_config`, `cache_manager.*`, `git_manager.*` — and reuses `cli.py`'s private decision-logic helpers (`_infer_repo_name`, `_is_url`, `_is_git_repo`, `_find_repo_by_name`) rather than duplicating them. Two small extensions to existing modules are needed: `sync.sync_repo` gains `only_files`/`should_cancel` parameters (file-level resync + cooperative cancellation), and `scheduler.py` gains a non-blocking `start_background()` variant (the CLI's `run_watch` stays untouched, using `BlockingScheduler`).

**Tech Stack:** FastAPI + Uvicorn (HTTP/WebSocket server), APScheduler `BackgroundScheduler` (non-blocking watch loop), existing `pytest` + `fastapi.testclient.TestClient` for tests (no new test framework).

## Global Constraints

- Do not change any existing public behavior of `cli.py`, `sync.sync_repo`'s existing call sites, or `scheduler.run_watch` — all changes are additive (new optional parameters with defaults, new functions, new module).
- Reuse `cli.py`'s private helpers (`_infer_repo_name`, `_is_url`, `_is_git_repo`, `_find_repo_by_name`) by importing them into `api_server.py` rather than re-implementing the same decision logic.
- Tests must never touch the real `~/.repo-translator/`: patch `repo_translator.config.DEFAULT_CONFIG_PATH` and `repo_translator.cache_manager.DEFAULT_CACHE_PATH` to `tmp_path` locations, following the existing `_setup_temp_paths` pattern in `tests/test_cli.py`.
- Never call a real translation API in tests — patch `repo_translator.sync.create_translator` (or the imported name in the calling module) to return a fake translator, following `_make_fake_translate_file` in `tests/test_sync.py`.
- Run `uv run pytest tests/ -q` after every task and confirm the new test(s) plus the full existing suite pass before committing.

---

### Task 0: Add FastAPI/Uvicorn dependencies

**Files:**
- Modify: `pyproject.toml`

**Interfaces:**
- Produces: `fastapi`, `uvicorn` importable in the project's venv; `httpx` available for `fastapi.testclient.TestClient` (TestClient is httpx-based and requires it installed explicitly).

- [ ] **Step 1: Add dependencies to `pyproject.toml`**

In `pyproject.toml`, update the `dependencies` list and the `dev` optional-dependencies list:

```toml
dependencies = [
    "click",
    "pydantic>=2.0",
    "markdown-it-py",
    "mdit-py-plugins",
    "openai",
    "anthropic",
    "apscheduler",
    "rich",
    "pathspec",
    "pyyaml>=6.0.3",
    "fastapi",
    "uvicorn[standard]",
]

[project.optional-dependencies]
dev = [
    "pytest",
    "httpx",
]
```

- [ ] **Step 2: Sync dependencies**

Run: `uv sync --extra dev`
Expected: completes without errors; `fastapi`, `uvicorn`, `httpx` appear in `uv.lock`.

- [ ] **Step 3: Verify imports work**

Run: `uv run python -c "import fastapi, uvicorn, httpx; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml uv.lock
git commit -m "build: add fastapi/uvicorn/httpx dependencies for desktop API server"
```

---

### Task 1: `sync.sync_repo` — add `only_files` parameter

**Files:**
- Modify: `repo_translator/sync.py:44` (function signature + diff-computation block)
- Test: `tests/test_sync.py`

**Interfaces:**
- Consumes: existing `sync_repo(repo_config, app_config, cache)` behavior (unchanged when `only_files` is omitted).
- Produces: `sync_repo(repo_config, app_config, cache, *, only_files: list[str] | None = None, should_cancel: ... = None) -> dict` (this task adds `only_files`; `should_cancel` is added in Task 2 — both keyword-only so call sites that already pass positional args keep working unchanged).

- [ ] **Step 1: Write the failing test**

Add to `tests/test_sync.py` (uses the existing `_init_repo_with_files`, `_make_fake_translate_file`, `_make_app_config` helpers already in that file):

```python
def test_sync_repo_only_files_skips_unrequested_files(tmp_path: Path) -> None:
    """only_files restricts processing to the given paths, ignoring the rest."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "README.md": "# Hello\n",
            "docs/guide.md": "## Guide\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)
    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    fake = _make_fake_translate_file()
    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = fake

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        result_cache = sync_repo(
            repo_config, app_config, {}, only_files=["docs/guide.md"]
        )

    assert mock_translator.translate_file.call_count == 1
    assert list(result_cache["test-repo"]) == ["docs/guide.md"]

    output_repo = output_dir / "test-repo"
    assert not (output_repo / "README.md").exists()
    assert (output_repo / "docs" / "guide_zh.md").exists()


def test_sync_repo_only_files_ignores_unknown_path(tmp_path: Path) -> None:
    """A path in only_files that doesn't exist in the repo is skipped, not an error."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(repo_dir, {"README.md": "# Hello\n"})

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)
    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = _make_fake_translate_file()

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        result_cache = sync_repo(
            repo_config, app_config, {}, only_files=["does/not/exist.md"]
        )

    assert mock_translator.translate_file.call_count == 0
    assert result_cache == {}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_sync.py -k only_files -v`
Expected: FAIL with `TypeError: sync_repo() got an unexpected keyword argument 'only_files'`.

- [ ] **Step 3: Implement `only_files`**

In `repo_translator/sync.py`, change the signature on line 44 from:

```python
def sync_repo(repo_config: RepoConfig, app_config: AppConfig, cache: dict) -> dict:
```

to:

```python
def sync_repo(
    repo_config: RepoConfig,
    app_config: AppConfig,
    cache: dict,
    *,
    only_files: list[str] | None = None,
) -> dict:
```

Then replace the diff-computation block (currently):

```python
    # 3. Diff against cache to find changed files
    changed_files = cache_manager.get_changed_files(
        repo_config.name, file_blob_map, cache
    )
```

with:

```python
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
```

Also update the docstring's step 3 line to mention the `only_files` override (one line, after the existing "``cache_manager.get_changed_files``..." bullet):

```
    3. ``cache_manager.get_changed_files`` -- diff against ``cache`` (skipped
       in favor of ``only_files`` when that argument is given).
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_sync.py -k only_files -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Run the full sync test suite to check for regressions**

Run: `uv run pytest tests/test_sync.py -v`
Expected: all tests pass, including the pre-existing ones (they don't pass `only_files`, so they exercise the unchanged `cache_manager.get_changed_files` path).

- [ ] **Step 6: Commit**

```bash
git add repo_translator/sync.py tests/test_sync.py
git commit -m "feat(sync): add only_files param to sync_repo for single-file resync"
```

---

### Task 2: `sync.sync_repo` — add `should_cancel` parameter

**Files:**
- Modify: `repo_translator/sync.py` (signature + file-submission loop)
- Test: `tests/test_sync.py`

**Interfaces:**
- Consumes: `only_files` parameter from Task 1 (signature already keyword-only-extended).
- Produces: `sync_repo(..., should_cancel: Callable[[], bool] | None = None)`. Calling `should_cancel()` returning `True` stops *submitting new* files; files already submitted to the executor still run to completion (no half-written files).

- [ ] **Step 1: Write the failing test**

Add to `tests/test_sync.py`:

```python
def test_sync_repo_should_cancel_stops_remaining_submissions(tmp_path: Path) -> None:
    """should_cancel() returning True after N calls stops submitting further files,
    but files already submitted still complete."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(
        repo_dir,
        {
            "a.md": "# A\n",
            "b.md": "# B\n",
            "c.md": "# C\n",
        },
    )

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir, concurrency=1)
    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = _make_fake_translate_file()

    calls = {"n": 0}

    def should_cancel() -> bool:
        calls["n"] += 1
        # False on the 1st check (before file 1), True from the 2nd check on.
        return calls["n"] > 1

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        result_cache = sync_repo(
            repo_config, app_config, {}, should_cancel=should_cancel
        )

    assert mock_translator.translate_file.call_count == 1
    assert len(result_cache["test-repo"]) == 1


def test_sync_repo_should_cancel_none_processes_everything(tmp_path: Path) -> None:
    """Omitting should_cancel (the default) behaves exactly as before."""
    repo_dir = tmp_path / "src-repo"
    _init_repo_with_files(repo_dir, {"a.md": "# A\n", "b.md": "# B\n"})

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)
    repo_config = RepoConfig(name="test-repo", path=str(repo_dir))

    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = _make_fake_translate_file()

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        result_cache = sync_repo(repo_config, app_config, {})

    assert mock_translator.translate_file.call_count == 2
    assert len(result_cache["test-repo"]) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_sync.py -k should_cancel -v`
Expected: FAIL with `TypeError: sync_repo() got an unexpected keyword argument 'should_cancel'`.

- [ ] **Step 3: Implement `should_cancel`**

In `repo_translator/sync.py`, extend the signature again:

```python
def sync_repo(
    repo_config: RepoConfig,
    app_config: AppConfig,
    cache: dict,
    *,
    only_files: list[str] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> dict:
```

Add the import at the top of the file (alongside the existing `from concurrent.futures import ...` line):

```python
from collections.abc import Callable
```

Then in the file-submission loop (currently):

```python
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        future_to_path = {}
        for file_path in changed_files:
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
```

change the `for` loop to:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_sync.py -k "should_cancel" -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Run the full sync test suite to check for regressions**

Run: `uv run pytest tests/test_sync.py -v`
Expected: all tests pass.

- [ ] **Step 6: Add `sync_all` (multi-repo batch with cancellation)**

Still in `repo_translator/sync.py`, add a new top-level function after `sync_repo` (before the `# Internal helpers` section):

```python
def sync_all(
    app_config: AppConfig,
    cache: dict,
    should_cancel: Callable[[], bool] | None = None,
) -> dict:
    """Sync every repo in ``app_config.repos`` sequentially.

    Checks ``should_cancel()`` before starting *each repo* (in addition to
    ``sync_repo``'s own per-file check) so a batch run can be stopped between
    repos, not just between files within one repo.
    """
    for repo_config in app_config.repos:
        if should_cancel is not None and should_cancel():
            logger.info(
                "sync_all: cancelled before repo %r", repo_config.name
            )
            break
        cache = sync_repo(
            repo_config, app_config, cache, should_cancel=should_cancel
        )
    return cache
```

- [ ] **Step 7: Write the failing test for `sync_all`**

Add to `tests/test_sync.py`:

```python
from repo_translator.sync import sync_all  # add to the existing import line


def test_sync_all_processes_every_repo(tmp_path: Path) -> None:
    repo_dirs = []
    for i in range(2):
        d = tmp_path / f"repo{i}"
        _init_repo_with_files(d, {"README.md": f"# repo {i}\n"})
        repo_dirs.append(d)

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)
    app_config.repos = [
        RepoConfig(name=f"repo{i}", path=str(repo_dirs[i])) for i in range(2)
    ]

    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = _make_fake_translate_file()

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        result_cache = sync_all(app_config, {})

    assert set(result_cache) == {"repo0", "repo1"}


def test_sync_all_should_cancel_stops_before_next_repo(tmp_path: Path) -> None:
    repo_dirs = []
    for i in range(2):
        d = tmp_path / f"repo{i}"
        _init_repo_with_files(d, {"README.md": f"# repo {i}\n"})
        repo_dirs.append(d)

    output_dir = tmp_path / "output"
    app_config = _make_app_config(base_dir=output_dir)
    app_config.repos = [
        RepoConfig(name=f"repo{i}", path=str(repo_dirs[i])) for i in range(2)
    ]

    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = _make_fake_translate_file()

    calls = {"n": 0}

    def should_cancel() -> bool:
        calls["n"] += 1
        return calls["n"] > 1  # allow repo0's pre-check, cancel before repo1

    with patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        result_cache = sync_all(app_config, {}, should_cancel=should_cancel)

    assert set(result_cache) == {"repo0"}
```

- [ ] **Step 8: Run tests to verify they fail, then pass**

Run: `uv run pytest tests/test_sync.py -k sync_all -v`
Expected: first FAIL with `ImportError: cannot import name 'sync_all'` (before Step 6) — since Step 6 already added the function, this should now PASS directly. If it doesn't, re-check Step 6 was applied, then re-run.

- [ ] **Step 9: Run the full sync test suite**

Run: `uv run pytest tests/test_sync.py -v`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add repo_translator/sync.py tests/test_sync.py
git commit -m "feat(sync): add should_cancel cooperative cancellation + sync_all batch helper"
```

---

### Task 3: `api_server.py` skeleton + `/health`

**Files:**
- Create: `repo_translator/api_server.py`
- Test: `tests/test_api_server.py`

**Interfaces:**
- Produces: module-level `app: fastapi.FastAPI` instance, importable as `from repo_translator.api_server import app`. All later tasks add routes to this same `app` object.

- [ ] **Step 1: Write the failing test**

Create `tests/test_api_server.py`:

```python
"""Tests for repo_translator.api_server -- the desktop GUI's local HTTP/WS API."""

from __future__ import annotations

from fastapi.testclient import TestClient

from repo_translator.api_server import app


def test_health_returns_ok() -> None:
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_api_server.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'repo_translator.api_server'`.

- [ ] **Step 3: Create `repo_translator/api_server.py`**

```python
"""Local HTTP/WebSocket API exposing repo_translator's core library to the
desktop GUI (Tauri app). This module wraps existing functions in `config`,
`cache_manager`, `git_manager`, `sync`, and `scheduler` without changing
their behavior -- `cli.py` remains a separate, unmodified entry point that
both share. See docs/superpowers/specs/2026-06-20-desktop-app-design.md.
"""

from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(title="repo-translator desktop API")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_api_server.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add repo_translator/api_server.py tests/test_api_server.py
git commit -m "feat(api): add api_server.py FastAPI skeleton with /health"
```

---

### Task 4: `GET /config`, `PUT /config`

**Files:**
- Modify: `repo_translator/api_server.py`
- Test: `tests/test_api_server.py`

**Interfaces:**
- Consumes: `config.load_config()`, `config.save_config()`, `config.AppConfig` (unchanged, from `repo_translator/config.py`).
- Produces: `GET /config` → full `AppConfig` as JSON; `PUT /config` (body: full `AppConfig` JSON) → validates, saves, returns the saved config as JSON, or `400` with a detail message on validation failure.

Note: unlike the CLI's dot-notation `--get`/`--set` (`_nested_get`/`_nested_set`), this exposes the *whole config object* for read/write. A GUI settings form edits structured fields (glossary table, exclude list, engine dropdown), not dot-path strings, so whole-object GET/PUT is the right shape here — it's a deliberate simplification, not a missing feature.

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_api_server.py`:

```python
from pathlib import Path
from unittest.mock import patch

from repo_translator.config import AppConfig, save_config


def _patch_config_path(tmp_path: Path):
    config_path = tmp_path / ".repo-translator" / "config.yaml"
    return patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path)


def test_get_config_returns_defaults(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path):
        client = TestClient(app)
        resp = client.get("/config")
    assert resp.status_code == 200
    body = resp.json()
    assert body["sync"]["interval_hours"] == 6
    assert body["repos"] == []


def test_put_config_persists_changes(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path) as _:
        client = TestClient(app)
        current = client.get("/config").json()
        current["sync"]["interval_hours"] = 12
        resp = client.put("/config", json=current)
        assert resp.status_code == 200
        assert resp.json()["sync"]["interval_hours"] == 12

        reloaded = client.get("/config").json()
        assert reloaded["sync"]["interval_hours"] == 12


def test_put_config_rejects_invalid_payload(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path):
        client = TestClient(app)
        # A repo entry with neither url nor path set fails RepoConfig validation.
        resp = client.put("/config", json={"repos": [{"name": "x"}]})
    assert resp.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_api_server.py -k config -v`
Expected: FAIL with 404 (no `/config` route registered) on the first assertion.

- [ ] **Step 3: Implement the routes**

In `repo_translator/api_server.py`, add imports and routes:

```python
from fastapi import FastAPI, HTTPException

from repo_translator.config import AppConfig, load_config, save_config

app = FastAPI(title="repo-translator desktop API")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/config")
def get_config() -> dict:
    cfg = load_config()
    return cfg.model_dump(mode="json", exclude_none=True)


@app.put("/config")
def put_config(payload: dict) -> dict:
    try:
        new_config = AppConfig.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    save_config(new_config)
    return new_config.model_dump(mode="json", exclude_none=True)
```

(Replace the whole file content from Task 3 with the above — it's the same file, just with the new imports merged at the top and two new routes added after `/health`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_api_server.py -v`
Expected: all pass (3 new + 1 from Task 3).

- [ ] **Step 5: Commit**

```bash
git add repo_translator/api_server.py tests/test_api_server.py
git commit -m "feat(api): add GET/PUT /config routes"
```

---

### Task 5: `GET /repos`, `POST /repos`, `DELETE /repos/{name}`

**Files:**
- Modify: `repo_translator/api_server.py`
- Test: `tests/test_api_server.py`

**Interfaces:**
- Consumes: `cli._infer_repo_name`, `cli._is_url`, `cli._is_git_repo`, `cli._find_repo_by_name` (imported from `repo_translator.cli`, reused as-is); `git_manager.clone`, `git_manager.GitOperationError`; `cache_manager.load`, `cache_manager.DEFAULT_CACHE_PATH`.
- Produces: `GET /repos` → `list[dict]` (name/kind/branch/last_sync/file_count); `POST /repos` (body `{"url_or_path": str, "name": str | None}`) → `201` with `{"name": str, "kind": "managed"|"external"}`, `409` if name already tracked, `400` if a local path isn't a git repo, `502` if clone fails; `DELETE /repos/{name}` → `204`, `404` if not found.

Note: unlike the CLI's `add` command, `POST /repos` does **not** run an initial sync — it only clones (if managed) and saves the config entry. The GUI is expected to call `POST /repos/{name}/sync` (Task 6) right after, or rely on the background watch loop (Task 8) to pick it up. This decouples "register a repo" from "translate it", which is simpler to reason about over HTTP (no long-blocking POST /repos call while an initial translation runs).

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_api_server.py` (add `subprocess` and `datetime` imports at the top alongside the existing ones):

```python
import subprocess


def _init_git_repo(repo_dir: Path, files: dict[str, str]) -> None:
    """Create a minimal git repo at *repo_dir* with the given files committed."""
    subprocess.run(["git", "init", "-q", "-b", "main", str(repo_dir)], check=True)
    subprocess.run(
        ["git", "-C", str(repo_dir), "config", "user.email", "test@example.com"],
        check=True,
    )
    subprocess.run(
        ["git", "-C", str(repo_dir), "config", "user.name", "Test"], check=True
    )
    for relpath, content in files.items():
        full = repo_dir / relpath
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content)
    subprocess.run(["git", "-C", str(repo_dir), "add", "-A"], check=True)
    subprocess.run(
        ["git", "-C", str(repo_dir), "commit", "-q", "-m", "initial"], check=True
    )


def test_list_repos_empty(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path):
        client = TestClient(app)
        resp = client.get("/repos")
    assert resp.status_code == 200
    assert resp.json() == []


def test_add_external_repo(tmp_path: Path) -> None:
    repo_dir = tmp_path / "my-project"
    _init_git_repo(repo_dir, {"README.md": "# Hi\n"})

    with _patch_config_path(tmp_path):
        client = TestClient(app)
        resp = client.post("/repos", json={"url_or_path": str(repo_dir)})
        assert resp.status_code == 201
        assert resp.json() == {"name": "my-project", "kind": "external"}

        listed = client.get("/repos").json()
        assert len(listed) == 1
        assert listed[0]["name"] == "my-project"
        assert listed[0]["kind"] == "external"


def test_add_external_repo_rejects_non_git_dir(tmp_path: Path) -> None:
    not_a_repo = tmp_path / "plain-dir"
    not_a_repo.mkdir()

    with _patch_config_path(tmp_path):
        client = TestClient(app)
        resp = client.post("/repos", json={"url_or_path": str(not_a_repo)})
    assert resp.status_code == 400


def test_add_managed_repo_calls_clone(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path), patch(
        "repo_translator.api_server.git_manager.clone"
    ) as mock_clone:
        client = TestClient(app)
        resp = client.post(
            "/repos", json={"url_or_path": "https://github.com/example/repo"}
        )
        assert resp.status_code == 201
        assert resp.json() == {"name": "repo", "kind": "managed"}
        mock_clone.assert_called_once()


def test_add_repo_duplicate_name_conflicts(tmp_path: Path) -> None:
    repo_dir = tmp_path / "my-project"
    _init_git_repo(repo_dir, {"README.md": "# Hi\n"})

    with _patch_config_path(tmp_path):
        client = TestClient(app)
        client.post("/repos", json={"url_or_path": str(repo_dir)})
        resp = client.post("/repos", json={"url_or_path": str(repo_dir)})
    assert resp.status_code == 409


def test_delete_repo_removes_from_config(tmp_path: Path) -> None:
    repo_dir = tmp_path / "my-project"
    _init_git_repo(repo_dir, {"README.md": "# Hi\n"})

    with _patch_config_path(tmp_path):
        client = TestClient(app)
        client.post("/repos", json={"url_or_path": str(repo_dir)})
        resp = client.delete("/repos/my-project")
        assert resp.status_code == 204
        assert client.get("/repos").json() == []


def test_delete_repo_missing_returns_404(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path):
        client = TestClient(app)
        resp = client.delete("/repos/does-not-exist")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_api_server.py -k repos -v`
Expected: FAIL with 404s (no `/repos` routes registered yet).

- [ ] **Step 3: Implement the routes**

In `repo_translator/api_server.py`, add imports and routes (merge into the existing file):

```python
from datetime import datetime, timezone
from pathlib import Path

import click
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from repo_translator import cache_manager, git_manager
from repo_translator.cli import _find_repo_by_name, _infer_repo_name, _is_git_repo, _is_url
from repo_translator.config import AppConfig, RepoConfig, load_config, save_config
```

```python
@app.get("/repos")
def list_repos() -> list[dict]:
    cfg = load_config()
    cache = cache_manager.load(cache_manager.DEFAULT_CACHE_PATH)
    result = []
    for repo in cfg.repos:
        repo_cache = cache.get(repo.name, {})
        timestamps = [
            v.get("translated_at", "")
            for v in repo_cache.values()
            if v.get("translated_at")
        ]
        result.append(
            {
                "name": repo.name,
                "kind": "managed" if repo.is_managed else "external",
                "branch": repo.branch,
                "last_sync": max(timestamps) if timestamps else None,
                "file_count": len(repo_cache),
            }
        )
    return result


class AddRepoRequest(BaseModel):
    url_or_path: str
    name: str | None = None


@app.post("/repos", status_code=201)
def add_repo(payload: AddRepoRequest) -> dict:
    cfg = load_config()
    repo_name = payload.name or _infer_repo_name(payload.url_or_path)

    if any(r.name == repo_name for r in cfg.repos):
        raise HTTPException(
            status_code=409,
            detail=f"Repository '{repo_name}' is already tracked.",
        )

    now = datetime.now(timezone.utc)
    output_base = Path(cfg.output.base_dir).expanduser()

    if _is_url(payload.url_or_path):
        repo_config = RepoConfig(name=repo_name, url=payload.url_or_path, added_at=now)
        clone_dest = output_base / "repos" / repo_name
        try:
            git_manager.clone(payload.url_or_path, clone_dest)
        except git_manager.GitOperationError as exc:
            # Save the config entry anyway so the user can retry later via sync.
            cfg.repos.append(repo_config)
            save_config(cfg)
            raise HTTPException(
                status_code=502, detail=f"Clone failed: {exc}"
            ) from exc
    else:
        local_path = Path(payload.url_or_path).expanduser().resolve()
        if not _is_git_repo(local_path):
            raise HTTPException(
                status_code=400,
                detail=f"'{local_path}' does not appear to be a git repository.",
            )
        repo_config = RepoConfig(name=repo_name, path=str(local_path), added_at=now)

    cfg.repos.append(repo_config)
    save_config(cfg)
    return {
        "name": repo_config.name,
        "kind": "managed" if repo_config.is_managed else "external",
    }


@app.delete("/repos/{name}", status_code=204)
def delete_repo(name: str) -> None:
    cfg = load_config()
    try:
        _find_repo_by_name(cfg, name)
    except click.ClickException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    cfg.repos = [r for r in cfg.repos if r.name != name]
    save_config(cfg)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_api_server.py -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add repo_translator/api_server.py tests/test_api_server.py
git commit -m "feat(api): add GET/POST /repos and DELETE /repos/{name}"
```

---

### Task 6: `POST /repos/{name}/sync`, `POST /repos/{name}/files/{path}/sync`

**Files:**
- Modify: `repo_translator/api_server.py`
- Test: `tests/test_api_server.py`

**Interfaces:**
- Consumes: `sync.sync_repo` (with the `only_files` param from Task 1), `cache_manager.load`/`save`, `_find_repo_by_name`.
- Produces: `POST /repos/{name}/sync` → `{"name": str, "files_succeeded": int}`, `404` if repo not tracked; `POST /repos/{name}/files/{path}/sync` (`path` may contain `/`) → `{"name": str, "path": str, "succeeded": true}`, `404` if repo not tracked, `500` if that specific file failed to translate.

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_api_server.py` (add `from unittest.mock import MagicMock` and a small fake-translate helper, mirroring `tests/test_sync.py`'s `_make_fake_translate_file`):

```python
import re
from collections.abc import Callable
from unittest.mock import MagicMock


def _make_fake_translate_file() -> Callable[[str, list], str]:
    _MARKED_RE = re.compile(r"⟦(\d+)⟧(.*?)⟦/\1⟧", re.DOTALL)

    def _replace(m: re.Match) -> str:
        return f"⟦{m.group(1)}⟧[ZH] {m.group(2)} [/ZH]⟦/{m.group(1)}⟧"

    def _translate_file(marked_source: str, glossary: list) -> str:
        return _MARKED_RE.sub(_replace, marked_source)

    return _translate_file


def test_sync_repo_endpoint_translates_changed_files(tmp_path: Path) -> None:
    repo_dir = tmp_path / "my-project"
    _init_git_repo(repo_dir, {"README.md": "# Hi\n", "docs/guide.md": "## G\n"})

    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = _make_fake_translate_file()

    with _patch_config_path(tmp_path), patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        client = TestClient(app)
        client.post("/repos", json={"url_or_path": str(repo_dir)})

        resp = client.post("/repos/my-project/sync")
        assert resp.status_code == 200
        assert resp.json() == {"name": "my-project", "files_succeeded": 2}


def test_sync_repo_endpoint_404_for_unknown_repo(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path):
        client = TestClient(app)
        resp = client.post("/repos/does-not-exist/sync")
    assert resp.status_code == 404


def test_sync_file_endpoint_translates_one_file(tmp_path: Path) -> None:
    repo_dir = tmp_path / "my-project"
    _init_git_repo(repo_dir, {"README.md": "# Hi\n", "docs/guide.md": "## G\n"})

    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = _make_fake_translate_file()

    with _patch_config_path(tmp_path), patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        client = TestClient(app)
        client.post("/repos", json={"url_or_path": str(repo_dir)})

        resp = client.post("/repos/my-project/files/docs/guide.md/sync")
        assert resp.status_code == 200
        assert resp.json() == {
            "name": "my-project",
            "path": "docs/guide.md",
            "succeeded": True,
        }
        assert mock_translator.translate_file.call_count == 1


def test_sync_file_endpoint_404_for_unknown_repo(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path):
        client = TestClient(app)
        resp = client.post("/repos/does-not-exist/files/a.md/sync")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_api_server.py -k "sync_repo_endpoint or sync_file_endpoint" -v`
Expected: FAIL with 404s (routes not registered).

- [ ] **Step 3: Implement the routes**

In `repo_translator/api_server.py`, add the `sync` import:

```python
from repo_translator import cache_manager, git_manager, sync
```

Then add the two routes (after the `/repos` routes from Task 5):

```python
@app.post("/repos/{name}/sync")
def sync_repo_endpoint(name: str) -> dict:
    cfg = load_config()
    try:
        repo_config = _find_repo_by_name(cfg, name)
    except click.ClickException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    cache = cache_manager.load(cache_manager.DEFAULT_CACHE_PATH)
    before = len(cache.get(name, {}))
    cache = sync.sync_repo(repo_config, cfg, cache)
    cache_manager.save(cache_manager.DEFAULT_CACHE_PATH, cache)
    after = len(cache.get(name, {}))
    return {"name": name, "files_succeeded": after - before}


@app.post("/repos/{name}/files/{path:path}/sync")
def sync_file_endpoint(name: str, path: str) -> dict:
    cfg = load_config()
    try:
        repo_config = _find_repo_by_name(cfg, name)
    except click.ClickException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    cache = cache_manager.load(cache_manager.DEFAULT_CACHE_PATH)
    cache = sync.sync_repo(repo_config, cfg, cache, only_files=[path])
    cache_manager.save(cache_manager.DEFAULT_CACHE_PATH, cache)

    succeeded = path in cache.get(name, {})
    if not succeeded:
        raise HTTPException(
            status_code=500, detail=f"Failed to translate '{path}'."
        )
    return {"name": name, "path": path, "succeeded": True}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_api_server.py -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add repo_translator/api_server.py tests/test_api_server.py
git commit -m "feat(api): add per-repo and per-file sync endpoints"
```

---

### Task 7: `POST /repos/sync-all`, `POST /repos/sync-all/cancel`

**Files:**
- Modify: `repo_translator/api_server.py`
- Test: `tests/test_api_server.py`

**Interfaces:**
- Consumes: `sync.sync_all` (Task 2).
- Produces: `POST /repos/sync-all` → `{"repos_processed": int, "cancelled": bool}`, `409` if a sync-all is already running; `POST /repos/sync-all/cancel` → `{"cancelled": true}` (always succeeds; a no-op if nothing is running).

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_api_server.py` (add `import threading` at the top):

```python
import threading


def test_sync_all_endpoint_processes_every_repo(tmp_path: Path) -> None:
    repo_dirs = []
    for i in range(2):
        d = tmp_path / f"repo{i}"
        _init_git_repo(d, {"README.md": f"# repo {i}\n"})
        repo_dirs.append(d)

    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = _make_fake_translate_file()

    with _patch_config_path(tmp_path), patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        client = TestClient(app)
        for d in repo_dirs:
            client.post("/repos", json={"url_or_path": str(d)})

        resp = client.post("/repos/sync-all")
        assert resp.status_code == 200
        assert resp.json() == {"repos_processed": 2, "cancelled": False}


def test_sync_all_cancel_stops_remaining_repos(tmp_path: Path) -> None:
    repo_dirs = []
    for i in range(2):
        d = tmp_path / f"repo{i}"
        _init_git_repo(d, {"README.md": f"# repo {i}\n"})
        repo_dirs.append(d)

    call_order: list[str] = []
    first_repo_started = threading.Event()
    proceed = threading.Event()

    def fake_sync_repo(repo_config, app_config, cache, **kwargs):
        call_order.append(repo_config.name)
        if repo_config.name == "repo0":
            first_repo_started.set()
            assert proceed.wait(timeout=5), "test deadlocked waiting for cancel"
        return cache

    with _patch_config_path(tmp_path), patch(
        "repo_translator.api_server.sync.sync_repo", side_effect=fake_sync_repo
    ):
        client = TestClient(app)
        for d in repo_dirs:
            client.post("/repos", json={"url_or_path": str(d)})

        result: dict = {}

        def run_sync_all() -> None:
            result["resp"] = client.post("/repos/sync-all")

        t = threading.Thread(target=run_sync_all)
        t.start()
        assert first_repo_started.wait(timeout=5)
        cancel_resp = client.post("/repos/sync-all/cancel")
        proceed.set()
        t.join(timeout=5)

    assert cancel_resp.status_code == 200
    assert cancel_resp.json() == {"cancelled": True}
    assert call_order == ["repo0"]
    assert result["resp"].json()["cancelled"] is True


def test_sync_all_rejects_concurrent_runs(tmp_path: Path) -> None:
    repo_dir = tmp_path / "repo0"
    _init_git_repo(repo_dir, {"README.md": "# repo 0\n"})

    started = threading.Event()
    proceed = threading.Event()

    def fake_sync_repo(repo_config, app_config, cache, **kwargs):
        started.set()
        assert proceed.wait(timeout=5), "test deadlocked"
        return cache

    with _patch_config_path(tmp_path), patch(
        "repo_translator.api_server.sync.sync_repo", side_effect=fake_sync_repo
    ):
        client = TestClient(app)
        client.post("/repos", json={"url_or_path": str(repo_dir)})

        result: dict = {}

        def run_sync_all() -> None:
            result["resp"] = client.post("/repos/sync-all")

        t = threading.Thread(target=run_sync_all)
        t.start()
        assert started.wait(timeout=5)

        conflict_resp = client.post("/repos/sync-all")
        proceed.set()
        t.join(timeout=5)

    assert conflict_resp.status_code == 409
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_api_server.py -k sync_all -v`
Expected: FAIL with 404s (routes not registered).

- [ ] **Step 3: Implement the routes**

In `repo_translator/api_server.py`, add `threading` import and module-level cancellation state (near the top, after the `app = FastAPI(...)` line):

```python
import threading

_sync_all_lock = threading.Lock()
_sync_all_running = False
_sync_all_cancel_event = threading.Event()
```

Then add the routes (after the per-file sync route from Task 6):

```python
@app.post("/repos/sync-all")
def sync_all_endpoint() -> dict:
    global _sync_all_running

    with _sync_all_lock:
        if _sync_all_running:
            raise HTTPException(
                status_code=409, detail="A sync-all run is already in progress."
            )
        _sync_all_running = True
        _sync_all_cancel_event.clear()

    try:
        cfg = load_config()
        cache = cache_manager.load(cache_manager.DEFAULT_CACHE_PATH)
        cache = sync.sync_all(
            cfg, cache, should_cancel=_sync_all_cancel_event.is_set
        )
        cache_manager.save(cache_manager.DEFAULT_CACHE_PATH, cache)
        return {
            "repos_processed": len(cfg.repos),
            "cancelled": _sync_all_cancel_event.is_set(),
        }
    finally:
        with _sync_all_lock:
            _sync_all_running = False


@app.post("/repos/sync-all/cancel")
def cancel_sync_all() -> dict:
    _sync_all_cancel_event.set()
    return {"cancelled": True}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/test_api_server.py -v`
Expected: all pass. (Note: `test_sync_all_cancel_stops_remaining_repos` and `test_sync_all_rejects_concurrent_runs` use real threads with `threading.Event` handshakes rather than `sleep()`, so they're deterministic, not timing-dependent — if either test ever hangs instead of failing fast, that's a bug in the cancellation wiring, not test flakiness.)

- [ ] **Step 5: Commit**

```bash
git add repo_translator/api_server.py tests/test_api_server.py
git commit -m "feat(api): add POST /repos/sync-all and /repos/sync-all/cancel"
```

---

### Task 8: `scheduler.start_background()` + wire into API server lifespan

**Files:**
- Modify: `repo_translator/scheduler.py` (add `start_background`/`stop_background`)
- Modify: `repo_translator/api_server.py` (add `lifespan`)
- Test: `tests/test_scheduler.py` (existing file — check it exists; if not, create it), `tests/test_api_server.py`

**Interfaces:**
- Consumes: `scheduler._make_job` (existing private helper, reused as-is).
- Produces: `scheduler.start_background(app_config: AppConfig, interval_override: int | None = None) -> BackgroundScheduler`; `scheduler.stop_background(bg_scheduler: BackgroundScheduler) -> None`. `api_server.py` calls these from a FastAPI `lifespan` context manager so the scheduler starts when the API server starts and shuts down cleanly when it stops.

- [ ] **Step 1: Check for an existing scheduler test file**

Run: `ls tests/test_scheduler.py 2>/dev/null || echo "no existing file"`

If it exists, read it first to follow its existing patterns/imports before adding to it. The steps below assume a fresh file; adapt import lines if one already exists.

- [ ] **Step 2: Write the failing tests**

Create or append to `tests/test_scheduler.py`:

```python
"""Tests for repo_translator.scheduler."""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from repo_translator.config import AppConfig, RepoConfig, SyncConfig
from repo_translator.scheduler import start_background, stop_background


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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run pytest tests/test_scheduler.py -v`
Expected: FAIL with `ImportError: cannot import name 'start_background'`.

- [ ] **Step 4: Implement `start_background`/`stop_background`**

In `repo_translator/scheduler.py`, add the import:

```python
from apscheduler.schedulers.background import BackgroundScheduler
```

Then add the two functions after `run_watch`:

```python
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_scheduler.py -v`
Expected: all pass.

- [ ] **Step 6: Write the failing lifespan test**

Add to `tests/test_api_server.py`:

```python
from repo_translator import api_server


def test_lifespan_starts_and_stops_background_scheduler(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path):
        save_config(AppConfig(repos=[]), tmp_path / ".repo-translator" / "config.yaml")
        with TestClient(app) as client:
            resp = client.get("/health")
            assert resp.status_code == 200
            assert api_server._background_scheduler is not None
            assert api_server._background_scheduler.running is True

    assert api_server._background_scheduler is None
```

- [ ] **Step 7: Run test to verify it fails**

Run: `uv run pytest tests/test_api_server.py -k lifespan -v`
Expected: FAIL with `AttributeError: module 'repo_translator.api_server' has no attribute '_background_scheduler'`.

- [ ] **Step 8: Implement the lifespan hook**

In `repo_translator/api_server.py`, add the imports:

```python
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler

from repo_translator import scheduler as scheduler_module
```

Add the module-level variable and the lifespan function (before the `app = FastAPI(...)` line), then pass `lifespan=lifespan` to the `FastAPI(...)` constructor:

```python
_background_scheduler: BackgroundScheduler | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _background_scheduler
    cfg = load_config()
    _background_scheduler = scheduler_module.start_background(cfg)
    yield
    if _background_scheduler is not None:
        scheduler_module.stop_background(_background_scheduler)
        _background_scheduler = None


app = FastAPI(title="repo-translator desktop API", lifespan=lifespan)
```

(This replaces the existing bare `app = FastAPI(title="repo-translator desktop API")` line from Task 3.)

- [ ] **Step 9: Run tests to verify they pass**

Run: `uv run pytest tests/test_api_server.py -v`
Expected: all pass. Note that every other test in this file that uses `TestClient(app)` *without* the `with` statement does **not** trigger lifespan (FastAPI only runs `lifespan` for clients used as context managers), so they're unaffected by this change.

- [ ] **Step 10: Run the full test suite**

Run: `uv run pytest tests/ -q`
Expected: all tests pass (existing CLI/sync/config/cache/parser/translator tests + all new ones from this plan).

- [ ] **Step 11: Commit**

```bash
git add repo_translator/scheduler.py repo_translator/api_server.py tests/test_scheduler.py tests/test_api_server.py
git commit -m "feat(scheduler): add non-blocking start_background, wire into api_server lifespan"
```

---

### Task 9: `WS /logs` — structured log streaming

**Files:**
- Modify: `repo_translator/api_server.py`
- Test: `tests/test_api_server.py`

**Interfaces:**
- Produces: `WebSocket /logs` — every log record emitted by any logger under the `repo_translator` namespace (i.e. `sync.py`, `scheduler.py`, etc., which all use `logging.getLogger(__name__)`) is pushed to every connected WebSocket client as one NDJSON line: `{"time": ISO8601, "level": str, "logger": str, "message": str}`.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_api_server.py`:

```python
import json
import logging


def test_logs_ws_receives_log_messages(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path):
        save_config(AppConfig(repos=[]), tmp_path / ".repo-translator" / "config.yaml")
        with TestClient(app) as client:
            with client.websocket_connect("/logs") as ws:
                logging.getLogger("repo_translator.sync").warning(
                    "test message %s", "abc"
                )
                received = ws.receive_text()

    payload = json.loads(received)
    assert payload["level"] == "WARNING"
    assert payload["logger"] == "repo_translator.sync"
    assert payload["message"] == "test message abc"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_api_server.py -k logs_ws -v`
Expected: FAIL — `websocket_connect("/logs")` raises because no such route exists.

- [ ] **Step 3: Implement the log broadcaster and the WebSocket route**

In `repo_translator/api_server.py`, add imports:

```python
import asyncio
import json
import logging
import queue

from fastapi import WebSocket, WebSocketDisconnect
```

Add the broadcaster state and handler class (near the other module-level state, e.g. after the `_sync_all_*` variables):

```python
_log_queue: queue.Queue[str] = queue.Queue()
_connected_websockets: set[WebSocket] = set()


class _LogBroadcastHandler(logging.Handler):
    """Formats log records as one NDJSON line and pushes them onto a
    thread-safe queue. Safe to call from any thread (sync.py's
    ThreadPoolExecutor workers, scheduler.py's BackgroundScheduler threads)
    because `queue.Queue.put_nowait` is itself thread-safe; the actual
    WebSocket broadcast happens separately in `_drain_log_queue`, which runs
    on the asyncio event loop -- the only context allowed to touch
    `WebSocket` objects.
    """

    def emit(self, record: logging.LogRecord) -> None:
        payload = json.dumps(
            {
                "time": datetime.now(timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            }
        )
        _log_queue.put_nowait(payload)


async def _drain_log_queue() -> None:
    """Forward every queued log line to all currently-connected WebSockets."""
    loop = asyncio.get_event_loop()
    while True:
        payload = await loop.run_in_executor(None, _log_queue.get)
        for ws in list(_connected_websockets):
            try:
                await ws.send_text(payload)
            except Exception:
                _connected_websockets.discard(ws)
```

Add the WebSocket route (after the other routes):

```python
@app.websocket("/logs")
async def logs_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    _connected_websockets.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _connected_websockets.discard(websocket)
```

Wire the handler installation and the drain task into `lifespan` (modify the function added in Task 8):

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _background_scheduler

    log_handler = _LogBroadcastHandler()
    logging.getLogger("repo_translator").addHandler(log_handler)
    drain_task = asyncio.create_task(_drain_log_queue())

    cfg = load_config()
    _background_scheduler = scheduler_module.start_background(cfg)
    yield
    if _background_scheduler is not None:
        scheduler_module.stop_background(_background_scheduler)
        _background_scheduler = None

    drain_task.cancel()
    logging.getLogger("repo_translator").removeHandler(log_handler)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_api_server.py -k logs_ws -v`
Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `uv run pytest tests/ -q`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add repo_translator/api_server.py tests/test_api_server.py
git commit -m "feat(api): add WS /logs structured log streaming"
```

---

## Done criteria for this plan

- `uv run pytest tests/ -q` passes in full.
- `uv run uvicorn repo_translator.api_server:app --port 8000` starts cleanly and `curl localhost:8000/health` returns `{"status":"ok"}`.
- `cli.py` is untouched (`git diff main -- repo_translator/cli.py` is empty).
- Follow-up: a separate plan covers the Tauri 2 + Vite/React desktop shell that consumes this API (per `docs/superpowers/specs/2026-06-20-desktop-app-design.md`).
