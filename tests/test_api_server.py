"""Tests for repo_translator.api_server -- the desktop GUI's local HTTP/WS API."""

from __future__ import annotations

import json
import logging
import re
import subprocess
import threading
from collections.abc import Callable
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from repo_translator import api_server, cache_manager
from repo_translator.api_server import app
from repo_translator.config import (
    AppConfig,
    OutputConfig,
    TranslatorConfig,
    load_config,
    save_config,
)
from repo_translator.translator.base import TokenUsage


def test_health_returns_ok() -> None:
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["config_loaded"] is True
    assert body["cache_loaded"] is True
    assert isinstance(body["version"], str) and body["version"]


def test_cors_allows_vite_dev_origin() -> None:
    """The desktop frontend's Vite dev server (http://localhost:1420) makes
    browser-based `fetch()` calls to this API; without CORSMiddleware those
    are rejected by the browser before this test suite would ever see it
    (TestClient bypasses real CORS enforcement, but it does still exercise
    Starlette's CORSMiddleware and surface the response headers it adds).
    """
    client = TestClient(app)
    resp = client.get("/health", headers={"Origin": "http://localhost:1420"})
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == "http://localhost:1420"


def test_cors_allows_tauri_origin() -> None:
    """The packaged Tauri app's WebView makes requests from `tauri://localhost`
    on most platforms -- must be allowlisted same as the Vite dev origin."""
    client = TestClient(app)
    resp = client.get("/health", headers={"Origin": "tauri://localhost"})
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == "tauri://localhost"


def test_cors_rejects_unlisted_origin() -> None:
    """An arbitrary, non-allowlisted origin must NOT get
    `Access-Control-Allow-Origin` echoed back -- confirms the allowlist is
    scoped, not a wildcard or reflect-any-origin configuration."""
    client = TestClient(app)
    resp = client.get("/health", headers={"Origin": "http://evil.example.com"})
    assert resp.status_code == 200
    assert "access-control-allow-origin" not in resp.headers


def test_health_reports_config_load_failure_without_raising(tmp_path: Path) -> None:
    bad_config_path = tmp_path / ".repo-translator" / "config.yaml"
    bad_config_path.parent.mkdir(parents=True, exist_ok=True)
    bad_config_path.write_text("not: valid: yaml: [", encoding="utf-8")

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", bad_config_path):
        client = TestClient(app)
        resp = client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["config_loaded"] is False


@contextmanager
def _patch_config_path(tmp_path: Path):
    """Patch config/cache paths AND pre-seed config.yaml with a tmp_path
    output.base_dir.

    Patching DEFAULT_CONFIG_PATH/DEFAULT_CACHE_PATH alone is not enough: any
    test that goes on to call an endpoint backed by `sync.sync_repo` (e.g.
    POST /repos/{name}/sync) writes translated output files to wherever
    `AppConfig.output.base_dir` points. A freshly loaded `AppConfig()` (no
    config.yaml yet) defaults `output.base_dir` to `~/.repo-translator/output`
    -- a REAL path on this machine -- so without this pre-seed, every such
    test would write real files there. Writing an initial config.yaml here,
    with output.base_dir already redirected under tmp_path, means every
    later `load_config()` call in the test (including the one inside
    `add_repo`, which loads-appends-saves) preserves this safe value.
    """
    config_path = tmp_path / ".repo-translator" / "config.yaml"
    cache_path = tmp_path / ".repo-translator" / "cache.json"
    usage_path = tmp_path / ".repo-translator" / "usage.json"
    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), patch(
        "repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path
    ), patch("repo_translator.usage_manager.DEFAULT_USAGE_PATH", usage_path):
        save_config(
            AppConfig(output=OutputConfig(base_dir=str(tmp_path / "output"))),
            config_path,
        )
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


def test_put_config_bumps_revision_on_save(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path):
        client = TestClient(app)
        # `_patch_config_path`'s pre-seed save already bumped a fresh
        # AppConfig's revision 0 -> 1, so the first GET here observes 1.
        current = client.get("/config").json()
        start_revision = current["revision"]

        current["sync"]["interval_hours"] = 12
        resp = client.put("/config", json=current)
        assert resp.status_code == 200
        assert resp.json()["revision"] == start_revision + 1

        reloaded = client.get("/config").json()
        assert reloaded["revision"] == start_revision + 1


