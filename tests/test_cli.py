"""Tests for repo_translator.cli commands using click.testing.CliRunner."""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest
from click.testing import CliRunner

from repo_translator.cli import main
from repo_translator.config import AppConfig, RepoConfig, load_config, save_config


@pytest.fixture
def runner() -> CliRunner:
    return CliRunner()


def _init_git_repo(repo_dir: Path, files: dict[str, str]) -> None:
    """Create a minimal git repo at *repo_dir* with the given files committed."""
    subprocess.run(
        ["git", "init", "-q", "-b", "main", str(repo_dir)], check=True
    )
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


def _fake_blob_map(files: list[str]) -> dict[str, str]:
    """Return a fake blob map for the given file paths."""
    return {f: "abc123hash" for f in files}


# ---------------------------------------------------------------------------
# Helpers for setting up temp config / cache paths
# ---------------------------------------------------------------------------


def _setup_temp_paths(tmp_path: Path) -> tuple[Path, Path]:
    """Create temp config and cache directories and return (config_path, cache_path)."""
    config_dir = tmp_path / ".repo-translator"
    config_dir.mkdir()
    return config_dir / "config.yaml", config_dir / "cache.json"


# ---------------------------------------------------------------------------
# add url
# ---------------------------------------------------------------------------


def test_add_url_clones_and_syncs(tmp_path: Path, runner: CliRunner) -> None:
    """Adding a URL repo clones it, creates a RepoConfig with url, and runs sync."""
    config_path, cache_path = _setup_temp_paths(tmp_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path), \
         patch("repo_translator.cli.git_manager.clone") as mock_clone, \
         patch("repo_translator.cli.git_manager.get_file_blob_map",
               return_value=_fake_blob_map(["README.md", "docs/guide.md"])), \
         patch("repo_translator.cli.sync.sync_repo") as mock_sync, \
         patch("repo_translator.cli.cache_manager.save") as mock_cache_save:

        # sync_repo should update the cache.
        def _fake_sync(repo_config, app_config, cache):
            cache.setdefault(repo_config.name, {})["README.md"] = {
                "blob_hash": "abc123hash",
                "translated_at": "2026-01-01T00:00:00Z",
            }
            cache.setdefault(repo_config.name, {})["docs/guide.md"] = {
                "blob_hash": "abc123hash",
                "translated_at": "2026-01-01T00:00:00Z",
            }
            return cache

        mock_sync.side_effect = _fake_sync

        result = runner.invoke(
            main, ["add", "https://github.com/user/my-repo.git"]
        )

        assert result.exit_code == 0, result.output

        # Clone was called.
        mock_clone.assert_called_once()
        clone_arg_url, clone_arg_dest = mock_clone.call_args[0]
        assert clone_arg_url == "https://github.com/user/my-repo.git"
        assert clone_arg_dest.name == "my-repo"

        # Sync was invoked.
        mock_sync.assert_called_once()

        # Cache was saved.
        mock_cache_save.assert_called_once()

        # Config was saved with the RepoConfig.
        saved_config = load_config(config_path)
        assert len(saved_config.repos) == 1
        assert saved_config.repos[0].name == "my-repo"
        assert saved_config.repos[0].url == "https://github.com/user/my-repo.git"
        assert saved_config.repos[0].path is None

        # Output messages.
        assert "Cloning" in result.output
        assert "Clone complete" in result.output
        assert "Found" in result.output
        assert "markdown file" in result.output
        assert "Done" in result.output


