# Desktop Frontend Implementation Plan (Tauri 2 + React)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Depends on:** `docs/superpowers/plans/2026-06-20-desktop-api-backend.md` (complete, merged to `main` at commit `05b2f2f`). This plan assumes `repo_translator/api_server.py` already exposes `/health`, `GET|PUT /config`, `GET|POST /repos`, `DELETE /repos/{name}`, `POST /repos/{name}/sync`, `POST /repos/{name}/files/{path}/sync`, `POST /repos/sync-all`, `POST /repos/sync-all/cancel`, `WS /logs`.

**Goal:** Build the Tauri 2 desktop shell that wraps `api_server.py` as a persistent local sidecar process and drives it from a React UI ported from the approved mockups in `ui_kits/desktop-app/*.jsx`. No Python business logic is rewritten — this plan only adds a `desktop/` subproject (Rust shell + Vite/React frontend) and a packaging pipeline for the Python sidecar.

**Architecture:** see `docs/superpowers/specs/2026-06-20-desktop-app-design.md` for the full rationale (Tauri 2, persistent-process sidecar over HTTP/WS, Vite+React prebuild, ~50-100MB bundle accepted). Repo layout addition:

```
repo-translator/
  repo_translator/            # unchanged
  desktop/                    # NEW — independent buildable subproject
    src-tauri/                # Rust shell: window, sidecar lifecycle, packaging config
    src/                      # Vite + React frontend (ported from ui_kits/desktop-app/*.jsx)
      api.ts                  # fetch/WebSocket client for api_server.py
      components/             # Modal, PageHeader, design-system bundle as modules
      screens/                # Dashboard, Repos, Glossary, Usage, Settings, Console
    package.json / vite.config.ts / tauri.conf.json
```

**Tech Stack:** Tauri 2 (Rust), Vite + React 18 + TypeScript, the existing design-system bundle (`_ds_bundle.js`, `tokens/*.css`, `styles.css`) ported to ES modules, PyInstaller for the Python sidecar binary.

## Global Constraints

- Do not modify `repo_translator/api_server.py`'s existing endpoints or response shapes in this plan **except** the specific, narrowly-scoped additions listed below — every one of them is additive, must ship with a `tests/test_api_server.py` test following the existing `_patch_config_path` safety pattern, and must be confirmed with the user before implementation (each task below repeats this where relevant — this bullet is the index, not a substitute for asking):
  - **Task 1**: config/cache path env-var override (if missing) + enriched `/health` response + dynamic-port startup support.
  - **Task 5**: a file-metadata endpoint (`GET /repos/{name}/files`), only if approved — see Task 5's blocking note.
  - **Task 6**: an optimistic-concurrency `revision` field on `AppConfig` + `PUT /config` 409-on-mismatch logic (this is not optional — see "Config write race" below).
  - **Task 7**: a minimal test-connection endpoint, only if approved.
  - **Task 8**: a structured `event` field on broadcast log records (additive `extra=` on existing logger calls — message text is not changed).
  - **Task 10**: packaging entrypoint.
  - Any other backend change discovered mid-task is **out of scope** for this plan — stop and ask, don't extend the list unilaterally.
