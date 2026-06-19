"""CLI entry point for repo-translator (click-based command group)."""

from __future__ import annotations

import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import click
import yaml

from repo_translator import cache_manager, git_manager, sync
from repo_translator.config import (
    AppConfig,
    RepoConfig,
    load_config,
    save_config,
)

logger = logging.getLogger(__name__)

# Default paths (kept as module-level for test mocking).
DEFAULT_CACHE_PATH: Path = Path.home() / ".repo-translator" / "cache.json"


def _infer_repo_name(url_or_path: str) -> str:
    """Infer a human-friendly repo name from a URL or directory name."""
    url_or_path = url_or_path.rstrip("/")
    name = url_or_path.split("/")[-1]
    if name.endswith(".git"):
        name = name[:-4]
    return name or "repo"


def _is_url(value: str) -> bool:
    """Return True if *value* looks like a git remote URL."""
    return value.startswith(("http://", "https://", "git@"))


def _is_git_repo(path: Path) -> bool:
    """Return True if *path* lives inside a git repository."""
    try:
        subprocess.run(
            ["git", "-C", str(path), "rev-parse", "--git-dir"],
            check=True,
            capture_output=True,
            text=True,
        )
        return True
    except subprocess.CalledProcessError:
        return False


def _find_repo_by_name(config: AppConfig, name: str) -> RepoConfig:
    """Return the ``RepoConfig`` named *name*, or raise ``click.ClickException``."""
    for repo in config.repos:
        if repo.name == name:
            return repo
    raise click.ClickException(f"Repository '{name}' not found in config.")


# ---------------------------------------------------------------------------
# CLI group
# ---------------------------------------------------------------------------


@click.group()
@click.version_option()
def main() -> None:
    """repo-translator: translate Markdown docs in tracked repos into Chinese."""


# ---------------------------------------------------------------------------
# add
# ---------------------------------------------------------------------------


@main.command()
@click.argument("url_or_path")
@click.option("--name", "-n", default=None, help="Override the inferred repo name.")
def add(url_or_path: str, name: str | None) -> None:  # noqa: D401
    """Add and start tracking a repository (by URL or local path).

    URL examples:\n
        \b
        repo-translator add https://github.com/user/repo
        repo-translator add git@github.com:user/repo.git --name myrepo

    Local path examples:\n
        \b
        repo-translator add ~/code/my-project
        repo-translator add /home/user/repos/foo --name custom-name
    """
    config = load_config()
    repo_name = name or _infer_repo_name(url_or_path)

    # Check for duplicates.
    if any(r.name == repo_name for r in config.repos):
        raise click.ClickException(
            f"Repository '{repo_name}' is already tracked. "
            f"Remove it first with 'repo-translator remove {repo_name}'."
        )

    now = datetime.now(timezone.utc)
    output_base = Path(config.output.base_dir).expanduser()

    if _is_url(url_or_path):
        # --- Managed (URL) repo ---
        repo_config = RepoConfig(name=repo_name, url=url_or_path, added_at=now)
        clone_dest = output_base / "repos" / repo_name

        click.echo(f"Cloning {url_or_path} ...")
        try:
            git_manager.clone(url_or_path, clone_dest)
        except git_manager.GitOperationError as e:
            click.echo(
                click.style(f"Clone failed: {e}", fg="yellow"), err=True
            )
            # Still save the config entry so the user can retry later.
            config.repos.append(repo_config)
            save_config(config)
            click.echo(
                f"Repository '{repo_name}' added to config (clone failed; "
                f"retry with 'repo-translator translate {repo_name}')."
            )
            return
        click.echo("Clone complete.")
        local_path_for_sync = clone_dest
    else:
        # --- External (local path) repo ---
        local_path = Path(url_or_path).expanduser().resolve()
        if not _is_git_repo(local_path):
            raise click.ClickException(
                f"'{local_path}' does not appear to be a git repository "
                f"(no .git directory found)."
            )
        repo_config = RepoConfig(
            name=repo_name, path=str(local_path), added_at=now
        )
        click.echo(f"Using local repository: {local_path}")
        local_path_for_sync = local_path

    # Add to config and save.
    config.repos.append(repo_config)
    save_config(config)

    # Run initial sync.
    cache = cache_manager.load(DEFAULT_CACHE_PATH)

    # Count .md files for progress reporting.
    try:
        file_blob_map = git_manager.get_file_blob_map(local_path_for_sync)
    except Exception:
        click.echo(
            click.style("Failed to read repository contents.", fg="yellow"),
            err=True,
        )
        click.echo(
            f"Repository '{repo_name}' added. "
            f"Run 'repo-translator translate {repo_name}' to sync."
        )
        return

    total_md = len(git_manager.list_md_files(file_blob_map))

    if total_md == 0:
        click.echo("No markdown files found.")
    else:
        click.echo(f"Found {total_md} markdown file(s) ...")
        try:
            cache = sync.sync_repo(repo_config, config, cache)
        except Exception as e:
            raise click.ClickException(
                f"Translation engine unavailable: {e}\n"
                f"Check 'repo-translator config' (translator.engine/api_key) "
                f"and retry with 'repo-translator translate {repo_name}'."
            ) from e
        cache_manager.save(DEFAULT_CACHE_PATH, cache)
        succeeded = len(cache.get(repo_name, {}))
        click.echo(f"[{succeeded}/{total_md}] Done.")

    click.echo(
        click.style(
            f"Repository '{repo_name}' added and initial sync complete.", fg="green"
        )
    )