def test_put_config_stale_revision_returns_409_and_does_not_write(
    tmp_path: Path,
) -> None:
    with _patch_config_path(tmp_path):
        client = TestClient(app)
        current = client.get("/config").json()
        start_revision = current["revision"]

        # First save succeeds and bumps the server's revision by one.
        current["sync"]["interval_hours"] = 12
        first = client.put("/config", json=current)
        assert first.status_code == 200
        assert first.json()["revision"] == start_revision + 1

        before = client.get("/config").json()

        # Second save still carries the now-stale revision the client
        # originally read -- must be rejected, not silently applied.
        stale_payload = dict(current)
        stale_payload["revision"] = start_revision
        stale_payload["sync"] = {**stale_payload["sync"], "interval_hours": 18}
        resp = client.put("/config", json=stale_payload)
        assert resp.status_code == 409

        after = client.get("/config").json()
        assert after == before
        assert after["sync"]["interval_hours"] == 12
        assert after["revision"] == start_revision + 1


def test_get_config_never_exposes_raw_api_key(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path) as config_path:
        cfg = load_config(config_path)
        cfg.translator = TranslatorConfig(engine="deepseek", api_key="super-secret")
        save_config(cfg, config_path)

        client = TestClient(app)
        resp = client.get("/config")

    assert resp.status_code == 200
    body = resp.json()
    assert body["translator"]["api_key_set"] is True
    assert "api_key" not in body["translator"]


