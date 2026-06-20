"""Tests for repo_translator.api_server -- the desktop GUI's local HTTP/WS API."""

from __future__ import annotations

import re
import subprocess
import threading
from collections.abc import Callable
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from repo_translator.api_server import app
from repo_translator.config import AppConfig, save_config


def test_health_returns_ok() -> None:
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@contextmanager
def _patch_config_path(tmp_path: Path):
    config_path = tmp_path / ".repo-translator" / "config.yaml"
    cache_path = tmp_path / ".repo-translator" / "cache.json"
    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), patch(
        "repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path
    ):
        yield config_path


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
