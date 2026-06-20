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
