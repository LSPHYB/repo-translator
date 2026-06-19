"""CLI entry point for repo-translator (click-based command group).

Command bodies are placeholders for Phase 0. Real logic lands in Phase 6
(see TODO.md "阶段 6：CLI 命令").
"""

import click


@click.group()
@click.version_option()
def main() -> None:
    """repo-translator: translate Markdown docs in tracked repos into Chinese."""


@main.command()
@click.argument("url_or_path")
def add(url_or_path: str) -> None:
    """Add and start tracking a repository (by URL or local path)."""
    click.echo(f"[stub] add: {url_or_path} (not yet implemented)")


@main.command()
@click.argument("name")
def translate(name: str) -> None:
    """Manually trigger translation for a tracked repository."""
    click.echo(f"[stub] translate: {name} (not yet implemented)")


@main.command()
@click.option("--interval", default=None, help="Override the polling interval (e.g. 6h).")
def watch(interval: str | None) -> None:
    """Start the watch daemon, polling all tracked repositories on a schedule."""
    click.echo("[stub] watch (not yet implemented)")


@main.command(name="list")
def list_repos() -> None:
    """List tracked repositories and their status."""
    click.echo("[stub] list (not yet implemented)")


@main.command()
@click.argument("name")
def remove(name: str) -> None:
    """Stop tracking a repository."""
    click.echo(f"[stub] remove: {name} (not yet implemented)")


@main.command()
@click.option("--get", "get_key", default=None, help="Read a config value.")
@click.option("--set", "set_kv", default=None, help="Write a config value as key=value.")
def config(get_key: str | None, set_kv: str | None) -> None:
    """View or modify the current configuration."""
    click.echo("[stub] config (not yet implemented)")


if __name__ == "__main__":
    main()
