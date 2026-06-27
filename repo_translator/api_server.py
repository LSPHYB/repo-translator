"""Local HTTP/WebSocket API exposing repo_translator's core library to the
desktop GUI (Tauri app). This module wraps existing functions in `config`,
`cache_manager`, `git_manager`, `sync`, and `scheduler` without changing
their behavior -- `cli.py` remains a separate, unmodified entry point that
both share. See docs/superpowers/specs/2026-06-20-desktop-app-design.md.

Run with: `uvicorn repo_translator.api_server:app --port 8000`
"""

from __future__ import annotations

import asyncio
import importlib.metadata
import json
import logging
import queue
import shutil
import socket
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import click
import uvicorn
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from repo_translator import cache_manager, git_manager, sync, usage_manager
from repo_translator import scheduler as scheduler_module
from repo_translator.cli import _find_repo_by_name, _infer_repo_name, _is_git_repo, _is_url
from repo_translator.sync import _is_excluded
from repo_translator.config import AppConfig, RepoConfig, load_config, save_config
from repo_translator.translator.factory import create_translator

_background_scheduler: BackgroundScheduler | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _background_scheduler

    log_handler = _LogBroadcastHandler()
    rt_logger = logging.getLogger("repo_translator")
    # The package logger has no level configured anywhere, so it would inherit
    # root's default WARNING and silently drop every INFO-level line -- including
    # sync.py's per-file file_start/file_translated events that the desktop log
    # console and the per-file status overlay both rely on. Force INFO so those
    # records actually reach the broadcast handler.
    rt_logger.setLevel(logging.INFO)
    rt_logger.addHandler(log_handler)
    drain_task = asyncio.create_task(_drain_log_queue())

    cfg = load_config()
    _background_scheduler = scheduler_module.start_background(cfg)
    yield
    if _background_scheduler is not None:
        scheduler_module.stop_background(_background_scheduler)
        _background_scheduler = None

    drain_task.cancel()
    logging.getLogger("repo_translator").removeHandler(log_handler)


app = FastAPI(title="repo-translator desktop API", lifespan=lifespan)

# The desktop GUI is a browser-based WebView (Tauri 2) making same-machine
# but cross-origin `fetch()`/WebSocket calls to this sidecar process -- this
# is genuinely cross-origin even in the packaged app, not just a dev-mode
# quirk (Tauri's WebView enforces normal browser CORS rules against
# `http://127.0.0.1:<sidecar-port>`; see
# https://github.com/dieharders/example-tauri-v2-python-server-sidecar for
# the same pattern). Without this middleware, every browser-based request
# from the frontend is rejected with no `Access-Control-Allow-Origin`
# header, regardless of whether the JSON body itself is correct.
#
# Scoped to exactly the known desktop-frontend origins -- no wildcard `*`,
# no dynamic origin reflection, no `allow_credentials`:
#   - http://localhost:1420       -- `npm run dev` (Vite dev server)
#   - tauri://localhost           -- packaged Tauri WebView origin (macOS/Linux)
#   - http://127.0.0.1:1420       -- Vite dev server reached via loopback IP
# `allow_origin_regex` additionally covers the `http://127.0.0.1:<port>`
# family in case Vite's dev port ever changes from the documented 1420.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "tauri://localhost"],
    allow_origin_regex=r"http://127\.0\.0\.1(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)

