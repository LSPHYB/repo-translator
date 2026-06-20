"""Tests for repo_translator.api_server -- the desktop GUI's local HTTP/WS API."""

from __future__ import annotations

import subprocess
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
