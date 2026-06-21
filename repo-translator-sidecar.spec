# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Tauri (Task 11) sidecar executable.

Packages `repo_translator/api_server.py`'s `main()` -- the dynamic-port
FastAPI/uvicorn entry point added in Task 1 -- into a single native
executable that Tauri's `externalBin` can bundle and spawn as a subprocess.
Tauri can only bundle a single binary, not a Python interpreter + source
tree, so this is the packaging step Task 11 depends on.

Build (run from the repo root, inside the project's `uv`-managed venv so the
exact pinned dependency versions get bundled):

    uv run pyinstaller repo-translator-sidecar.spec

Output: `dist/repo-translator-sidecar` (~26MB on macOS arm64 as of this
writing). `build/` and `dist/` are gitignored -- never commit the binary
itself, only this spec file.

Verify without Tauri involved, against a scratch config/cache directory (the
built binary must never touch the real `~/.repo-translator/`):

    mkdir -p /tmp/sidecar-verify
    REPO_TRANSLATOR_HOME=/tmp/sidecar-verify dist/repo-translator-sidecar
    # stdout's first line is {"type": "startup", "port": <port>} (Task 1) --
    # use that port below.
    curl http://127.0.0.1:<port>/health

Tool choice: PyInstaller, not Nuitka. Per the Task 10 brief, PyInstaller was
tried first with an explicit time-box, switching to Nuitka only if it failed.
It did not fail -- `--onefile --collect-all anthropic --collect-all openai
--collect-all httpx --collect-all uvicorn --collect-all fastapi` built a
working binary on the first attempt (~13s build, verified serving `/health`
on its dynamically-assigned port), so Nuitka was never needed. `collect_all`
for these five packages (rather than the default dependency-graph-only
collection) sidesteps the dynamic-import/plugin-discovery hidden-import
failures the brief called out as the known risk for this exact dependency
set (openai/anthropic/httpx/uvicorn/pydantic): each of these packages
registers optional sub-features (e.g. anthropic's bedrock/vertex/tools
extras, openai's beta/types submodules, uvicorn's protocol/loop backends)
via imports PyInstaller's static analysis can't always see, so explicit
`collect_all` is cheaper than chasing `--hidden-import` one failure at a
time. This spec file is the result of running:

    uv run pyinstaller --onefile --name repo-translator-sidecar \\
        --collect-all anthropic --collect-all openai --collect-all httpx \\
        --collect-all uvicorn --collect-all fastapi \\
        -p . repo_translator/api_server.py

which PyInstaller writes to a `.spec` file on first run; this checked-in
copy is that generated file, kept so the build is reproducible without
re-typing the `--collect-all` flags.
"""

from PyInstaller.utils.hooks import collect_all

datas = []
binaries = []
hiddenimports = []
for package in ("anthropic", "openai", "httpx", "uvicorn", "fastapi"):
    pkg_datas, pkg_binaries, pkg_hiddenimports = collect_all(package)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hiddenimports


a = Analysis(
    ["repo_translator/api_server.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="repo-translator-sidecar",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
