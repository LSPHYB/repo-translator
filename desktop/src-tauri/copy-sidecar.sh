#!/usr/bin/env bash
# Copies the Task 10 PyInstaller-built sidecar binary (../../dist/repo-translator-sidecar,
# built via `uv run pyinstaller repo-translator-sidecar.spec` from the repo root)
# into Tauri's externalBin location with the current platform's target-triple
# suffix appended, per Tauri 2's sidecar naming convention:
# https://v2.tauri.app/develop/sidecar/
#
# Run this before `npm run tauri build` / `npm run tauri dev` whenever the
# Python sidecar source changes and needs to be re-packaged. Not wired into
# `beforeBuildCommand` automatically (that command only builds the frontend) --
# rebuilding the PyInstaller binary is a separate, slower step the developer
# triggers explicitly.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SRC="$REPO_ROOT/dist/repo-translator-sidecar"
if [[ ! -f "$SRC" ]]; then
  echo "error: $SRC not found." >&2
  echo "Build it first: (cd $REPO_ROOT && uv run pyinstaller repo-translator-sidecar.spec)" >&2
  exit 1
fi

TRIPLE="$(rustc --print host-tuple)"
DEST_DIR="$SCRIPT_DIR/binaries"
DEST="$DEST_DIR/repo-translator-sidecar-$TRIPLE"

mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST"
chmod +x "$DEST"
echo "Copied $SRC -> $DEST"
