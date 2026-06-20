"""Local HTTP/WebSocket API exposing repo_translator's core library to the
desktop GUI (Tauri app). This module wraps existing functions in `config`,
`cache_manager`, `git_manager`, `sync`, and `scheduler` without changing
their behavior -- `cli.py` remains a separate, unmodified entry point that
both share. See docs/superpowers/specs/2026-06-20-desktop-app-design.md.
"""

from __future__ import annotations

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