_sync_all_lock = threading.Lock()
_sync_all_running = False
# A single shared "stop syncing" signal. Set by the cancel endpoint and
# observed by BOTH the sync-all run and any single-repo sync (each clears it on
# start, then passes `.is_set` as `should_cancel`). FastAPI runs these sync
# endpoints on its threadpool, so the cancel request lands on a different
# thread than the in-flight sync and this flag is how they communicate.
_sync_all_cancel_event = threading.Event()

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
        data = {
            "time": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # `sync.py`'s per-file log calls attach `event`/`path`/(`error`) via
        # `extra=` (see _process_one_file) so the desktop frontend's
        # running/error file-status overlay can key off them -- included
        # here only when present so every other log line's JSON shape stays
        # byte-identical to before this field was added.
        event = getattr(record, "event", None)
        if event is not None:
            data["event"] = event
        path = getattr(record, "path", None)
        if path is not None:
            data["path"] = path
        error = getattr(record, "error", None)
        if error is not None:
            data["error"] = error
        # `repo` (which repo a per-file/sync-lifecycle event belongs to) and
        # `total` (changed-file count, only on the `sync_start` event) let the
        # desktop frontend attribute file events to the right repo card and
        # compute a real per-repo progress bar -- previously file paths alone
        # were ambiguous across repos during a sync-all.
        repo = getattr(record, "repo", None)
        if repo is not None:
            data["repo"] = repo
        total = getattr(record, "total", None)
        if total is not None:
            data["total"] = total
        payload = json.dumps(data)
        _log_queue.put_nowait(payload)


async def _drain_log_queue() -> None:
    """Forward every queued log line to all currently-connected WebSockets.

    Uses a short-timeout poll (rather than a single blocking
    `queue.Queue.get()` handed to the default executor) so that cancelling
    this task on lifespan shutdown actually takes effect promptly -- a bare
    blocking `get()` running in the executor is not interruptible by
    `Task.cancel()` and would otherwise hang the event loop's executor
    shutdown forever waiting for that worker thread to finish.
    """
    loop = asyncio.get_event_loop()
    while True:
        try:
            payload = await loop.run_in_executor(None, _log_queue.get, True, 0.1)
        except queue.Empty:
            continue
        for ws in list(_connected_websockets):
            try:
                await ws.send_text(payload)
            except Exception:
                _connected_websockets.discard(ws)


@app.get("/health")
def health() -> dict:
    """Liveness check: "is the process alive and able to answer requests at
    all". `config_loaded`/`cache_loaded` are cheap, synchronous checks that
    Task 11's Tauri startup gate needs to know the backend can actually do
    work (not just that the HTTP server is up) -- see the design note in
    docs/superpowers/plans/2026-06-20-desktop-frontend.md Task 1: this stays
    liveness-flavored on purpose; deeper readiness checks (translator API key
    validity, network reachability) belong in a future `/ready` endpoint, not
    more fields bolted onto `/health`.

    Both checks swallow their own exceptions -- a corrupt config.yaml or
    cache.json must never turn a liveness probe into a 500.
    """
    try:
        load_config()
        config_loaded = True
    except Exception:
        config_loaded = False

    try:
        cache_manager.load(cache_manager.DEFAULT_CACHE_PATH)
        cache_loaded = True
    except Exception:
        cache_loaded = False

    try:
        version = importlib.metadata.version("repo-translator")
    except importlib.metadata.PackageNotFoundError:
        version = "unknown"

    return {
        "status": "ok",
        "config_loaded": config_loaded,
        "cache_loaded": cache_loaded,
        "version": version,
    }


def _serialize_config(cfg: AppConfig) -> dict:
    """Serialize an ``AppConfig`` for an API response, never including the
    literal translator API key. The literal value is replaced with a
    boolean ``api_key_set`` -- see the module-level note above `get_config`/
    `put_config` for why this matters (don't rely on frontend discipline to
    avoid leaking a secret into DevTools/crash reports/error boundaries;
    close it at the source instead).

    ``output.base_dir`` is expanded (``~`` → absolute home path) so the
    frontend receives a fully resolved path it can pass directly to Tauri's
    ``revealItemInDir`` without platform-specific tilde expansion.
    """
    data = cfg.model_dump(mode="json", exclude_none=True)
    translator = data.get("translator", {})
    translator.pop("api_key", None)
    translator["api_key_set"] = bool(cfg.translator.api_key)
    data["translator"] = translator
    if "output" in data and "base_dir" in data["output"]:
        data["output"]["base_dir"] = str(Path(data["output"]["base_dir"]).expanduser())
    return data


@app.get("/config")
def get_config() -> dict:
    return _serialize_config(load_config())


@app.put("/config")
def put_config(payload: dict) -> dict:
    # Loaded once, up front: serves both the API-key-preservation resolution
    # immediately below and the revision comparison further down. Do not
    # call load_config() again in this handler.
    current = load_config()

    # Resolve what `payload["translator"]["api_key"]` should actually mean
    # before validating, since the API never returns the literal key value
    # (see _serialize_config) -- the frontend has no way to "send back what
    # it got" for this one field the way it does for every other setting.
    # Three cases, matching what SettingsScreen sends in each UI state:
    #   - key absent/None  -> preserve the existing stored key (the user
    #     didn't touch the field; this is how every *other* setting saves
    #     without forcing a re-paste of the key).
    #   - key == ""        -> explicit clear; normalized to None below.
    #   - key == non-empty -> sets/replaces the stored key.
    incoming_translator = dict(payload.get("translator") or {})
    if incoming_translator.get("api_key") is None:
        incoming_translator["api_key"] = current.translator.api_key
    payload = {**payload, "translator": incoming_translator}

    try:
        new_config = AppConfig.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Empty-string and "no key" must persist as the same None state.
    if new_config.translator.api_key == "":
        new_config.translator.api_key = None

    # Optimistic-concurrency check: the client must have last read the
    # config at the server's current revision. A mismatch means some other
    # save (e.g. the other screen) landed since this client loaded its copy
    # -- reject rather than silently overwriting those edits. See the scope
    # note on `AppConfig.revision` in config.py for what this guard does and
    # does not protect against.
    if new_config.revision != current.revision:
        raise HTTPException(
            status_code=409,
            detail="配置已更新，请重新加载后重试",
        )

    save_config(new_config)
    return _serialize_config(new_config)


@app.post("/config/test-connection")
def test_connection() -> dict:
    """Test whether the configured translator engine can reach its API.

    Makes a minimal ``translate_raw`` call ("Hi") to verify the API key and
    network reachability without touching any repo files.  Returns
    ``{"ok": true}`` on success or ``{"ok": false, "error": "..."}`` on any
    failure (wrong key, network error, missing key, etc.).
    """
    cfg = load_config()
    if not cfg.translator.api_key:
        return {"ok": False, "error": "未配置 API key，请先在翻译引擎设置中填入 API Key"}
    try:
        translator = create_translator(cfg.translator)
        translator.translate_raw("Hi")
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@app.get("/repos")
def list_repos() -> list[dict]:
    cfg = load_config()
    cache = cache_manager.load(cache_manager.DEFAULT_CACHE_PATH)
    base_dir = Path(cfg.output.base_dir).expanduser()
    result = []
    for repo in cfg.repos:
        repo_cache = cache.get(repo.name, {})
        timestamps = [
            v.get("translated_at", "")
            for v in repo_cache.values()
            if v.get("translated_at")
        ]
        # Resolve the *effective* output directory the same way sync.py does
        # (per-repo output_dir wins, else base_dir/<name>) so the desktop
        # "打开目录" action opens where files were actually written -- it must
        # not assume base_dir/<name> for repos that set a custom output_dir.
        output_dir = (
            str(Path(repo.output_dir).expanduser())
            if repo.output_dir
            else str(base_dir / repo.name)
        )
        result.append(
            {
                "name": repo.name,
                "kind": "managed" if repo.is_managed else "external",
                "branch": repo.branch,
                "output_dir": output_dir,
                "last_sync": max(timestamps) if timestamps else None,
                # Count only records with a `translated_at` (i.e. files that
                # have genuinely been translated at least once) -- NOT
                # `len(repo_cache)`, which would also count error-only
                # records created by `cache_manager.record_error` for files
                # that have only ever failed (see sync.py's `_process_one_file`
                # failure path). `timestamps` above is already filtered this
                # way, so just reuse its length.
                "file_count": len(timestamps),
            }
        )
    return result


class AddRepoRequest(BaseModel):
    url_or_path: str
    name: str | None = None
    output_dir: str | None = None


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
        repo_config = RepoConfig(name=repo_name, url=payload.url_or_path, added_at=now, output_dir=payload.output_dir)
        clone_dest = output_base / "repos" / repo_name
        # `git clone` refuses to write into a non-empty directory. A leftover
        # checkout (e.g. from a previous add that was later removed, or a
        # crashed run) would otherwise make this fail with a misleading
        # "already exists" error, so clear it first.
        if clone_dest.exists():
            shutil.rmtree(clone_dest, ignore_errors=True)
        try:
            git_manager.clone(payload.url_or_path, clone_dest)
        except git_manager.GitOperationError as exc:
            # Save the config entry anyway so the user can retry later via sync.
            cfg.repos.append(repo_config)
            save_config(cfg)
            raise HTTPException(
                status_code=502,
                detail=(
                    f"Clone failed: {exc}. The repository '{repo_name}' was "
                    f"still added to the tracked list; retry with a sync call."
                ),
            ) from exc
    else:
        local_path = Path(payload.url_or_path).expanduser().resolve()
        if not _is_git_repo(local_path):
            raise HTTPException(
                status_code=400,
                detail=f"'{local_path}' does not appear to be a git repository.",
            )
        repo_config = RepoConfig(name=repo_name, path=str(local_path), added_at=now, output_dir=payload.output_dir)

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
        repo_config = _find_repo_by_name(cfg, name)
    except click.ClickException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    cfg.repos = [r for r in cfg.repos if r.name != name]
    save_config(cfg)

    # Drop this repo's translation-cache entry. Without this, re-adding the
    # same name later finds the old per-file blob hashes still cached; a fresh
    # clone of the same repo has identical blob hashes, so the diff sees zero
    # changed files and every file looks "already translated" -- the repo's
    # docs never get re-translated and last_sync/file_count show stale values.
    cache = cache_manager.load(cache_manager.DEFAULT_CACHE_PATH)
    if name in cache:
        del cache[name]
        cache_manager.save(cache_manager.DEFAULT_CACHE_PATH, cache)

    # Managed repos own an internal clone under <base>/repos/<name>. Remove it
    # so re-adding the same repo later clones fresh -- git refuses to clone
    # into a non-empty dir, which previously surfaced as an "already exists"
    # error on re-add. External repos point at a user-owned checkout we must
    # never delete.
    if repo_config.is_managed:
        clone_dest = Path(cfg.output.base_dir).expanduser() / "repos" / name
        shutil.rmtree(clone_dest, ignore_errors=True)


@app.get("/repos/{name}/files")
def list_repo_files(name: str) -> list[dict]:
    """Per-file metadata for one tracked repo's `.md` files: `status`
    (`"synced"` if the cached blob_hash matches the current one, else
    `"pending"`), `last_sync` (the cached `translated_at`, if any), and
    `error` (the file's persisted `last_error.message`, if any).

    Never returns `status: "running"` -- that's a frontend-only overlay
    sourced from the `/logs` WebSocket's `file_start`/`file_translated`/
    `file_failed` events, not from this read-only REST snapshot. A file can
    be `"pending"` AND carry a non-null `error` simultaneously (failed last
    attempt, still due for retry) -- that's correct, not a bug.

    Read-only: resolves the repo's local checkout path the same way
    `git_manager.clone_or_pull` does, but never clones/pulls. If the repo
    has never been synced (no local checkout / `.git` dir yet), returns `[]`
    rather than shelling out to `git` on a nonexistent path.
    """
    cfg = load_config()
    try:
        repo_config = _find_repo_by_name(cfg, name)
    except click.ClickException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if repo_config.is_external:
        repo_path = Path(repo_config.path).expanduser()  # type: ignore[arg-type]
    else:
        repo_path = (
            Path(cfg.output.base_dir).expanduser() / "repos" / repo_config.name
        )

    if not (repo_path / ".git").exists():
        return []

    file_blob_map = git_manager.get_file_blob_map(repo_path)
    md_files = git_manager.list_md_files(file_blob_map)

    exclude_patterns = cfg.output.exclude
    if exclude_patterns:
        md_files = [f for f in md_files if not _is_excluded(f, exclude_patterns)]

    cache = cache_manager.load(cache_manager.DEFAULT_CACHE_PATH)
    repo_cache = cache.get(name, {})

    result = []
    for path in md_files:
        record = repo_cache.get(path)
        synced = record is not None and record.get("blob_hash") == file_blob_map[path]
        last_error = record.get("last_error") if record is not None else None
        result.append(
            {
                "path": path,
                "status": "synced" if synced else "pending",
                "last_sync": record.get("translated_at") if record is not None else None,
                "error": last_error.get("message") if last_error is not None else None,
            }
        )
    return result


@app.post("/repos/{name}/sync")
def sync_repo_endpoint(name: str) -> dict:
    cfg = load_config()
    try:
        repo_config = _find_repo_by_name(cfg, name)
    except click.ClickException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    cache = cache_manager.load(cache_manager.DEFAULT_CACHE_PATH)
    usage = usage_manager.load(usage_manager.DEFAULT_USAGE_PATH)
    before = len(cache.get(name, {}))
    # Make single-repo syncs cancellable via the same stop signal the
    # "停止全部" button uses. Clear any stale cancel from a previous run first.
    _sync_all_cancel_event.clear()
    cache = sync.sync_repo(
        repo_config,
        cfg,
        cache,
        should_cancel=_sync_all_cancel_event.is_set,
        usage=usage,
    )
    cache_manager.save(cache_manager.DEFAULT_CACHE_PATH, cache)
    usage_manager.save(usage_manager.DEFAULT_USAGE_PATH, usage)
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
    usage = usage_manager.load(usage_manager.DEFAULT_USAGE_PATH)
    cache = sync.sync_repo(repo_config, cfg, cache, only_files=[path], usage=usage)
    cache_manager.save(cache_manager.DEFAULT_CACHE_PATH, cache)
    usage_manager.save(usage_manager.DEFAULT_USAGE_PATH, usage)

    succeeded = path in cache.get(name, {})
    if not succeeded:
        raise HTTPException(
            status_code=500, detail=f"Failed to translate '{path}'."
        )
    return {"name": name, "path": path, "succeeded": True}


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
        usage = usage_manager.load(usage_manager.DEFAULT_USAGE_PATH)
        cache = sync.sync_all(
            cfg, cache, should_cancel=_sync_all_cancel_event.is_set, usage=usage
        )
        cache_manager.save(cache_manager.DEFAULT_CACHE_PATH, cache)
        usage_manager.save(usage_manager.DEFAULT_USAGE_PATH, usage)
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


def _cost_usd(engine: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate USD cost from `usage_manager.PRICING_USD_PER_1K_TOKENS`.
    Unknown/future engine names fall back to (0.0, 0.0) -- cost shows as
    $0, never crashes (see that table's comment for the pricing caveats).
    """
    prompt_rate, completion_rate = usage_manager.PRICING_USD_PER_1K_TOKENS.get(
        engine, (0.0, 0.0)
    )
    return (prompt_tokens / 1000) * prompt_rate + (completion_tokens / 1000) * completion_rate


@app.get("/usage")
def get_usage() -> dict:
    """Aggregated token-usage/cost stats for the desktop UsageScreen.

    Backend does all aggregation (daily window, per-engine/per-repo totals,
    cost estimation) so the frontend stays dumb, consistent with
    `/repos/{name}/files`'s existing precedent. `daily` is always exactly 30
    entries (oldest first, ending today UTC), zero-filled for days with no
    recorded usage -- there is no range selector; see Task 9's design note
    for why a `7d`/`30d`/`all` selector was dropped from the frontend.
    """
    usage = usage_manager.load(usage_manager.DEFAULT_USAGE_PATH)
    daily_raw = usage.get("daily", {})
    repos_raw = usage.get("repos", {})

    today = datetime.now(timezone.utc).date()
    daily: list[dict] = []
    for offset in range(29, -1, -1):
        day = (today - timedelta(days=offset)).isoformat()
        day_bucket = daily_raw.get(day, {})
        prompt_tokens = sum(e["prompt_tokens"] for e in day_bucket.values())
        completion_tokens = sum(e["completion_tokens"] for e in day_bucket.values())
        daily.append(
            {
                "date": day,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            }
        )

    # by_engine: all-time totals per engine, aggregated across every
    # recorded day (not just the last 30) -- mirrors `repos` below, which is
    # likewise all-time, not windowed to the 30-day daily chart.
    by_engine_totals: dict[str, dict[str, int]] = {}
    for day_bucket in daily_raw.values():
        for engine, counts in day_bucket.items():
            acc = by_engine_totals.setdefault(
                engine, {"prompt_tokens": 0, "completion_tokens": 0, "files": 0}
            )
            acc["prompt_tokens"] += counts["prompt_tokens"]
            acc["completion_tokens"] += counts["completion_tokens"]
            acc["files"] += counts["files"]

    by_engine = []
    for engine, counts in sorted(by_engine_totals.items()):
        by_engine.append(
            {
                "engine": engine,
                "prompt_tokens": counts["prompt_tokens"],
                "completion_tokens": counts["completion_tokens"],
                "total_tokens": counts["prompt_tokens"] + counts["completion_tokens"],
                "cost_usd": _cost_usd(
                    engine, counts["prompt_tokens"], counts["completion_tokens"]
                ),
            }
        )

    by_repo = []
    for repo_name, engines in sorted(repos_raw.items()):
        prompt_tokens = sum(e["prompt_tokens"] for e in engines.values())
        completion_tokens = sum(e["completion_tokens"] for e in engines.values())
        files = sum(e["files"] for e in engines.values())
        cost_usd = sum(
            _cost_usd(engine, e["prompt_tokens"], e["completion_tokens"])
            for engine, e in engines.items()
        )
        by_repo.append(
            {
                "repo": repo_name,
                "files": files,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
                "cost_usd": cost_usd,
            }
        )

    totals = {
        "prompt_tokens": sum(e["prompt_tokens"] for e in by_engine),
        "completion_tokens": sum(e["completion_tokens"] for e in by_engine),
        "total_tokens": sum(e["total_tokens"] for e in by_engine),
        "cost_usd": sum(e["cost_usd"] for e in by_engine),
        "files": sum(counts["files"] for counts in by_engine_totals.values()),
    }

    return {
        "daily": daily,
        "by_engine": by_engine,
        "by_repo": by_repo,
        "totals": totals,
    }


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


def main() -> None:
    """Entry point for the desktop app's Tauri sidecar (Task 11) to spawn as
    a subprocess.

    Binds an OS-assigned port (port=0) up front so the packaged app never
    collides with a stale instance, a second app launch, or an unrelated
    process already holding a fixed port. Prints exactly one JSON line to
    stdout -- BEFORE logging is configured or uvicorn/any dependency gets a
    chance to print anything of its own -- so the parent process (today:
    manual verification; eventually: Task 11's Rust sidecar spawn) can read
    stdout line-by-line, parse the *first* line as JSON, and extract `port`
    without depending on a fragile plain-text format.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]

    print(json.dumps({"type": "startup", "port": port}), flush=True)

    # uvicorn 0.49.0: `Server.run`/`Server.serve` accept a pre-bound
    # `sockets: list[socket.socket]` list -- this is the documented mechanism
    # for serving on an already-bound socket. (The alternative,
    # `uvicorn.run(app, fd=sock.fileno())`, re-wraps the fd via
    # `socket.fromfd(fd, socket.AF_UNIX, socket.SOCK_STREAM)` internally,
    # which is uvicorn's systemd-socket-activation path and re-labels the
    # socket family as AF_UNIX even for a TCP socket -- it works, but
    # `Server.run(sockets=[sock])` uses our actual already-correct AF_INET
    # socket object directly and is the more explicit, documented-for-this
    # exact purpose API, so we use it instead.)
    config = uvicorn.Config(app, lifespan="on")
    server = uvicorn.Server(config)
    server.run(sockets=[sock])


if __name__ == "__main__":
    main()
