"""Tests for repo_translator.api_server -- the desktop GUI's local HTTP/WS API."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from repo_translator.api_server import app
from repo_translator.config import AppConfig, save_config


def test_health_returns_ok() -> None:
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


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