def test_put_config_omitted_api_key_preserves_stored_key(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path) as config_path:
        cfg = load_config(config_path)
        cfg.translator = TranslatorConfig(engine="deepseek", api_key="super-secret")
        save_config(cfg, config_path)

        client = TestClient(app)
        current = client.get("/config").json()
        assert current["translator"]["api_key_set"] is True

        # Round-trip what the frontend would actually send: `api_key_set`
        # carried back as-is (silently dropped by Pydantic's extra='ignore'
        # default), `api_key` omitted entirely, some other field changed.
        payload = dict(current)
        assert "api_key" not in payload["translator"]
        payload["sync"] = {**current["sync"], "concurrency": 7}

        resp = client.put("/config", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["translator"]["api_key_set"] is True
        assert "api_key" not in body["translator"]

        on_disk = load_config(config_path)
        assert on_disk.translator.api_key == "super-secret"


def test_put_config_empty_string_api_key_clears_stored_key(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path) as config_path:
        cfg = load_config(config_path)
        cfg.translator = TranslatorConfig(engine="deepseek", api_key="super-secret")
        save_config(cfg, config_path)

        client = TestClient(app)
        current = client.get("/config").json()

        payload = dict(current)
        payload["translator"] = {**current["translator"], "api_key": ""}

        resp = client.put("/config", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["translator"]["api_key_set"] is False

        on_disk = load_config(config_path)
        assert on_disk.translator.api_key is None


def test_put_config_new_api_key_sets_stored_key(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path) as config_path:
        client = TestClient(app)
        current = client.get("/config").json()

        payload = dict(current)
        payload["translator"] = {**current["translator"], "api_key": "new-real-key"}

        resp = client.put("/config", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["translator"]["api_key_set"] is True

        on_disk = load_config(config_path)
        assert on_disk.translator.api_key == "new-real-key"


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


def test_list_repos_file_count_excludes_error_only_records(tmp_path: Path) -> None:
    """A file that has only ever failed (error-only cache record, no
    translated_at) must not inflate file_count -- it has never been
    genuinely translated. Regression test for the post-record_error fix to
    list_repos()."""
    repo_dir = tmp_path / "my-project"
    _init_git_repo(repo_dir, {"README.md": "# Hi\n", "docs/guide.md": "## G\n"})

    with _patch_config_path(tmp_path):
        client = TestClient(app)
        client.post("/repos", json={"url_or_path": str(repo_dir)})

        cache_path = tmp_path / ".repo-translator" / "cache.json"
        cache_manager.save(
            cache_path,
            {
                "my-project": {
                    "README.md": {
                        "blob_hash": "abc123",
                        "translated_at": "2026-06-21T10:00:00Z",
                    },
                    "docs/guide.md": {
                        "last_error": {
                            "message": "boom",
                            "occurred_at": "2026-06-21T10:00:00Z",
                        }
                    },
                }
            },
        )

        listed = client.get("/repos").json()

    assert len(listed) == 1
    assert listed[0]["file_count"] == 1


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


def _make_fake_translate_file() -> Callable[[str, list], tuple[str, TokenUsage]]:
    _MARKED_RE = re.compile(r"⟦(\d+)⟧(.*?)⟦/\1⟧", re.DOTALL)

    def _replace(m: re.Match) -> str:
        return f"⟦{m.group(1)}⟧[ZH] {m.group(2)} [/ZH]⟦/{m.group(1)}⟧"

    def _translate_file(marked_source: str, glossary: list) -> tuple[str, TokenUsage]:
        translated = _MARKED_RE.sub(_replace, marked_source)
        return translated, TokenUsage(prompt_tokens=100, completion_tokens=50)

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


def test_list_repo_files_returns_pending_and_synced_status(tmp_path: Path) -> None:
    repo_dir = tmp_path / "my-project"
    _init_git_repo(repo_dir, {"README.md": "# Hi\n", "docs/guide.md": "## G\n"})

    mock_translator = MagicMock()
    mock_translator.translate_file.side_effect = _make_fake_translate_file()

    with _patch_config_path(tmp_path), patch(
        "repo_translator.sync.create_translator", return_value=mock_translator
    ):
        client = TestClient(app)
        client.post("/repos", json={"url_or_path": str(repo_dir)})
        # Only sync README.md -- docs/guide.md stays pending.
        client.post("/repos/my-project/files/README.md/sync")

        resp = client.get("/repos/my-project/files")

    assert resp.status_code == 200
    by_path = {f["path"]: f for f in resp.json()}
    assert set(by_path) == {"README.md", "docs/guide.md"}
    assert by_path["README.md"]["status"] == "synced"
    assert by_path["README.md"]["last_sync"] is not None
    assert by_path["README.md"]["error"] is None
    assert by_path["docs/guide.md"]["status"] == "pending"
    assert by_path["docs/guide.md"]["last_sync"] is None
    assert by_path["docs/guide.md"]["error"] is None


def test_list_repo_files_reports_error_for_failed_file(tmp_path: Path) -> None:
    """A file with only an error-only cache record (record_error, never
    successfully translated) reports status=pending with a non-null error --
    both true simultaneously, per the resolved design."""
    repo_dir = tmp_path / "my-project"
    _init_git_repo(repo_dir, {"docs/guide.md": "## G\n"})

    with _patch_config_path(tmp_path):
        client = TestClient(app)
        client.post("/repos", json={"url_or_path": str(repo_dir)})

        cache_path = tmp_path / ".repo-translator" / "cache.json"
        cache_manager.save(
            cache_path,
            {
                "my-project": {
                    "docs/guide.md": {
                        "last_error": {
                            "message": "boom",
                            "occurred_at": "2026-06-21T10:00:00Z",
                        }
                    }
                }
            },
        )

        resp = client.get("/repos/my-project/files")

    assert resp.status_code == 200
    files = resp.json()
    assert len(files) == 1
    assert files[0]["path"] == "docs/guide.md"
    assert files[0]["status"] == "pending"
    assert files[0]["last_sync"] is None
    assert files[0]["error"] == "boom"


def test_list_repo_files_excludes_files_matching_output_exclude(tmp_path: Path) -> None:
    repo_dir = tmp_path / "my-project"
    _init_git_repo(
        repo_dir, {"README.md": "# Hi\n", "CHANGELOG.md": "# Changelog\n"}
    )

    with _patch_config_path(tmp_path) as config_path:
        cfg = AppConfig(output=OutputConfig(base_dir=str(tmp_path / "output"), exclude=["CHANGELOG.md"]))
        save_config(cfg, config_path)

        client = TestClient(app)
        client.post("/repos", json={"url_or_path": str(repo_dir)})

        resp = client.get("/repos/my-project/files")

    assert resp.status_code == 200
    paths = {f["path"] for f in resp.json()}
    assert paths == {"README.md"}


def test_list_repo_files_returns_empty_for_never_synced_repo(tmp_path: Path) -> None:
    """A managed repo that was added but never cloned/synced yet (no local
    checkout exists) must return [] rather than shelling out to git on a
    nonexistent path."""
    with _patch_config_path(tmp_path), patch(
        "repo_translator.api_server.git_manager.clone"
    ):
        client = TestClient(app)
        client.post(
            "/repos", json={"url_or_path": "https://example.invalid/repo.git"}
        )

        resp = client.get("/repos/repo/files")

    assert resp.status_code == 200
    assert resp.json() == []


def test_list_repo_files_404_for_unknown_repo(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path):
        client = TestClient(app)
        resp = client.get("/repos/does-not-exist/files")
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


def test_lifespan_starts_and_stops_background_scheduler(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path):
        save_config(AppConfig(repos=[]), tmp_path / ".repo-translator" / "config.yaml")
        with TestClient(app) as client:
            resp = client.get("/health")
            assert resp.status_code == 200
            assert api_server._background_scheduler is not None
            assert api_server._background_scheduler.running is True

    assert api_server._background_scheduler is None


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


def test_logs_ws_omits_event_fields_when_absent() -> None:
    """A plain log call (no `extra=`) must not gain event/path/error keys --
    confirms the new fields are additive and don't change existing
    messages' JSON shape."""
    with TestClient(app) as client:
        with client.websocket_connect("/logs") as ws:
            logging.getLogger("repo_translator.sync").warning("plain message")
            received = ws.receive_text()

    payload = json.loads(received)
    assert payload["message"] == "plain message"
    assert "event" not in payload
    assert "path" not in payload
    assert "error" not in payload


def test_logs_ws_includes_event_fields_when_present_via_extra() -> None:
    """`extra={"event": ..., "path": ..., "error": ...}` on a LogRecord (as
    sync.py's per-file log calls now do) is forwarded into the NDJSON
    payload -- this is the mechanism the desktop frontend's running/error
    file-status overlay consumes from the WS /logs stream."""
    with TestClient(app) as client:
        with client.websocket_connect("/logs") as ws:
            logging.getLogger("repo_translator.sync").warning(
                "Translating %r ...",
                "docs/guide.md",
                extra={"event": "file_start", "path": "docs/guide.md"},
            )
            received = ws.receive_text()

    payload = json.loads(received)
    assert payload["event"] == "file_start"
    assert payload["path"] == "docs/guide.md"
    assert "error" not in payload

    with TestClient(app) as client:
        with client.websocket_connect("/logs") as ws:
            logging.getLogger("repo_translator.sync").warning(
                "Translation failed for %r: %s",
                "docs/guide.md",
                "boom",
                extra={
                    "event": "file_failed",
                    "path": "docs/guide.md",
                    "error": "boom",
                },
            )
            received = ws.receive_text()

    payload = json.loads(received)
    assert payload["event"] == "file_failed"
    assert payload["path"] == "docs/guide.md"
    assert payload["error"] == "boom"


# ---------------------------------------------------------------------------
# GET /usage
# ---------------------------------------------------------------------------


def test_get_usage_empty_returns_zero_filled_30_day_window(tmp_path: Path) -> None:
    with _patch_config_path(tmp_path):
        client = TestClient(app)
        resp = client.get("/usage")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["daily"]) == 30
    # Oldest first, ending today (UTC).
    today = datetime.now(timezone.utc).date().isoformat()
    assert body["daily"][-1]["date"] == today
    for day in body["daily"]:
        assert day["prompt_tokens"] == 0
        assert day["completion_tokens"] == 0
        assert day["total_tokens"] == 0
    assert body["by_engine"] == []
    assert body["by_repo"] == []
    assert body["totals"] == {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "cost_usd": 0.0,
        "files": 0,
    }


def test_get_usage_aggregates_recorded_usage(tmp_path: Path) -> None:
    from repo_translator import usage_manager

    with _patch_config_path(tmp_path):
        today = datetime.now(timezone.utc).date().isoformat()
        usage = usage_manager.load(usage_manager.DEFAULT_USAGE_PATH)
        usage_manager.record(usage, "langchain", "deepseek", today, 1000, 500)
        usage_manager.record(usage, "langchain", "claude", today, 200, 100)
        usage_manager.record(usage, "other-repo", "deepseek", today, 300, 150)
        usage_manager.save(usage_manager.DEFAULT_USAGE_PATH, usage)

        client = TestClient(app)
        resp = client.get("/usage")

    assert resp.status_code == 200
    body = resp.json()

    # Today's entry reflects all engines combined.
    today_entry = body["daily"][-1]
    assert today_entry["date"] == today
    assert today_entry["prompt_tokens"] == 1500
    assert today_entry["completion_tokens"] == 750
    assert today_entry["total_tokens"] == 2250

    by_engine = {e["engine"]: e for e in body["by_engine"]}
    assert by_engine["deepseek"]["prompt_tokens"] == 1300
    assert by_engine["deepseek"]["completion_tokens"] == 650
    assert by_engine["deepseek"]["total_tokens"] == 1950
    assert by_engine["deepseek"]["cost_usd"] > 0
    assert by_engine["claude"]["prompt_tokens"] == 200

    by_repo = {r["repo"]: r for r in body["by_repo"]}
    assert by_repo["langchain"]["files"] == 2
    assert by_repo["langchain"]["prompt_tokens"] == 1200
    assert by_repo["langchain"]["cost_usd"] > 0
    assert by_repo["other-repo"]["files"] == 1
    assert by_repo["other-repo"]["prompt_tokens"] == 300

    totals = body["totals"]
    assert totals["prompt_tokens"] == 1500
    assert totals["completion_tokens"] == 750
    assert totals["total_tokens"] == 2250
    assert totals["files"] == 3
    assert totals["cost_usd"] > 0


def test_get_usage_unknown_engine_falls_back_to_zero_cost(tmp_path: Path) -> None:
    """An engine name not present in the pricing table must not crash --
    cost shows as $0."""
    from repo_translator import usage_manager

    with _patch_config_path(tmp_path):
        today = datetime.now(timezone.utc).date().isoformat()
        usage = usage_manager.load(usage_manager.DEFAULT_USAGE_PATH)
        usage_manager.record(usage, "my-repo", "some-future-engine", today, 1000, 1000)
        usage_manager.save(usage_manager.DEFAULT_USAGE_PATH, usage)

        client = TestClient(app)
        resp = client.get("/usage")

    assert resp.status_code == 200
    body = resp.json()
    by_engine = {e["engine"]: e for e in body["by_engine"]}
    assert by_engine["some-future-engine"]["cost_usd"] == 0.0
    assert body["totals"]["cost_usd"] == 0.0


def test_get_usage_old_entries_outside_30_day_window_excluded_from_daily(
    tmp_path: Path,
) -> None:
    """A usage record for a day older than 30 days ago must not appear in
    the `daily` window, but still counts toward by_engine/by_repo/totals
    (which are all-time, not windowed)."""
    from repo_translator import usage_manager

    with _patch_config_path(tmp_path):
        old_day = "2020-01-01"
        usage = usage_manager.load(usage_manager.DEFAULT_USAGE_PATH)
        usage_manager.record(usage, "langchain", "deepseek", old_day, 999, 999)
        usage_manager.save(usage_manager.DEFAULT_USAGE_PATH, usage)

        client = TestClient(app)
        resp = client.get("/usage")

    assert resp.status_code == 200
    body = resp.json()
    assert all(day["date"] != old_day for day in body["daily"])
    assert all(day["total_tokens"] == 0 for day in body["daily"])
    # But all-time aggregates still include it.
    assert body["totals"]["prompt_tokens"] == 999
    by_engine = {e["engine"]: e for e in body["by_engine"]}
    assert by_engine["deepseek"]["prompt_tokens"] == 999
