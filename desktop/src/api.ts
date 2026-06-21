/**
 * Typed client for repo-translator's local desktop API
 * (`repo_translator/api_server.py`, a FastAPI app + `WS /logs`).
 *
 * Request/response shapes here are based on the frozen API contract
 * snapshot at docs/superpowers/specs/2026-06-20-desktop-api-contract-snapshot.json
 * (captured live from the running server's /openapi.json plus hand-verified
 * field names for routes that return a plain dict, where OpenAPI only
 * generates a generic `additionalProperties: true` schema) -- NOT from the
 * design doc, which may drift from the implementation.
 *
 * ---------------------------------------------------------------------------
 * Backend port resolution (dev-only fallback -- READ BEFORE CHANGING)
 * ---------------------------------------------------------------------------
 * In the packaged Tauri app, the backend is spawned as a sidecar process
 * that prints `{"type": "startup", "port": <n>}` as its first stdout line;
 * Task 11 (not yet implemented) wires Rust to read that line and expose the
 * port to the frontend via `invoke("get_backend_port")`. That Tauri command
 * does not exist yet, so `resolveBackendPort()` below cannot call it yet.
 *
 * Until Task 11 lands, this module falls back to (in order):
 *   1. `import.meta.env.VITE_BACKEND_PORT` -- set this in `desktop/.env.local`
 *      (or export it before `npm run dev`) to point at a manually-started
 *      `uv run python -m repo_translator.api_server` instance during local
 *      development.
 *   2. `DEV_FALLBACK_PORT` (8000) -- a fixed dev-only port, matching the
 *      `uvicorn repo_translator.api_server:app --port 8000` command
 *      mentioned in api_server.py's module docstring.
 *
 * Both fallback paths are DEV-ONLY and are never reachable in the packaged
 * app: once Task 11 adds the Tauri command, `resolveBackendPort()` must be
 * updated to call it first (e.g. gated on `"__TAURI_INTERNALS__" in window`)
 * and these fallbacks should only remain as the `npm run dev` (no Tauri
 * shell) escape hatch.
 */

// Vite exposes env vars prefixed VITE_ via import.meta.env at build time.
declare global {
  interface ImportMetaEnv {
    readonly VITE_BACKEND_PORT?: string;
  }
}

const DEV_FALLBACK_PORT = 8000;

