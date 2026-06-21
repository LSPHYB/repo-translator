"""Persistent token-usage tracking (usage.json) read/write/record helpers.

Mirrors `cache_manager.py`'s structure and atomic-write convention exactly
(see that module's docstrings for the full rationale -- not repeated here).

Schema (`usage.json`):

    {
      "daily": {
        "<YYYY-MM-DD UTC>": {
          "<engine>": {"prompt_tokens": 0, "completion_tokens": 0, "files": 0},
          ...
        },
        ...
      },
      "repos": {
        "<repo_name>": {
          "<engine>": {"prompt_tokens": 0, "completion_tokens": 0, "files": 0},
          ...
        },
        ...
      }
    }

Only raw token counts (and a `files` count) are stored -- no cost. Cost is
computed at `GET /usage` read time (in `api_server.py`) from the pricing
table below, so a pricing-table update never requires a data migration of
already-persisted usage.json files.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

# `REPO_TRANSLATOR_HOME`, if set, overrides the base directory this path is
# computed under -- mirrors `cache_manager.py`'s (and `config.py`'s) own
# independent computation of the same env var/default. Kept as a separate
# computation (rather than importing from `cache_manager.py`) for the same
# reason `cache_manager.py` doesn't import it from `config.py`: avoids
# introducing a cross-module import dependency that doesn't otherwise exist.
_REPO_TRANSLATOR_HOME = Path(
    os.environ.get("REPO_TRANSLATOR_HOME", str(Path.home() / ".repo-translator"))
).expanduser()

# Default usage-tracking location, parallel to `cache_manager.DEFAULT_CACHE_PATH`.
DEFAULT_USAGE_PATH: Path = _REPO_TRANSLATOR_HOME / "usage.json"

#: Point-in-time, approximate public list-price USD-per-1000-token rates
#: for each translator-relevant engine, as (prompt_rate, completion_rate).
#: These WILL drift from real provider pricing over time -- they exist only
#: to give the desktop UI a rough cost estimate, not a billing-accurate
#: figure. Update opportunistically; there is no automated freshness check.
#: Captured 2026-06-21 from each provider's then-current public pricing page
#: for the model each engine defaults to (see translator/*.py DEFAULT_MODEL):
#:   - openai: gpt-4o-mini      ~ $0.15 / $0.60 per 1M tokens
#:   - deepseek: deepseek-chat  ~ $0.27 / $1.10 per 1M tokens (cache-miss rate)
#:   - claude: claude-3-5-sonnet-latest ~ $3.00 / $15.00 per 1M tokens
#: Unknown/future engine names fall back to (0.0, 0.0) -- cost shows as $0,
#: never crashes.
PRICING_USD_PER_1K_TOKENS: dict[str, tuple[float, float]] = {
    "openai": (0.00015, 0.00060),
    "deepseek": (0.00027, 0.00110),
    "claude": (0.00300, 0.01500),
}


def load(usage_path: Path) -> dict:
    """Load and parse `usage_path` as JSON. Returns `{"daily": {}, "repos": {}}`
    if the file doesn't exist.
    """
    if not usage_path.exists():
        return {"daily": {}, "repos": {}}
    with usage_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save(usage_path: Path, data: dict) -> None:
    """Write `data` to `usage_path` as JSON, creating parent dirs if needed.

    Writes atomically: `data` is first serialized to a temporary file in the
    same directory as `usage_path`, then moved into place with
    `os.replace()` -- identical rationale to `cache_manager.save()` (this
    file is also written on every poll cycle of the watch-mode daemon, via
    the same load/sync/save call shape).
    """
    usage_path.parent.mkdir(parents=True, exist_ok=True)

    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{usage_path.name}.", suffix=".tmp", dir=usage_path.parent
    )
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, usage_path)
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise


def record(
    usage: dict,
    repo_name: str,
    engine: str,
    date: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> dict:
    """Increment both the `daily` and `repos` views of `usage` for one
    successfully-billed file.

    Mutates and returns `usage` (same style as `cache_manager.update`).
    Callers should call this whenever a file's `TokenUsage` is nonzero,
    regardless of whether the file's translation ultimately succeeded (a
    write failure after a successful LLM call still consumed billed
    tokens) -- see `sync.py`'s `_process_one_file`/`sync_repo`.
    """
    daily = usage.setdefault("daily", {})
    day_bucket = daily.setdefault(date, {})
    day_engine = day_bucket.setdefault(
        engine, {"prompt_tokens": 0, "completion_tokens": 0, "files": 0}
    )
    day_engine["prompt_tokens"] += prompt_tokens
    day_engine["completion_tokens"] += completion_tokens
    day_engine["files"] += 1

    repos = usage.setdefault("repos", {})
    repo_bucket = repos.setdefault(repo_name, {})
    repo_engine = repo_bucket.setdefault(
        engine, {"prompt_tokens": 0, "completion_tokens": 0, "files": 0}
    )
    repo_engine["prompt_tokens"] += prompt_tokens
    repo_engine["completion_tokens"] += completion_tokens
    repo_engine["files"] += 1

    return usage