- **API Contract Freeze (Task 0.5, before any screen-porting task starts):** snapshot `api_server.py`'s actual schemas (via its generated OpenAPI doc) into a checked-in file. Every frontend task from Task 2 onward codes against that snapshot, not against memory of the design spec. If a later task's approved backend change (the list above) alters a frozen field, that task must re-run the snapshot step and call out the diff explicitly in its commit — silent field renames are the single most expensive failure mode in a split frontend/backend implementation and this plan had no guard against it until this revision.
- Visual fidelity: port the mockup screens faithfully (same components, same Chinese copy, same layout) — this plan replaces their mock data and `window.*` globals with real state and real API calls, it does not redesign them.
- `desktop/` is a self-contained subproject with its own `package.json`/lockfile. Nothing in `pyproject.toml`/`repo_translator/`/the Python test suite changes except the explicitly-listed additive items above.
- After each task, run the existing Python suite (`uv run pytest tests/ -q`) to confirm zero regressions, plus whatever frontend check that task defines (`npm run build`, `npm run type-check`, or a manual Tauri dev-mode click-through — there is no frontend test framework in scope, per the design spec's explicit non-goal).
- Tests must never touch the real `~/.repo-translator/` — any task that runs `api_server.py` for manual/dev verification must point the config/cache override (Task 1) at a scratch directory, never the real one.
- **Config write race:** `GlossaryScreen` (Task 6) and `SettingsScreen` (Task 7) both do read-modify-write on the same `AppConfig` object via `GET`/`PUT /config`. Without a guard, saving Settings while Glossary is open (or vice versa) silently discards whichever screen wrote second's view of the *other* screen's fields, last-write-wins with no warning. Task 6 must add the `revision` guard described above before Task 7 starts depending on the same write path.
- **No fabricated data in the shipped app.** Any screen whose mockup uses random/timeout-based fake values (the Settings "测试连接" button, Usage's token chart) must either be wired to a real data source or have that fake element explicitly removed — never ship a `Math.random()`-driven UI element as if it were real telemetry.

---

### Task 0: Scaffold the Tauri 2 + Vite/React project

**Files:**
- Create: `desktop/` (full Tauri 2 + Vite/React scaffold via `npm create tauri-app@latest`)
- Create: `desktop/.gitignore` (node_modules, dist, src-tauri/target)

**Interfaces:**
- Produces: a `desktop/` subproject that runs `npm run tauri dev` and shows a blank/default window.

- [ ] Step 1: Run `npm create tauri-app@latest` inside `desktop/` (template: React + TypeScript + Vite).
- [ ] Step 2: Confirm `cd desktop && npm install && npm run tauri dev` opens a window with the default template content.
- [ ] Step 3: Commit `git add desktop/` (review the generated `.gitignore` first — make sure `node_modules/`, `dist/`, `src-tauri/target/` are excluded before staging).

---

### Task 0.5: Freeze the backend API contract

**Files:**
- Create: `docs/superpowers/specs/2026-06-20-desktop-api-contract-snapshot.json` (or `.yaml`)

**Interfaces:**
- Produces: a checked-in snapshot of every endpoint's actual request/response schema, captured from the running server, not transcribed from memory or from the design spec doc (which predates the implementation and may already disagree with it in field names).

- [ ] Step 1: Run `uvicorn repo_translator.api_server:app` against a scratch config dir, fetch `GET /openapi.json`, save it as the snapshot file. (FastAPI auto-generates this from the Pydantic models — it is the ground truth, not the design spec prose.)
- [ ] Step 2: For the one route that isn't plain REST (`WS /logs`), add a short hand-written note to the snapshot file documenting the exact NDJSON shape `_LogBroadcastHandler` emits (`time`/`level`/`logger`/`message`, plus whatever Task 8 adds).
- [ ] Step 3: Commit. From this point on, every frontend task reads field names from this file. If a later approved backend change (Task 1/5/6/7/8/10's listed additions) changes a frozen field, that task re-runs Step 1 and calls out the diff in its own commit message — don't let the snapshot go silently stale.

---

### Task 1: API client (`desktop/src/api.ts`) + dynamic port + enriched health check

**Files:**
- Create: `desktop/src/api.ts`
- Modify: `repo_translator/api_server.py` — enrich `GET /health`; add a `main()` entry point that binds an OS-assigned port (`port=0`) and prints the actual bound port to stdout before handing the socket to `uvicorn.run()`.
- Modify (if needed): `repo_translator/config.py` — add an env-var override for the config/cache directory if one doesn't already exist (check first, don't assume).
- Test: `tests/test_api_server.py` — cover the enriched `/health` response shape.

**Interfaces:**
- **Dynamic port (fixes a real packaging hazard — a fixed port breaks the moment it's already in use by a stale instance, a second app launch, or an unrelated process):** `api_server.py` gains a `main()` that does `sock = socket.socket(...); sock.bind(("127.0.0.1", 0)); port = sock.getsockname()[1]`, then **prints exactly one JSON line to stdout before any other output, before logging is configured or any third-party library has a chance to print anything of its own**: `print(json.dumps({"type": "startup", "port": port}), flush=True)`, then `uvicorn.run(app, fd=sock.fileno())` (or the `uvicorn.Config`/`Server` equivalent that accepts a pre-bound socket — confirm the exact API against the installed uvicorn version). A bare `REPO_TRANSLATOR_PORT=<n>` text line is fragile the moment any startup-time logging or a dependency's own stdout write lands before it — a single structured JSON object on its own first line is unambiguous to parse and trivially extensible (e.g. `{"type": "startup", "port": 1234, "pid": 5678}` later) without inventing a new text format each time. Task 11's Rust sidecar spawn reads stdout line-by-line, parses the **first** line as JSON, extracts `port`, and exposes it to the frontend via a Tauri command (e.g. `invoke('get_backend_port')`) — `api.ts` calls that instead of hardcoding a port.
- **Enriched health check (fixes "`/health` says ok but the first real sync explodes"):** `GET /health` returns `{"status": "ok", "config_loaded": bool, "cache_loaded": bool, "version": str}` — `config_loaded`/`cache_loaded` reflect whether `load_config()`/`cache_manager.load()` actually succeeded (wrap in try/except, false + no exception bubbling if either fails), `version` reads from the installed package's own version metadata (`importlib.metadata.version("repo-translator")` or equivalent — confirm `pyproject.toml` has a `[project] version` to read).
- **Naming discipline for future growth:** keep `/health` meaning "the process is alive and can answer requests at all" — that's all Task 11's startup gate actually needs. `config_loaded`/`cache_loaded` are arguably already one step past pure liveness, but they're cheap, synchronous, and needed for this plan's startup gate, so they stay. Resist adding deeper readiness checks here later (e.g. "is the configured translator's API key actually valid," "can we reach the network") — that's a Kubernetes-style liveness/readiness split (`/health` = alive, `/ready` = actually able to do work), and if a future need for that arises it should be a new `/ready` endpoint, not more fields bolted onto `/health` until it's a catch-all. Not required for this plan; noted so the next person doesn't grow `/health` past its job.
- `api.ts` produces typed functions `getConfig()`, `putConfig()`, `listRepos()`, `addRepo()`, `deleteRepo()`, `syncRepo(name)`, `syncFile(name, path)`, `syncAll()`, `cancelSyncAll()`, `health()`, and `connectLogs(onMessage)` (wraps `new WebSocket(...)` to `ws://127.0.0.1:<port>/logs`, where `<port>` comes from the Tauri command above, not a constant).
- For local dev (outside Tauri, no Rust process to read stdout from), fall back to a `VITE_BACKEND_PORT` env var or a fixed dev-only port — document this fallback clearly in `api.ts` so it's obviously dev-only and never reachable in the packaged app.

- [ ] Step 1: Implement the enriched `/health` + dynamic-port `main()` in `api_server.py`, with a test for `/health`'s new fields.
- [ ] Step 2: Re-run Task 0.5's snapshot capture (this task changes `/health`'s schema) and commit the updated snapshot alongside this task's commit.
- [ ] Step 3: Write `api.ts` with one function per endpoint, typed request/response shapes matching the frozen snapshot.
- [ ] Step 4: Manually verify: run `uv run python -m repo_translator.api_server` (or whatever the `main()` entry point ends up being invoked as), confirm its first stdout line is the `{"type": "startup", "port": ...}` JSON object and that it serves the enriched `/health` on that port; call each `api.ts` function against it from a throwaway `console.log` in `App.tsx`.
- [ ] Step 5: Commit (Python changes and `api.ts` can be separate commits within this task, but both land before Task 2 starts).

---

### Task 2: Port shared components (Modal, PageHeader, design-system bundle)

**Files:**
- Create: `desktop/src/components/Modal.tsx`, `desktop/src/components/PageHeader.tsx`
- Create: `desktop/src/design-system/` (ported from `_ds_bundle.js` + `tokens/*.css` + `styles.css`)

**Interfaces:**
- `_ds_bundle.js` currently attaches everything to `window.RepoTranslatorDesignSystem_dab506`. Port it to a module that `export`s each component (`Card`, `Button`, `RepoCard`, `StatCard`, `Tabs`, `Badge`, `StatusDot`, `Input`, `Select`, `Slider`, `Switch`, `TagInput`, `ProgressBar`, `ConsoleLine`, `TitleBar`, `NavRail`, `StatusBar`, `ThemeToggle` — enumerate the real export list from the bundle, don't assume this list is exhaustive).
- Google Fonts: the mockup's `index.html` doesn't reference a font CDN directly (check `styles.css`/`tokens/fonts.css` for `@import`/`url()` references) — replace any remote font URL with a locally bundled font file per the design spec's offline-startup requirement.

- [ ] Step 1: Read `_ds_bundle.js` in full, enumerate every `window.*` assignment it makes.
- [ ] Step 2: Convert to ES module exports, import CSS files into `main.tsx`/`vite.config.ts` as needed.
- [ ] Step 3: Port `Modal.jsx` → `Modal.tsx` and `PageHeader.jsx` → `PageHeader.tsx` (straightforward — these already take props, just add types and switch from `window.X` global registration to `export default`).
- [ ] Step 4: `npm run build` succeeds with no missing-global errors.
- [ ] Step 5: Commit.

---

### Task 3: Port AppShell with real navigation + theme state

**Files:**
- Create: `desktop/src/App.tsx` (replaces the template's default App)
- Create: `desktop/src/components/AppShell.tsx` (ported from `AppShell.jsx`)

**Interfaces:**
- Same nav items as the mockup (`dashboard`/`repos`/`glossary`/`usage`/`settings`/`logs`), same console-drawer toggle behavior.
- `page`/`theme`/`logsOpen` state lives in `App.tsx` exactly as in the mockup's inline `App` function (`index.html`'s `<script type="text/babel">` block) — port that logic, don't redesign the state shape.

- [ ] Step 1: Port `AppShell.jsx` → `AppShell.tsx`.
- [ ] Step 2: Port the `App` component logic from `index.html`'s inline script into `App.tsx`, with placeholder screens (Task 4-8 fill these in).
- [ ] Step 3: `npm run tauri dev` shows the shell with working nav and theme toggle, but screens still show mock content (expected — replaced in later tasks).
- [ ] Step 4: Commit.

---

### Task 4: Port DashboardScreen — wire to real repo list + sync-all

**Files:**
- Create: `desktop/src/screens/DashboardScreen.tsx`

**Interfaces:**
- Replace `DashboardScreen.jsx`'s hardcoded "跟踪 3 个仓库" stats and mock `RepoCard` rows with `api.listRepos()` results.
- Wire the "立即同步全部"/"停止全部" actions to `api.syncAll()`/`api.cancelSyncAll()`.
- Open question to resolve while implementing, not before: the mockup shows "API 延迟 120ms" in the header — decide whether to drop this stat (no backend source for it) or wire it to `/health`'s round-trip latency. Default to dropping it if no clean data source exists; don't invent a fake metric.

- [ ] Step 1: Port `DashboardScreen.jsx` → `.tsx`, replace mock arrays with `api.listRepos()` calls (React `useEffect` + `useState`, no extra state library needed for this scope).
- [ ] Step 2: Wire sync-all/cancel buttons; show a loading/in-progress state while a sync-all run is active (poll `listRepos()` after completion, or rely on the `/logs` stream from Task 8 for live progress — your call, document which approach in the commit).
- [ ] Step 3: Manual click-through against the real sidecar: add a real local git repo via Task 5's `ReposScreen` (or curl the API directly), confirm Dashboard reflects it.
- [ ] Step 4: Commit.

---

### Task 5: Port ReposScreen — wire to add/delete/sync/per-file-sync

**Files:**
- Create: `desktop/src/screens/ReposScreen.tsx`

**Interfaces:**
- "添加仓库" modal: wire to `api.addRepo()`. The mockup's `kind` toggle (managed vs external) maps directly to whether the user enters a URL or a local path — `POST /repos`'s `url_or_path` field already auto-detects this server-side (see `_is_url` in `api_server.py`), so the frontend just needs to pass through whatever the user typed.
- **Per-file Sync UI is blocked until a real file-metadata API exists — this is a harder gap than "no file list."** `GET /repos` returns a count, not paths; but even a bare `GET /repos/{name}/files` returning `["path1", "path2"]` is insufficient, because the mockup's file rows show per-file *status* (synced/pending/error), not just a name. Define the frontend's status type with room for the states a sync run actually passes through, even if the backend only returns a subset on day one:
  ```typescript
  type FileStatus = "pending" | "running" | "synced" | "error";
  ```
  The endpoint must return a full metadata model per file:
  ```json
  [{"path": "docs/guide.md", "status": "synced" | "pending" | "running" | "error", "last_sync": "2026-06-20T12:00:00Z" | null, "error": "timeout" | null}]
  ```
  `status`/`last_sync` derive from `cache.json`'s per-file entries (present = synced, with `translated_at`); `pending` means present in the repo's blob map but absent from cache. `running` needs a live signal — without it, a user who opens this screen mid-`sync-all` sees every in-flight file as `pending` (indistinguishable from "not started yet"), which is actively misleading during the exact moment they're most likely to check. The cheapest real signal: `sync_repo`'s `ThreadPoolExecutor` already knows which files have a submitted-but-not-yet-completed future — if `GET /repos/{name}/files` is built without access to that live state (it's a separate request, possibly handled by a different async context than the one running the sync), `running` may have to come from the `/logs` WebSocket stream instead (a file-start log line) rather than this REST endpoint — decide which source feeds `running` before implementing, don't leave it permanently empty. `error` needs a place to live — check whether `sync_repo` currently surfaces per-file failure reasons anywhere (it logs them, but does it persist them?) — if not, this endpoint can only report `synced`/`pending`/`running` until that's added, and the UI's error state must be scoped out rather than faked. Get explicit confirmation on the exact response shape before implementing, and confirm with the user which of `running`/`error` are in scope for this pass or deferred.
- "在文件管理器中打开" action: requires a Tauri `shell`/`opener` plugin call (`@tauri-apps/plugin-opener` or similar) to open `cfg.output.base_dir/<repo>/` in the OS file manager — confirm plugin availability for Tauri 2 before committing to this.

- [ ] Step 1: Resolve the file-metadata model (see above) with the user — exact fields, and whether `error` is in scope; record the decision in the task's commit message.
- [ ] Step 2: Port `ReposScreen.jsx` → `.tsx`, wire add/delete/sync to `api.ts`.
- [ ] Step 3: If approved, add `GET /repos/{name}/files` to `api_server.py` with the agreed-on full metadata model + a test in `tests/test_api_server.py` (same `_patch_config_path` pattern as every other route test); re-run Task 0.5's snapshot capture and commit the update. Then wire the frontend to it. If not approved for this pass, remove the per-file retry row from the ported screen rather than leaving it wired to nothing.
- [ ] Step 4: Manual click-through: add a real local repo, sync it, confirm file counts and (if implemented) per-file status update.
- [ ] Step 5: Commit.

---

### Task 6: Port GlossaryScreen — wire to `/config` (glossary + exclude patterns) + add optimistic-concurrency guard

**Files:**
- Create: `desktop/src/screens/GlossaryScreen.tsx`
- Modify: `repo_translator/config.py` — add a `revision: int` field to `AppConfig`, bumped by 1 on every `save_config()` call.
- Modify: `repo_translator/api_server.py` — `PUT /config` accepts and checks `revision`.
- Test: `tests/test_api_server.py` — cover the 409-on-stale-revision case.

**Interfaces:**
- **Why this can't wait for a "later optimization" pass:** `GlossaryScreen` and `SettingsScreen` (Task 7) both do read-modify-write on the same `AppConfig` via `GET`/`PUT /config`, with no app-level reason they won't both be open or saved in close succession (the mockup's nav lets a user flip between them freely). Without a guard, whichever screen's `PUT` lands second silently overwrites the first screen's save with its own (now-stale) view of the *other* screen's fields — last-write-wins, no error, no warning, just quietly lost user edits the first time someone edits both screens in one session. This is not a hypothetical edge case for a desktop settings UI; it is the default failure mode of "two screens, one resource, no version check."
- Add `revision: int = 0` to `AppConfig` (`config.py`). `save_config()` increments it by 1 before writing (on every save, including the very first `save_config` call from a fresh config). `GET /config` returns the current `revision` as part of the existing response. `PUT /config`'s request body includes the `revision` the client last read; if it doesn't match the server's current `revision`, return `409 Conflict` with a body indicating "config changed since you loaded it, reload and reapply your edit" — don't auto-merge, the UI should just tell the user to retry, which for a single-resource desktop config screen is an acceptable simple resolution (no need for field-level merge logic at this scale).
- Both `GlossaryScreen` and `SettingsScreen` carry the `revision` they last fetched in their local state and include it on every `PUT`; on a 409 they re-fetch and show a "配置已更新，请重新应用您的修改" message rather than silently retrying with stale data.
- **Scope limit, document it explicitly in the code comment next to the check:** this `revision` field is a single-process, in-memory-then-disk check-then-write — `load → compare → write` is not atomic, so it protects against the stale-browser-tab-style race between two screens in one running app, **not** a cross-process compare-and-swap. If the CLI's `watch` daemon and the desktop app's sidecar ever run against the same `config.yaml` simultaneously (two separate OS processes both calling `save_config()`), a TOCTOU window still exists where both could read revision N and both write N+1, one silently overwriting the other. Closing that gap for real would need a file lock (e.g. `flock` around the read-check-write in `save_config()`) or true CAS — out of scope for this plan; call it out in `config.py`'s docstring near the `revision` field so nobody mistakes the current guard for cross-process safety it doesn't provide.
- Re-run Task 0.5's snapshot capture after this change (the `/config` schema gains `revision`) and commit the updated snapshot.

- [ ] Step 1: Add `revision` to `AppConfig`/`save_config()`/`PUT /config`'s 409 check in the Python backend, with a test covering: normal save bumps revision; stale-revision `PUT` returns 409 and does not write.
- [ ] Step 2: Re-capture and commit the Task 0.5 snapshot update.
- [ ] Step 3: Read `config.py`'s `AppConfig`/`GlossaryEntry`/`OutputConfig` models to confirm field names.
- [ ] Step 4: Port `GlossaryScreen.jsx` → `.tsx`, wire `GET/PUT /config` (including the `revision` round-trip) for both term table and exclude-pattern tag input.
- [ ] Step 5: Manual verification: edit a term, reload the screen, confirm persistence; then simulate the race — load the screen, externally `PUT /config` with a different `revision` via curl, attempt to save from the UI, confirm a 409 is surfaced rather than silently overwriting.
- [ ] Step 6: Commit (Python revision-guard change and frontend screen can be separate commits within this task).

---

### Task 7: Port SettingsScreen — wire to `/config` (engine + sync settings) + fix API key exposure

**Files:**
- Create: `desktop/src/screens/SettingsScreen.tsx`
- Modify: `repo_translator/api_server.py` — `GET /config` must not return the raw API key.
- Test: `tests/test_api_server.py` — cover that `GET /config` never includes the literal key value.

**Interfaces:**
- Engine selector (`openai`/`deepseek`/`claude`), concurrency, watch interval, autoSync toggle map onto `TranslatorConfig`/`SyncConfig` fields in `AppConfig` — confirm exact field names from `config.py` (same caution as Task 6).
- "测试连接" button: the mockup currently fakes this with `setTimeout` + `Math.random()`. There is no backend endpoint for a live connectivity test. Either drop this button for v1, or get explicit confirmation to add a minimal `POST /config/test-connection` endpoint that does a cheap real API call via the configured translator. **Never ship the mockup's `Math.random()` fake result in the real app** — a button that randomly claims success/failure is actively misleading, not a harmless placeholder. Flag this and get a decision before implementing.
- **API key exposure — fix the architecture, don't rely on frontend discipline to avoid leaking it.** Telling the frontend "just don't log the full config object" is not a real guarantee against a React error boundary, a DevTools inspection, or a future crash-reporting integration printing the in-memory state. Close this at the source instead: `GET /config`'s response (and the Task 0.5 contract snapshot) exposes `"api_key_set": true | false` for the translator config, **never** the literal key value. `PUT /config` accepts an `api_key` field that is either a new string (sets/replaces it), `null`/omitted (leave the stored key unchanged — this is how `SettingsScreen` saves every *other* field without forcing the user to re-paste their key each time), or an explicit empty string (clears it) — define exactly which of these three the frontend sends in which UI state before implementing. This is a backend response-shape change, so re-run Task 0.5's snapshot capture and commit the update.

- [ ] Step 0: Implement the `api_key_set`/write-semantics change in `api_server.py` first (`GET` never returns the raw key; `PUT`'s `null`/omitted-vs-string-vs-empty-string handling as above), with a test asserting the raw key never appears in a `GET /config` response body even when one is configured. Re-capture and commit the Task 0.5 snapshot.

- This screen reuses the same `revision`-guarded `PUT /config` added in Task 6 — carry the `revision` value through the same way, and surface the same 409 message on a stale write.

- [ ] Step 1: Resolve the "测试连接" button's backing behavior with the user (drop vs. add minimal endpoint).
- [ ] Step 2: Port `SettingsScreen.jsx` → `.tsx`, wire `GET/PUT /config` including the `revision` round-trip from Task 6 and the `api_key_set`/write semantics from Step 0 (show a masked placeholder like "••••••••" when `api_key_set` is true, an empty field when false, and only send `api_key` on `PUT` when the user actually typed a new value).
- [ ] Step 3: If a test-connection endpoint was approved, add it to `api_server.py` + test first, same pattern as Task 5 Step 3; re-run the Task 0.5 snapshot capture.
- [ ] Step 4: Manual verification including the same stale-revision 409 check as Task 6 Step 5, run from this screen, plus confirm saving unrelated settings fields doesn't clear or alter the stored key.
- [ ] Step 5: Commit.

---

### Task 8: Port ConsoleScreen/ConsoleDrawer — wire to `WS /logs` + add structured `event` field

**Files:**
- Create: `desktop/src/screens/ConsoleScreen.tsx`
- Modify: `repo_translator/api_server.py` — `_LogBroadcastHandler.emit` includes an `event` field in the NDJSON payload when present.
- Modify: `repo_translator/sync.py` — the specific logger calls that mark file-completion (e.g. the "wrote output/..." line) pass `extra={"event": "file_translated"}` (or equivalent) alongside their existing message text.

**Interfaces:**
- Replace the mockup's static `RT_LOGS` array with a live buffer fed by `api.connectLogs()` (Task 1's WebSocket wrapper). Cap the in-memory buffer (e.g. last 1000 lines) since the WS stream is unbounded for the life of the connection — picking a cap is this task's call, not a deferred decision.
- **`DONE` must be a structured field, not a string-matched message pattern.** Matching on substrings like `"wrote output/"` breaks the instant anyone rewords a log message — a frontend feature silently depending on backend log-message wording is a maintenance trap, not a real category. Instead: Python's `logging` already supports attaching arbitrary structured data via `logger.info(msg, extra={"event": "file_translated"})`; `LogRecord.__dict__` then carries `event` and `_LogBroadcastHandler.emit` (added in the backend Task 0/1's `api_server.py`) includes it in the NDJSON payload (`getattr(record, "event", None)`) when present, `null` otherwise. The frontend's "DONE" filter checks `payload.event === "file_translated"`, not a message substring. Identify which specific `sync.py` log call(s) should carry this `event` tag (the per-file success log, at minimum) and add it there — additive, message text unchanged.
- Level filters (`INFO`/`WARN`/`ERROR`/`DONE`) currently filter the static array client-side — keep that pattern, just filter the live buffer instead, using the structured `event` field for `DONE` and `record.levelname` for the rest.
- Re-run Task 0.5's snapshot capture (the `/logs` NDJSON shape gains `event`) and commit the updated snapshot.

- [ ] Step 1: Identify the exact `sync.py` log call(s) that should carry `event="file_translated"` (or your chosen event name); add the `extra=` kwarg there.
- [ ] Step 2: Extend `_LogBroadcastHandler.emit` to include `event` in the NDJSON payload; add/update a `tests/test_api_server.py` test asserting the field appears when a log call sets it and is absent/`null` otherwise.
- [ ] Step 3: Re-capture and commit the Task 0.5 snapshot update.
- [ ] Step 4: Port `ConsoleScreen.jsx`/`ConsoleDrawer` → `.tsx`, wire to live WS stream with the buffer cap, filter `DONE` on the structured `event` field.
- [ ] Step 5: Manual verification: trigger a real sync from `ReposScreen`, confirm log lines stream into the console drawer in real time and the `DONE` filter correctly catches the file-completion line via its `event` field, not its wording.
- [ ] Step 6: Commit (backend `event`-field change and frontend screen can be separate commits within this task).

---

### Task 9: UsageScreen — real persistent token-usage tracking (option (a), user-confirmed 2026-06-21)

**Decision record:** confirmed via grep (`translator/`, `sync.py`, `cache_manager.py` contain no `usage`/`token`/`cost` tracking — only `max_tokens` request params) that this is a new feature, not a wiring task. User explicitly chose option (a) — full persistent tracking — over the plan's recommended default (d, process-lifetime only), accepting that this is larger than a typical single-screen port. Never invent fake/random numbers for this screen.

**Files:**
- Create: `repo_translator/usage_manager.py` — `usage.json` read/write/record, mirrors `cache_manager.py`'s structure and atomic-write convention exactly (own `_REPO_TRANSLATOR_HOME` computation, duplicated rather than imported, same rationale as `cache_manager.py`'s existing comment).
- Modify: `repo_translator/translator/base.py` — add a `TokenUsage` NamedTuple (`prompt_tokens: int`, `completion_tokens: int`); change `translate_raw`'s abstract contract and `translate_file`'s return type from `str` to `tuple[str, TokenUsage]` (see Interfaces for full accumulation rules).
- Modify: `repo_translator/translator/openai_translator.py`, `repo_translator/translator/claude_translator.py` — extract real usage from each provider's response object alongside the existing text extraction. `deepseek_translator.py` needs no change (inherits `OpenAITranslator` unchanged, same response shape).
- Modify: `repo_translator/sync.py` — `_process_one_file` returns `tuple[bool, str | None, TokenUsage]`; `sync_repo`/`sync_all` gain an optional `usage: dict | None = None` parameter that is **mutated in place** (same mutate-and-return convention as `cache_manager.update`) — return type of `sync_repo`/`sync_all` itself does **not** change, only `cache` is returned, exactly as today. This keeps the change additive: every existing call site that doesn't pass `usage=` keeps working unchanged.
- Modify: `repo_translator/cli.py`, `repo_translator/scheduler.py`, `repo_translator/api_server.py` — every real call site (2 in `cli.py`, 1 in `scheduler.py`, 3 in `api_server.py`) loads `usage_manager.load(usage_manager.DEFAULT_USAGE_PATH)` before calling `sync_repo`/`sync_all`, passes `usage=usage`, and `usage_manager.save(...)` after — same load/pass/save shape already used for `cache` at each of those sites.
- Modify: `repo_translator/api_server.py` — new `GET /usage` endpoint (see Interfaces for response shape).
- Test: `tests/test_translator_base.py` (every inline `translate_raw` override and the `FakeTranslator`/`RateLimitFakeTranslator`-style classes must return `(text, TokenUsage(...))` — there are ~7 override sites), `tests/test_openai_translator.py`/`tests/test_claude_translator.py`/`tests/test_deepseek_translator.py` (whichever exist — check actual filenames) for the real usage-extraction, `tests/test_sync.py` (the single shared `_make_fake_translate_file()` helper returns a tuple now — fixing it there fixes all ~20 call sites that use `.side_effect = fake`, no per-test edits needed), `tests/test_usage_manager.py` (new, mirrors `tests/test_cache_manager.py`'s structure), `tests/test_api_server.py` (new `GET /usage` tests + extend `_setup_temp_paths`-equivalent fixtures to also patch `usage_manager.DEFAULT_USAGE_PATH`).
- Create: `desktop/src/screens/UsageScreen.tsx`.
- Modify: `desktop/src/api.ts` — add `getUsage()` + response interfaces.
- Modify: `desktop/src/App.tsx` — wire `UsageScreen` into the `usage` screen slot.

**Interfaces:**
- **Concurrency correctness (verify this explicitly in review):** `sync_repo` shares one `translator` instance across all files in its `ThreadPoolExecutor`. Usage must flow purely through return values (`translate_raw` → `_call_with_retry` → `translate_file` → `_process_one_file`, each returning `(text, TokenUsage)` and accumulating locally), **never** through a mutable instance attribute on `translator` itself — that would be a real data race across worker threads. `translate_file`'s accumulation: starts at `TokenUsage(0, 0)`, adds the full-file `_call_with_retry` attempt's usage (if it didn't raise), plus every per-marker `_fallback_translate_marker` call's usage (a fallback call's tokens were billed regardless of whether its result ultimately passed validation).
- `usage.json` schema (token counts only — no cost stored, cost is computed at read time so a pricing-table update never needs a data migration):
  ```json
  {
    "daily": {"<YYYY-MM-DD UTC>": {"<engine>": {"prompt_tokens": 0, "completion_tokens": 0, "files": 0}}},
    "repos": {"<repo_name>": {"<engine>": {"prompt_tokens": 0, "completion_tokens": 0, "files": 0}}}
  }
  ```
  `usage_manager.record(usage, repo_name, engine, date, prompt_tokens, completion_tokens) -> dict` increments both views in one call (mutates and returns `usage`, same style as `cache_manager.update`). Record whenever a file's `TokenUsage` is nonzero, **regardless of whether the file ultimately succeeded** (e.g. a write failure after a successful LLM call still consumed billed tokens). Date is the UTC calendar date (`datetime.now(timezone.utc).date().isoformat()`), matching `sync.py`'s existing UTC convention for `translated_at`.
- `GET /usage` response shape (backend does all aggregation so the frontend stays dumb, consistent with `/repos/{name}/files`'s existing precedent):
  ```json
  {
    "daily": [{"date": "2026-05-23", "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}, ...exactly 30 entries, oldest first, zero-filled for days with no data, ending today...],
    "by_engine": [{"engine": "deepseek", "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "cost_usd": 0.0}, ...],
    "by_repo": [{"repo": "langchain", "files": 0, "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "cost_usd": 0.0}, ...],
    "totals": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "cost_usd": 0.0, "files": 0}
  }
  ```
  Cost is computed server-side from a small hardcoded per-engine USD-per-1K-token table in `usage_manager.py` (prompt rate, completion rate) — these are point-in-time public list-price estimates and **will drift from real provider pricing over time**; comment this explicitly next to the table. Unknown/future engine names fall back to `(0.0, 0.0)` (cost shows as `$0`, never crashes).
- Re-run Task 0.5's snapshot capture (new `/usage` endpoint) and commit the updated snapshot.
- Frontend: drop the mockup's `7d`/`30d`/`全部` range `Select` for v1 — the backend always returns a fixed last-30-day window plus all-time totals/breakdowns, and a selector that doesn't actually change anything would be misleading (same "drop rather than fake" precedent as Task 7's dropped "测试连接" button / "开启自动同步" switch). Map the mockup's 4 `StatCard`s to `totals` (本月消耗 Token / 本月成本估算 / 已翻译文件 / 单文件均价 — compute the per-file average client-side from `totals`), the bar chart to `daily`, the engine list to `by_engine`, the repo table to `by_repo`.

- [ ] Step 1: Add `TokenUsage`, change `translate_raw`/`translate_file`'s contracts in `base.py`, update the two real provider engines to extract real usage. Fix the shared test fakes (`tests/test_translator_base.py`'s override sites, `tests/test_sync.py`'s `_make_fake_translate_file()`) to match. Run `uv run pytest tests/test_translator_base.py tests/test_*_translator.py -q` and confirm green before moving on.
- [ ] Step 2: Add `usage_manager.py` (+ `tests/test_usage_manager.py`), wire `sync.py`'s `_process_one_file`/`sync_repo`/`sync_all` to accumulate and record usage via the new optional `usage=` parameter (no change to existing callers that omit it). Run `uv run pytest tests/test_sync.py tests/test_usage_manager.py -q`.
- [ ] Step 3: Wire all 6 real call sites (`cli.py` x2, `scheduler.py` x1, `api_server.py` x3) to load/pass/save `usage.json`, same shape as the existing `cache` load/save. Add `GET /usage` to `api_server.py` with the aggregation/cost-table logic above; extend test path-patching fixtures to cover `usage_manager.DEFAULT_USAGE_PATH`. Run the full `uv run pytest tests/ -q`.
- [ ] Step 4: Re-capture and commit the Task 0.5 snapshot update (new `/usage` endpoint).
- [ ] Step 5: Port `UsageScreen.jsx` → `.tsx`, wire to `GET /usage`, wire `App.tsx`'s `usage` slot.
- [ ] Step 6: Manual verification: run a real sync against a small local test repo with a real (or fake-but-realistic) translator, confirm `usage.json` gets nonzero counts and `GET /usage`/the UI reflect them; confirm `cache.json`-only existing behavior is unaffected when `usage=` is omitted (e.g. any caller not yet updated, if applicable).
- [ ] Step 7: Commit (this task's backend usage-tracking core, persistence+endpoint, and frontend screen may be separate commits, similar to Task 7/8's precedent).

---

### Task 10: Package the Python sidecar as a standalone executable

**Files:**
- Create: `repo_translator.spec` (PyInstaller spec file) **or** equivalent Nuitka build config, depending on Step 1's outcome
- Modify: `pyproject.toml` — add a console-script entry point if missing (additive only, per Global Constraints)

**Interfaces:**
- Produces: a single-file executable that runs the sidecar (Task 1's dynamic-port `main()`) on startup, bundling `openai`/`anthropic`/`httpx`/`uvicorn`/`pydantic` correctly.
- **Evaluate PyInstaller first; switch to Nuitka if packaging reliability becomes an issue, not after burning unbounded time on `--hidden-import` whack-a-mole.** PyInstaller is the more common first try, but bundling `openai`+`anthropic`+`httpx`+`uvicorn`+`pydantic` together is a known source of repeated hidden-import failures across these specific libraries (dynamic imports, plugin-style module discovery). Set an explicit time-box for Step 2-3 below (e.g. half a day) — if PyInstaller is still failing to produce a working binary after that, switch to Nuitka rather than continuing to add `--hidden-import` flags one failure at a time. Record whichever tool ends up working in this task's commit message so the next person doesn't re-litigate the choice.

- [ ] Step 1: Add PyInstaller as a dev dependency (`uv add --dev pyinstaller` or equivalent) and attempt the build first.
- [ ] Step 2: Write the spec/build command, run it, confirm the resulting binary starts and serves the enriched `/health` (Task 1) on its dynamically-assigned port when launched directly (no Tauri involved yet).
- [ ] Step 3: Debug hidden-import failures from `openai`/`anthropic`/etc. within the time-box from above. If still failing past that point, switch to Nuitka (`uv add --dev nuitka`, equivalent build invocation) and repeat Step 2 with it instead.
- [ ] Step 4: Commit the spec/build config for whichever tool worked (not the built binary — exclude `dist/`/`build/` via `.gitignore`); note the chosen tool and why in the commit message.

---

### Task 11: Wire the sidecar into Tauri (externalBin) + app lifecycle + port handshake

**Files:**
- Modify: `desktop/src-tauri/tauri.conf.json` (register the Task 10 binary as `externalBin`)
- Modify: `desktop/src-tauri/src/main.rs` (or `lib.rs`, depending on the Tauri 2 template) — spawn the sidecar on app startup, parse its first stdout line as the startup JSON object (Task 1), expose the port to the frontend via a Tauri command, terminate the sidecar on app exit.

**Interfaces:**
- Confirm Tauri 2's sidecar API (`tauri-plugin-shell`'s `Command::sidecar(...)`) — the exact API may differ from what the design spec assumed at write time; read Tauri 2's current sidecar docs/examples before implementing, don't transcribe v1-era patterns.
- Port handshake: spawn the sidecar, read its stdout line-by-line until a line successfully parses as JSON with `"type": "startup"` (skip/log any line that doesn't parse — defensive against an unexpected stray print before it, though Task 1 is written to avoid that), with a timeout — if the sidecar never produces that line or exits early, surface a startup error in the UI rather than hanging. Store the parsed `port` in app state, expose it via `#[tauri::command] fn get_backend_port() -> u16`. `api.ts` (Task 1) calls this on startup before issuing any HTTP/WS request.
- Confirm graceful shutdown: the sidecar process must be killed when the Tauri window closes, not orphaned as a background process.

- [ ] Step 1: Register the Task 10 binary as `externalBin` in `tauri.conf.json`.
- [ ] Step 2: Spawn it on app startup (Rust `setup` hook), implement the stdout port-handshake described above, confirm via the enriched `/health` poll (Task 1) that it's up and `config_loaded`/`cache_loaded` are both true before showing the main window (or show a loading state while waiting, and a clear error state if `/health` ever reports `false` for either).
- [ ] Step 3: Confirm process termination on app close (test: close the app, check `ps`/Activity Monitor for an orphaned process).
- [ ] Step 4: Full manual smoke test: `npm run tauri build`, install/run the packaged app, click through every screen against the real bundled sidecar (no `npm run tauri dev` — this must be the actual packaged build). Additionally test the port-conflict scenario the dynamic-port design exists for: launch two instances of the packaged app simultaneously, confirm both come up successfully on different ports rather than one failing to bind.
- [ ] Step 5: Commit.

---

### Task 12 (Post-v1 Required — not optional, just sequenced after the first installable build): Tauri auto-update integration

**Files:**
- Modify: `desktop/src-tauri/tauri.conf.json` (register the `updater` plugin/capability)
- Modify: `desktop/src-tauri/Cargo.toml` (add `tauri-plugin-updater`)

**Interfaces:**
- **This is not "optional" in the sense of "nice to have, may never happen" — it's required before any real (non-developer) user installs this app, just not required to validate Tasks 0-11's plumbing.** A desktop app with no update mechanism means every future fix ships as "ask users to manually download and reinstall," which doesn't scale past the first few bug reports, and in practice "optional" items in a plan tend to never get scheduled. Treat Task 11's first installable build as an internal milestone, not a release-readiness signal — this task is a hard prerequisite for distributing the app to anyone outside the implementation team. Schedule it immediately after Task 11 stabilizes, not as an indefinitely deferred backlog item.
- Requires a release artifact hosting location (GitHub Releases is the simplest fit given `origin` is already a GitHub repo) and a signing key pair for update manifests, per Tauri 2's updater plugin docs — confirm the current setup steps against Tauri 2's docs at implementation time, don't assume v1-era instructions apply.

- [ ] Step 1: Add `tauri-plugin-updater`, configure the update-manifest endpoint (GitHub Releases-backed) and signing keys per Tauri 2's current docs.
- [ ] Step 2: Wire a manual "检查更新" action (or automatic on-startup check) into `SettingsScreen` or `AppShell`.
- [ ] Step 3: Cut a real test release (bump version, build, publish), confirm an already-installed build detects and applies the update.
- [ ] Step 4: Commit.

---

## Done Criteria

**v1 (internal/test build, Tasks 0-11):**

- `npm run tauri build` produces an installable desktop app.
- Every screen ported (Dashboard, Repos, Glossary, Settings, Console; Usage per Task 9's resolved decision) is wired to real `api_server.py` data — no remaining mock arrays, no `Math.random()`-driven UI elements, except where a task explicitly scoped a feature out (Task 9's Usage screen, Task 7's test-connection button if dropped).
- The packaged app's bundle size is in the 50-100MB range anticipated by the design spec (if significantly over, investigate before considering this plan done — don't silently accept a 2-3x miss).
- **Cold start time is measured and acceptable** — time from launching the packaged app to the main window showing real data (i.e. past Task 11's `/health` gate) is under ~3-5 seconds on a clean machine (no warm OS file cache from a prior run). A Tauri+PyInstaller/Nuitka-bundled Python process carrying `uvicorn`+`openai`+`anthropic` is a real risk for slow startup; measure this explicitly rather than assuming it's fine because the dev-mode `npm run tauri dev` felt fast (dev mode doesn't reflect the packaged binary's cold-start cost). If it's slow, a startup splash/loading screen is an acceptable mitigation, but the time itself should still be measured and recorded.
- Closing the app leaves no orphaned sidecar process; two simultaneous app instances both start successfully on independently-assigned ports (Task 11's port-conflict test).
- The enriched `/health` (Task 1) reports `config_loaded`/`cache_loaded` as true in normal operation, and the app surfaces a real error state rather than proceeding past a `/health` that reports either as false.
- `GET /config`/`PUT /config`'s `revision` guard (Task 6) actually rejects a stale write with `409` — verified manually, not just assumed from the code. (Remember: this guard is documented as protecting against same-process stale-UI races only, not cross-process atomicity — see Task 6's scope-limit note.)
- `GET /config` never returns a raw API key under any code path (Task 7) — verified by an actual test asserting this, not just a read-through of the code.
- The Task 0.5 API contract snapshot file is up to date with the final state of every endpoint touched by Tasks 1/5/6/7/8/10 — if any task's approved backend change landed without a corresponding snapshot re-capture, that's a gap to close before calling this plan done, not a future cleanup item.
- `uv run pytest tests/ -q` still passes (Tasks 1, 5, 6, 7, 8, and 10 touch Python files, all additively per the Global Constraints' enumerated exception list).

**Required before distributing to any non-developer user (Task 12):**

- Auto-update is wired and verified end-to-end with a real test release. Do not treat the v1 build above as release-ready until this is done — see Task 12's framing.