function resolveBackendPort(): number {
  // TODO(Task 11): once a Tauri `get_backend_port` command exists, prefer
  // it here when running inside the packaged app. This function is
  // currently synchronous because there is no async Tauri call to make yet;
  // when that lands, every call site of `baseUrl()`/`wsUrl()` below will
  // need to become async (or the port resolved once at app startup and
  // cached) -- tracked as Task 11 follow-up, not done here.
  const envPort = import.meta.env.VITE_BACKEND_PORT;
  if (envPort) {
    const parsed = Number(envPort);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEV_FALLBACK_PORT;
}

function baseUrl(): string {
  return `http://127.0.0.1:${resolveBackendPort()}`;
}

function wsUrl(): string {
  return `ws://127.0.0.1:${resolveBackendPort()}/logs`;
}

/** Thrown for any non-2xx response; carries the parsed body when available. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : undefined;
    super(detail ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const resp = await fetch(`${baseUrl()}${path}`, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (resp.status === 204) {
    return undefined as T;
  }

  let body: unknown = undefined;
  const text = await resp.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!resp.ok) {
    throw new ApiError(resp.status, body);
  }
  return body as T;
}

// -----------------------------------------------------------------------
// GET /health
// -----------------------------------------------------------------------

export interface HealthResponse {
  status: "ok";
  config_loaded: boolean;
  cache_loaded: boolean;
  version: string;
}

export function health(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

// -----------------------------------------------------------------------
// GET/PUT /config
// -----------------------------------------------------------------------

export interface TranslatorConfig {
  engine: string;
  // GET /config never returns the literal key (see _serialize_config in
  // api_server.py) -- only whether one is currently stored.
  api_key_set: boolean;
  // Write-only: only meaningful in a PUT request body, never present in a
  // GET response. Send a non-empty string to set/replace the stored key, an
  // empty string "" to clear it, or omit the field entirely to leave the
  // stored key unchanged.
  api_key?: string;
  model?: string | null;
  base_url?: string | null;
  max_tokens: number;
  temperature: number;
}

export interface SyncConfig {
  interval_hours: number;
  concurrency: number;
}

export interface OutputConfig {
  base_dir: string;
  suffix: string;
  exclude: string[];
}

export interface RepoConfig {
  name: string;
  url?: string | null;
  path?: string | null;
  branch?: string | null;
  added_at?: string | null;
}

export interface GlossaryEntry {
  term: string;
  translation?: string | null;
}

export interface AppConfig {
  translator: TranslatorConfig;
  sync: SyncConfig;
  output: OutputConfig;
  repos: RepoConfig[];
  glossary: GlossaryEntry[];
  // Optimistic-concurrency token (see AppConfig.revision in config.py).
  // Callers must round-trip whatever value they last read via getConfig()
  // back through putConfig() -- the server rejects a PUT whose `revision`
  // doesn't match its current value with 409, rather than silently
  // overwriting a save that landed from elsewhere in between.
  revision: number;
}

export function getConfig(): Promise<AppConfig> {
  return request<AppConfig>("/config");
}

export function putConfig(config: AppConfig): Promise<AppConfig> {
  return request<AppConfig>("/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

// -----------------------------------------------------------------------
// GET/POST /repos, DELETE /repos/{name}
// -----------------------------------------------------------------------

export interface RepoListItem {
  name: string;
  kind: "managed" | "external";
  branch: string | null;
  last_sync: string | null;
  file_count: number;
}

export function listRepos(): Promise<RepoListItem[]> {
  return request<RepoListItem[]>("/repos");
}

export interface AddRepoRequest {
  url_or_path: string;
  name?: string;
}

export interface AddRepoResponse {
  name: string;
  kind: "managed" | "external";
}

export function addRepo(payload: AddRepoRequest): Promise<AddRepoResponse> {
  return request<AddRepoResponse>("/repos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteRepo(name: string): Promise<void> {
  return request<void>(`/repos/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

// -----------------------------------------------------------------------
// GET /repos/{name}/files
// -----------------------------------------------------------------------

/**
 * REST-derived per-file status. Note this never includes "running" -- the
 * REST endpoint is a point-in-time snapshot derived from cache.json, with
 * no visibility into an in-flight ThreadPoolExecutor future on the backend.
 * "running" is a frontend-only overlay sourced from the `/logs` WebSocket's
 * `file_start`/`file_translated`/`file_failed` events (see ReposScreen.tsx).
 */
export interface RepoFileItem {
  path: string;
  status: "pending" | "synced";
  last_sync: string | null;
  error: string | null;
}

export function getRepoFiles(name: string): Promise<RepoFileItem[]> {
  return request<RepoFileItem[]>(`/repos/${encodeURIComponent(name)}/files`);
}

// -----------------------------------------------------------------------
// POST /repos/{name}/sync, /repos/{name}/files/{path}/sync,
// /repos/sync-all, /repos/sync-all/cancel
// -----------------------------------------------------------------------

export interface SyncRepoResponse {
  name: string;
  files_succeeded: number;
}

export function syncRepo(name: string): Promise<SyncRepoResponse> {
  return request<SyncRepoResponse>(
    `/repos/${encodeURIComponent(name)}/sync`,
    { method: "POST" },
  );
}

export interface SyncFileResponse {
  name: string;
  path: string;
  succeeded: boolean;
}

export function syncFile(name: string, path: string): Promise<SyncFileResponse> {
  // `path` is a repo-relative file path (e.g. "docs/guide.md") and is
  // matched server-side via FastAPI's `{path:path}` converter, which
  // accepts unescaped slashes -- encode each segment individually so a
  // path containing `docs/guide.md` is NOT turned into `docs%2Fguide.md`
  // (which the path:path route would treat as a single literal segment).
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return request<SyncFileResponse>(
    `/repos/${encodeURIComponent(name)}/files/${encodedPath}/sync`,
    { method: "POST" },
  );
}

export interface SyncAllResponse {
  repos_processed: number;
  cancelled: boolean;
}

export function syncAll(): Promise<SyncAllResponse> {
  return request<SyncAllResponse>("/repos/sync-all", { method: "POST" });
}

export interface CancelSyncAllResponse {
  cancelled: boolean;
}

export function cancelSyncAll(): Promise<CancelSyncAllResponse> {
  return request<CancelSyncAllResponse>("/repos/sync-all/cancel", {
    method: "POST",
  });
}

// -----------------------------------------------------------------------
// WS /logs
// -----------------------------------------------------------------------

export interface LogMessage {
  time: string;
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  logger: string;
  message: string;
}

/**
 * Opens a WebSocket to `/logs` and invokes `onMessage` for every NDJSON log
 * line broadcast by the server (one `logging.LogRecord` per message; see
 * `_LogBroadcastHandler.emit` in `repo_translator/api_server.py`). The
 * connection is server-to-client only -- the server only reads incoming
 * client text to detect disconnects, so nothing needs to be sent on this
 * socket.
 *
 * Returns the raw `WebSocket` so the caller can close it
 * (`connection.close()`) when no longer needed, e.g. on component unmount.
 */
export function connectLogs(onMessage: (log: LogMessage) => void): WebSocket {
  const ws = new WebSocket(wsUrl());
  ws.addEventListener("message", (event: MessageEvent<string>) => {
    try {
      const parsed = JSON.parse(event.data) as LogMessage;
      onMessage(parsed);
    } catch {
      // Malformed line from the server -- drop it rather than throwing
      // inside a WebSocket event handler (which would be an unhandled
      // rejection with no useful stack).
    }
  });
  return ws;
}