def test_add_url_custom_name(tmp_path: Path, runner: CliRunner) -> None:
    """--name overrides the inferred repo name from the URL."""
    config_path, cache_path = _setup_temp_paths(tmp_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path), \
         patch("repo_translator.cli.git_manager.clone"), \
         patch("repo_translator.cli.git_manager.get_file_blob_map",
               return_value=_fake_blob_map(["README.md"])), \
         patch("repo_translator.cli.sync.sync_repo"), \
         patch("repo_translator.cli.cache_manager.save"):

        result = runner.invoke(
            main,
            ["add", "https://github.com/user/some-repo", "--name", "custom"],
        )

        assert result.exit_code == 0, result.output

        saved = load_config(config_path)
        assert len(saved.repos) == 1
        assert saved.repos[0].name == "custom"
        assert saved.repos[0].url == "https://github.com/user/some-repo"


# ---------------------------------------------------------------------------
# add local path
# ---------------------------------------------------------------------------


def test_add_local_path_creates_path_entry(tmp_path: Path, runner: CliRunner) -> None:
    """Adding a local git repo creates a RepoConfig with path, never calls clone."""
    git_repo = tmp_path / "my-project"
    _init_git_repo(git_repo, {"README.md": "# Hello\n"})

    config_path, cache_path = _setup_temp_paths(tmp_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path), \
         patch("repo_translator.cli.git_manager.clone") as mock_clone, \
         patch("repo_translator.cli.sync.sync_repo"), \
         patch("repo_translator.cli.cache_manager.save"):

        result = runner.invoke(main, ["add", str(git_repo)])

        assert result.exit_code == 0, result.output

        # Clone must NOT be called for a local path.
        mock_clone.assert_not_called()

        saved = load_config(config_path)
        assert len(saved.repos) == 1
        assert saved.repos[0].name == "my-project"
        assert saved.repos[0].path == str(git_repo)
        assert saved.repos[0].url is None

        assert "Using local repository" in result.output


def test_add_local_path_not_a_git_repo_fails(
    tmp_path: Path, runner: CliRunner
) -> None:
    """Adding a directory that is not a git repo raises an error."""
    not_repo = tmp_path / "not-a-repo"
    not_repo.mkdir()

    result = runner.invoke(main, ["add", str(not_repo)])

    assert result.exit_code != 0
    assert "not appear to be a git repository" in result.output


# ---------------------------------------------------------------------------
# add duplicate
# ---------------------------------------------------------------------------


def test_add_duplicate_name_fails(tmp_path: Path, runner: CliRunner) -> None:
    """Adding a repo whose name already exists in config returns an error."""
    config_path, cache_path = _setup_temp_paths(tmp_path)

    # Pre-populate config with a repo named "existing".
    config = AppConfig(
        repos=[RepoConfig(name="existing", url="https://example.com/repo.git")]
    )
    save_config(config, config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path):
        result = runner.invoke(
            main, ["add", "https://github.com/user/existing.git"]
        )

    assert result.exit_code != 0
    assert "already tracked" in result.output


# ---------------------------------------------------------------------------
# translate
# ---------------------------------------------------------------------------


def test_translate_existing_repo_calls_sync(
    tmp_path: Path, runner: CliRunner
) -> None:
    """translate <name> loads config, calls sync_repo, and saves cache."""
    config_path, cache_path = _setup_temp_paths(tmp_path)

    config = AppConfig(
        repos=[
            RepoConfig(
                name="myrepo",
                url="https://example.com/repo.git",
            )
        ]
    )
    save_config(config, config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path), \
         patch("repo_translator.cli.git_manager.clone_or_pull",
               return_value=tmp_path / "repos" / "myrepo") as mock_cp, \
         patch("repo_translator.cli.git_manager.get_file_blob_map",
               return_value=_fake_blob_map(["README.md", "docs/intro.md"])), \
         patch(
             "repo_translator.cli.cache_manager.get_changed_files",
             return_value=["README.md", "docs/intro.md"],
         ), \
         patch("repo_translator.cli.sync.sync_repo") as mock_sync, \
         patch("repo_translator.cli.cache_manager.save") as mock_cache_save:

        def _fake_sync(repo_config, app_config, cache):
            cache.setdefault("myrepo", {})["README.md"] = {
                "blob_hash": "abc", "translated_at": "now"
            }
            cache.setdefault("myrepo", {})["docs/intro.md"] = {
                "blob_hash": "abc", "translated_at": "now"
            }
            return cache

        mock_sync.side_effect = _fake_sync

        result = runner.invoke(main, ["translate", "myrepo"])

    assert result.exit_code == 0, result.output
    mock_cp.assert_called_once()
    mock_sync.assert_called_once()
    mock_cache_save.assert_called_once()
    assert "file(s) processed" in result.output
    assert "succeeded" in result.output


