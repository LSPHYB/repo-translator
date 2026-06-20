"""Local HTTP/WebSocket API exposing repo_translator's core library to the
desktop GUI (Tauri app). This module wraps existing functions in `config`,
`cache_manager`, `git_manager`, `sync`, and `scheduler` without changing
their behavior -- `cli.py` remains a separate, unmodified entry point that
both share. See docs/superpowers/specs/2026-06-20-desktop-app-design.md.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from pathlib import Path

import click
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from repo_translator import cache_manager, git_manager, sync
from repo_translator.cli import _find_repo_by_name, _infer_repo_name, _is_git_repo, _is_url
from repo_translator.config import AppConfig, RepoConfig, load_config, save_config

app = FastAPI(title="repo-translator desktop API")

_sync_all_lock = threading.Lock()
_sync_all_running = False
_sync_all_cancel_event = threading.Event()


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