# ---------------------------------------------------------------------------
# translate
# ---------------------------------------------------------------------------


@main.command()
@click.argument("name")
def translate(name: str) -> None:
    """Manually trigger translation for a tracked repository."""
    config = load_config()
    repo_config = _find_repo_by_name(config, name)

    cache = cache_manager.load(DEFAULT_CACHE_PATH)

    # Pre-flight: get the blob map so we can report changed-file count.
    repos_dir = Path(config.output.base_dir).expanduser() / "repos"
    try:
        local_path = git_manager.clone_or_pull(repo_config, repos_dir)
        file_blob_map = git_manager.get_file_blob_map(local_path)
    except git_manager.GitOperationError as e:
        click.echo(
            click.style(
                f"Failed to access repository '{name}': {e}", fg="red"
            ),
            err=True,
        )
        return

    changed_files = cache_manager.get_changed_files(
        name, file_blob_map, cache
    )
    total_changed = len(changed_files)

    if total_changed == 0:
        click.echo("No changed files.")
        return

    old_count = len(cache.get(name, {}))
    try:
        cache = sync.sync_repo(repo_config, config, cache)
    except Exception as e:
        raise click.ClickException(
            f"Translation engine unavailable: {e}\n"
            f"Check 'repo-translator config' (translator.engine/api_key)."
        ) from e
    cache_manager.save(DEFAULT_CACHE_PATH, cache)
    new_count = len(cache.get(name, {}))

    click.echo(
        f"{total_changed} file(s) processed, {new_count - old_count} succeeded"
    )


# ---------------------------------------------------------------------------
# list
# ---------------------------------------------------------------------------


@main.command(name="list")
def list_repos() -> None:
    """List tracked repositories and their status."""
    config = load_config()
    cache = cache_manager.load(DEFAULT_CACHE_PATH)

    if not config.repos:
        click.echo("No repositories tracked.")
        return

    # Build table rows.
    rows: list[tuple[str, str, str, str, str]] = []
    for repo in config.repos:
        name = repo.name
        kind = "managed" if repo.is_managed else "external"
        branch = repo.branch or "—"
        repo_cache = cache.get(name, {})

        if repo_cache:
            # Last sync: most recent translated_at among all files.
            timestamps = [
                v.get("translated_at", "")
                for v in repo_cache.values()
                if v.get("translated_at")
            ]
            last_sync = max(timestamps) if timestamps else "never synced"
            file_count = str(len(repo_cache))
        else:
            last_sync = "never synced"
            file_count = "0"

        rows.append((name, kind, branch, last_sync, file_count))

    # Format output.
    header = ("NAME", "TYPE", "BRANCH", "LAST SYNC", "FILES")
    col_widths = [0] * 5

    for i in range(5):
        col_widths[i] = max(
            len(header[i]),
            max((len(row[i]) for row in rows), default=0),
        )

    # Build format string.
    fmt = "  ".join(f"{{:<{w}}}" for w in col_widths)

    click.echo(fmt.format(*header))
    click.echo("  ".join("-" * w for w in col_widths))
    for row in rows:
        click.echo(fmt.format(*row))


# ---------------------------------------------------------------------------
# remove
# ---------------------------------------------------------------------------