def test_translate_no_changed_files_shows_message(
    tmp_path: Path, runner: CliRunner
) -> None:
    """When no files have changed, show 'No changed files.' and don't sync."""
    config_path, cache_path = _setup_temp_paths(tmp_path)

    save_config(
        AppConfig(
            repos=[
                RepoConfig(name="myrepo", url="https://example.com/repo.git")
            ]
        ),
        config_path,
    )

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cli.git_manager.clone_or_pull",
               return_value=tmp_path), \
         patch("repo_translator.cli.git_manager.get_file_blob_map",
               return_value=_fake_blob_map(["README.md"])), \
         patch("repo_translator.cli.cache_manager.get_changed_files",
               return_value=[]), \
         patch("repo_translator.cli.sync.sync_repo") as mock_sync:

        result = runner.invoke(main, ["translate", "myrepo"])

    assert result.exit_code == 0, result.output
    mock_sync.assert_not_called()
    assert "No changed files" in result.output


def test_translate_unknown_repo_fails(tmp_path: Path, runner: CliRunner) -> None:
    """Translating a repo not in config raises an error."""
    config_path, _ = _setup_temp_paths(tmp_path)
    save_config(AppConfig(), config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path):
        result = runner.invoke(main, ["translate", "nonexistent"])

    assert result.exit_code != 0
    assert "not found" in result.output


# ---------------------------------------------------------------------------
# list
# ---------------------------------------------------------------------------


def test_list_shows_managed_and_external(
    tmp_path: Path, runner: CliRunner
) -> None:
    """list output distinguishes managed vs external repos."""
    config_path, cache_path = _setup_temp_paths(tmp_path)

    config = AppConfig(
        repos=[
            RepoConfig(name="managed-repo", url="https://example.com/r.git"),
            RepoConfig(name="external-repo", path="/home/user/code/r"),
        ]
    )
    save_config(config, config_path)

    # Write cache data for the managed repo only.
    from repo_translator import cache_manager
    cache_manager.save(
        cache_path,
        {
            "managed-repo": {
                "README.md": {
                    "blob_hash": "abc",
                    "translated_at": "2026-06-01T12:00:00Z",
                }
            }
        },
    )

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path):

        result = runner.invoke(main, ["list"])

    assert result.exit_code == 0, result.output
    assert "managed-repo" in result.output
    assert "external-repo" in result.output
    assert "managed" in result.output
    assert "external" in result.output


def test_list_empty_shows_message(tmp_path: Path, runner: CliRunner) -> None:
    """list with no repos shows a helpful message."""
    config_path, cache_path = _setup_temp_paths(tmp_path)
    save_config(AppConfig(), config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cache_manager.DEFAULT_CACHE_PATH", cache_path):

        result = runner.invoke(main, ["list"])

    assert result.exit_code == 0, result.output
    assert "No repositories" in result.output


# ---------------------------------------------------------------------------
# remove
# ---------------------------------------------------------------------------


def test_remove_managed_repo(tmp_path: Path, runner: CliRunner) -> None:
    """Removing a managed repo removes it from config and shows a note."""
    config_path, _ = _setup_temp_paths(tmp_path)

    save_config(
        AppConfig(
            repos=[
                RepoConfig(name="managed", url="https://example.com/r.git"),
                RepoConfig(name="external", path="/tmp/external"),
            ]
        ),
        config_path,
    )

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path):
        result = runner.invoke(main, ["remove", "managed"])

    assert result.exit_code == 0, result.output
    assert "removed from config" in result.output
    assert "manually deleted" in result.output

    # Verify the repo is gone.
    saved = load_config(config_path)
    assert [r.name for r in saved.repos] == ["external"]


