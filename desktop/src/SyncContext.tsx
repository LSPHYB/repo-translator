/**
 * SyncContext — the app's single live-state hub.
 *
 * Originally this only held the cross-page "which repos are syncing" set. It
 * now owns ONE shared `/logs` WebSocket connection (instead of every screen
 * opening its own) and derives three pieces of shared state from it, so every
 * page sees the same thing:
 *
 *  - `logs`     — the raw capped log buffer feeding both the 调试台
 *                 (ConsoleScreen) and the bottom 实时日志面板 (ConsoleDrawer).
 *                 Buffering centrally means the drawer shows the backlog that
 *                 accumulated before it was opened, instead of starting empty
 *                 on its own late-opened socket.
 *  - `progress` — per-repo translation progress (done/total + current file),
 *                 driven by the backend's `sync_start`/`file_*`/`sync_done`
 *                 events (each now carrying a `repo` field). This is what lets
 *                 the dashboard render a real progress bar during a sync,
 *                 including a sync-all where repos light up one at a time.
 *  - `repos`    — the shared tracked-repo list + `reloadRepos()`. Dashboard
 *                 and Repos both read this list, so a repo added on one page
 *                 shows up on the other immediately (and after every
 *                 `sync_done` it is auto-refreshed so file counts / last-sync
 *                 stay current).
 *
 * `syncingRepos` / `markSyncing` / `markDone` remain for optimistic button
 * feedback (set the instant a button is clicked, before any log arrives); the
 * WS `sync_start`/`sync_done` events also flip the same set so a sync started
 * from anywhere (or from another page) is reflected too. Both removers are
 * idempotent.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import * as api from './api';
import type { LogMessage, RepoListItem } from './api';

const LOG_BUFFER_CAP = 1000;

export interface RepoProgress {
  done: number;
  total: number;
  currentFile: string | null;
}

interface SyncContextValue {
  syncingRepos: ReadonlySet<string>;
  markSyncing: (key: string) => void;
  markDone: (key: string) => void;
  progress: Readonly<Record<string, RepoProgress>>;
  logs: readonly LogMessage[];
  repos: readonly RepoListItem[];
  reposError: string | null;
  reloadRepos: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue>({
  syncingRepos: new Set(),
  markSyncing: () => {},
  markDone: () => {},
  progress: {},
  logs: [],
  repos: [],
  reposError: null,
  reloadRepos: async () => {},
});

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncingRepos, setSyncingRepos] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, RepoProgress>>({});
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [repos, setRepos] = useState<RepoListItem[]>([]);
  const [reposError, setReposError] = useState<string | null>(null);

  const markSyncing = useCallback((key: string) => {
    setSyncingRepos((p) => new Set(p).add(key));
  }, []);

  const markDone = useCallback((key: string) => {
    setSyncingRepos((p) => {
      const s = new Set(p);
      s.delete(key);
      return s;
    });
  }, []);

  const reloadRepos = useCallback(async () => {
    try {
      const result = await api.listRepos();
      setRepos(result);
      setReposError(null);
    } catch (err) {
      setReposError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    reloadRepos();
  }, [reloadRepos]);

  // Single shared /logs WebSocket. Reconnects on unexpected close (the
  // sidecar lives for the whole app session, so a close generally means a
  // transient hiccup) until the provider unmounts.
  const reloadReposRef = useRef(reloadRepos);
  reloadReposRef.current = reloadRepos;

  useEffect(() => {
    let closedByUs = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const handle = (log: LogMessage) => {
      setLogs((prev) => {
        const next = [...prev, log];
        return next.length > LOG_BUFFER_CAP
          ? next.slice(next.length - LOG_BUFFER_CAP)
          : next;
      });

      const { event, repo, path } = log;
      if (!event || !repo) return;

      if (event === 'sync_start') {
        setProgress((p) => ({
          ...p,
          [repo]: { done: 0, total: log.total ?? 0, currentFile: null },
        }));
        setSyncingRepos((s) => new Set(s).add(repo));
      } else if (event === 'file_start') {
        setProgress((p) => {
          const cur = p[repo] ?? { done: 0, total: 0, currentFile: null };
          return { ...p, [repo]: { ...cur, currentFile: path ?? null } };
        });
      } else if (event === 'file_translated' || event === 'file_failed') {
        setProgress((p) => {
          const cur = p[repo] ?? { done: 0, total: 0, currentFile: null };
          return { ...p, [repo]: { ...cur, done: cur.done + 1 } };
        });
      } else if (event === 'sync_done') {
        setProgress((p) => {
          const next = { ...p };
          delete next[repo];
          return next;
        });
        setSyncingRepos((s) => {
          const next = new Set(s);
          next.delete(repo);
          return next;
        });
        // File counts / last-sync changed for this repo -- refresh the shared
        // list so every page reflects it without a manual re-fetch.
        reloadReposRef.current();
      }
    };

    const connect = () => {
      ws = api.connectLogs(handle);
      ws.addEventListener('close', () => {
        if (closedByUs) return;
        reconnectTimer = setTimeout(connect, 1000);
      });
    };
    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return (
    <SyncContext.Provider
      value={{
        syncingRepos,
        markSyncing,
        markDone,
        progress,
        logs,
        repos,
        reposError,
        reloadRepos,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export const useSyncContext = () => useContext(SyncContext);