@main.command()
@click.argument("name")
def remove(name: str) -> None:
    """Stop tracking a repository."""
    config = load_config()
    repo = _find_repo_by_name(config, name)

    config.repos = [r for r in config.repos if r.name != name]
    save_config(config)

    if repo.is_managed:
        output_base = Path(config.output.base_dir).expanduser()
        clone_dir = output_base / "repos" / name
        click.echo(
            f"Repository '{name}' removed from config.\n"
            f"  Note: the cloned repo at {clone_dir} can be manually deleted "
            f"if desired."
        )
    else:
        click.echo(f"Repository '{name}' removed from config.")


# ---------------------------------------------------------------------------
# config
# ---------------------------------------------------------------------------


@main.command()
@click.option(
    "--get", "get_key", default=None, help="Read a config value (dot notation)."
)
@click.option(
    "--set", "set_kv", default=None, help="Write a config value as key=value."
)
def config(get_key: str | None, set_kv: str | None) -> None:
    """View or modify the current configuration.

    \b
    Examples:
        repo-translator config
        repo-translator config --get translator.engine
        repo-translator config --set sync.interval_hours=12
        repo-translator config --set translator.api_key=sk-xxx
    """
    if get_key is not None and set_kv is not None:
        raise click.ClickException(
            "Cannot use --get and --set together."
        )

    if get_key is not None:
        _config_get(get_key)
    elif set_kv is not None:
        _config_set(set_kv)
    else:
        _config_show()


def _config_show() -> None:
    """Print the full configuration as YAML."""
    config = load_config()
    data = config.model_dump(mode="json", exclude_none=True)
    click.echo(
        yaml.dump(data, allow_unicode=True, default_flow_style=False, sort_keys=False)
    )


def _config_get(key: str) -> None:
    """Print a single config value by dot-notation key."""
    config = load_config()
    data = config.model_dump(mode="json", exclude_none=True)

    try:
        value = _nested_get(data, key.split("."))
    except (KeyError, TypeError, IndexError) as e:
        raise click.ClickException(f"Invalid config key '{key}': {e}") from e

    if value is None:
        click.echo("null")
    elif isinstance(value, (list, dict)):
        click.echo(
            yaml.dump(value, allow_unicode=True, default_flow_style=False)
        )
    else:
        click.echo(str(value))


def _config_set(kv: str) -> None:
    """Parse 'key=value', update config, and save."""
    if "=" not in kv:
        raise click.ClickException(
            f"Invalid --set format: '{kv}'. Expected key=value."
        )
    key, _, value_str = kv.partition("=")

    # Try to parse the value as YAML first (so lists, bools, ints work);
    # fall back to raw string on parse failure.
    try:
        parsed = yaml.safe_load(value_str)
        if parsed is None and value_str.lower() not in ("null", "~", "none"):
            parsed = value_str
        value = parsed
    except (yaml.YAMLError, ValueError):
        value = value_str

    config = load_config()
    data = config.model_dump()

    try:
        _nested_set(data, key.split("."), value)
    except (KeyError, TypeError, IndexError) as e:
        raise click.ClickException(
            f"Invalid config key '{key}': {e}"
        ) from e

    new_config = AppConfig.model_validate(data)
    save_config(new_config)

    click.echo(f"Set {key} = {value!r}")


def _nested_get(data: dict, keys: list[str]) -> object:
    """Walk *data* through *keys* and return the leaf value."""
    d: object = data
    for k in keys:
        if isinstance(d, dict):
            d = d[k]
        elif isinstance(d, list):
            d = d[int(k)]
        else:
            raise KeyError(k)
    return d


def _nested_set(data: dict, keys: list[str], value: object) -> None:
    """Walk *data* through *keys* and set the leaf to *value*."""
    d: dict = data
    for k in keys[:-1]:
        if k not in d:
            raise KeyError(k)
        d = d[k]
    last = keys[-1]
    if last not in d:
        raise KeyError(last)
    d[last] = value


# ---------------------------------------------------------------------------
# watch (stub -- real implementation in Phase 7)
# ---------------------------------------------------------------------------


@main.command()
@click.option(
    "--interval", default=None, help="Override the polling interval (e.g. 6h)."
)
def watch(interval: str | None) -> None:
    """Start the watch daemon, polling all tracked repositories on a schedule."""
    click.echo(
        click.style(
            "The 'watch' command is not yet implemented (coming in Phase 7).",
            fg="yellow",
        )
    )


if __name__ == "__main__":
    main()