def test_remove_unknown_repo_fails(tmp_path: Path, runner: CliRunner) -> None:
    """Removing a repo not in config raises an error."""
    config_path, _ = _setup_temp_paths(tmp_path)
    save_config(AppConfig(), config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path):
        result = runner.invoke(main, ["remove", "nonexistent"])

    assert result.exit_code != 0
    assert "not found" in result.output


# ---------------------------------------------------------------------------
# config
# ---------------------------------------------------------------------------


def test_config_no_args_shows_yaml(tmp_path: Path, runner: CliRunner) -> None:
    """config with no arguments prints the full config as YAML."""
    config_path, _ = _setup_temp_paths(tmp_path)

    config = AppConfig()
    config.translator.engine = "openai"  # type: ignore[attr-defined]
    save_config(config, config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path):
        result = runner.invoke(main, ["config"])

    assert result.exit_code == 0, result.output
    # Check that YAML output mentions the set value.
    assert "openai" in result.output
    # Check that YAML-ish structure is present.
    assert "translator:" in result.output


def test_config_get_simple_key(tmp_path: Path, runner: CliRunner) -> None:
    """--get with a simple key prints the value."""
    config_path, _ = _setup_temp_paths(tmp_path)

    save_config(
        AppConfig(translator={"engine": "deepseek"}),  # type: ignore[arg-type]
        config_path,
    )

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path):
        result = runner.invoke(main, ["config", "--get", "translator.engine"])

    assert result.exit_code == 0, result.output
    assert "deepseek" in result.output


def test_config_get_invalid_key(tmp_path: Path, runner: CliRunner) -> None:
    """--get with a nonexistent key raises an error."""
    config_path, _ = _setup_temp_paths(tmp_path)
    save_config(AppConfig(), config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path):
        result = runner.invoke(
            main, ["config", "--get", "translator.nonexistent_field"]
        )

    assert result.exit_code != 0
    assert "Invalid config key" in result.output


def test_config_set_updates_and_saves(tmp_path: Path, runner: CliRunner) -> None:
    """--set key=value updates the config and persists it."""
    config_path, _ = _setup_temp_paths(tmp_path)

    save_config(
        AppConfig(translator={"engine": "deepseek"}),  # type: ignore[arg-type]
        config_path,
    )

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path):
        result = runner.invoke(
            main, ["config", "--set", "translator.engine=openai"]
        )

    assert result.exit_code == 0, result.output
    assert "Set translator.engine" in result.output

    # Verify persistence.
    saved = load_config(config_path)
    assert saved.translator.engine == "openai"


def test_config_set_numeric_value(tmp_path: Path, runner: CliRunner) -> None:
    """--set with a numeric value (via YAML parse) works correctly."""
    config_path, _ = _setup_temp_paths(tmp_path)
    save_config(AppConfig(), config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path):
        result = runner.invoke(
            main, ["config", "--set", "sync.interval_hours=12"]
        )

    assert result.exit_code == 0, result.output

    saved = load_config(config_path)
    assert saved.sync.interval_hours == 12


def test_config_get_and_set_together_fails(
    tmp_path: Path, runner: CliRunner
) -> None:
    """Using --get and --set together raises an error."""
    result = runner.invoke(
        main,
        [
            "config",
            "--get", "translator.engine",
            "--set", "translator.engine=openai",
        ],
    )

    assert result.exit_code != 0
    assert "Cannot use --get and --set together" in result.output


# ---------------------------------------------------------------------------
# watch
# ---------------------------------------------------------------------------


def test_watch_calls_run_watch_with_default_interval(
    tmp_path: Path, runner: CliRunner
) -> None:
    """watch with no --interval passes None through to run_watch."""
    config_path, _ = _setup_temp_paths(tmp_path)
    save_config(
        AppConfig(repos=[RepoConfig(name="r", url="https://example.com/r.git")]),
        config_path,
    )

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cli.scheduler.run_watch") as mock_run_watch:
        result = runner.invoke(main, ["watch"])

    assert result.exit_code == 0, result.output
    mock_run_watch.assert_called_once()
    args = mock_run_watch.call_args[0]
    assert args[1] is None
    assert "Watching 1 repo(s)" in result.output


def test_watch_parses_interval_with_h_suffix(
    tmp_path: Path, runner: CliRunner
) -> None:
    """watch --interval 6h overrides the configured interval."""
    config_path, _ = _setup_temp_paths(tmp_path)
    save_config(AppConfig(), config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cli.scheduler.run_watch") as mock_run_watch:
        result = runner.invoke(main, ["watch", "--interval", "6h"])

    assert result.exit_code == 0, result.output
    mock_run_watch.assert_called_once()
    assert mock_run_watch.call_args[0][1] == 6
    assert "Next check in 6h" in result.output


def test_watch_rejects_zero_interval(tmp_path: Path, runner: CliRunner) -> None:
    """watch --interval 0 is rejected rather than silently falling back."""
    config_path, _ = _setup_temp_paths(tmp_path)
    save_config(AppConfig(), config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cli.scheduler.run_watch") as mock_run_watch:
        result = runner.invoke(main, ["watch", "--interval", "0"])

    assert result.exit_code != 0
    mock_run_watch.assert_not_called()
    assert "positive" in result.output.lower()


def test_watch_rejects_negative_interval(tmp_path: Path, runner: CliRunner) -> None:
    """watch --interval -1 is rejected."""
    config_path, _ = _setup_temp_paths(tmp_path)
    save_config(AppConfig(), config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cli.scheduler.run_watch") as mock_run_watch:
        result = runner.invoke(main, ["watch", "--interval", "-1"])

    assert result.exit_code != 0
    mock_run_watch.assert_not_called()
    assert "positive" in result.output.lower()


def test_watch_rejects_unparseable_interval(
    tmp_path: Path, runner: CliRunner
) -> None:
    """watch --interval bogus raises a clean error."""
    config_path, _ = _setup_temp_paths(tmp_path)
    save_config(AppConfig(), config_path)

    with patch("repo_translator.config.DEFAULT_CONFIG_PATH", config_path), \
         patch("repo_translator.cli.scheduler.run_watch") as mock_run_watch:
        result = runner.invoke(main, ["watch", "--interval", "bogus"])

    assert result.exit_code != 0
    mock_run_watch.assert_not_called()
    assert "Invalid --interval value" in result.output


# ---------------------------------------------------------------------------
# help text
# ---------------------------------------------------------------------------


def test_help_text_is_not_stub(runner: CliRunner) -> None:
    """Verify that help text shows real descriptions, not [stub] placeholders."""
    result = runner.invoke(main, ["--help"])

    assert result.exit_code == 0, result.output
    assert "[stub]" not in result.output
    assert "placeholder" not in result.output.lower()


def test_add_help_shows_real_description(runner: CliRunner) -> None:
    """add --help should show the real description."""
    result = runner.invoke(main, ["add", "--help"])

    assert result.exit_code == 0, result.output
    assert "[stub]" not in result.output


def test_list_help_shows_real_description(runner: CliRunner) -> None:
    """list --help should show the real description."""
    result = runner.invoke(main, ["list", "--help"])

    assert result.exit_code == 0, result.output
    assert "[stub]" not in result.output


def test_config_help_shows_real_description(runner: CliRunner) -> None:
    """config --help should show the real description."""
    result = runner.invoke(main, ["config", "--help"])

    assert result.exit_code == 0, result.output
    assert "[stub]" not in result.output
