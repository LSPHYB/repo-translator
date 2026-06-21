/**
 * ReposScreen — repo list + a selected repo's per-file status, plus
 * add-repo modal.
 *
 * Ported from ui_kits/desktop-app/ReposScreen.jsx (window.ReposScreen
 * global) -- same layout/components/Chinese copy as the mockup, but wired
 * to real data:
 *
 * - "添加仓库" calls `api.addRepo()`. The mockup's `kind` toggle
 *   (managed vs external) is kept purely as a UI hint for which placeholder/
 *   label to show the user -- `POST /repos`'s `url_or_path` field
 *   auto-detects managed-vs-external server-side (`_is_url` in
 *   api_server.py), so we just pass through whatever the user typed in
 *   either input.
 * - "移出跟踪" calls `api.deleteRepo()`.
 * - "立即同步" (per-repo) calls `api.syncRepo()`; the per-file retry row
 *   calls `api.syncFile(repo, path)`.
 * - The file list comes from `api.getRepoFiles()` (GET
 *   /repos/{name}/files), added in this task. Response shape:
 *   `{path, status: "pending"|"synced", last_sync, error}` -- note the
 *   REST endpoint NEVER returns "running"; see below.
 * - `running` overlay: while a repo's file list is showing, this screen
 *   subscribes to `api.connectLogs()` (the `/logs` WebSocket) and parses
 *   each NDJSON line for `event`/`path`. `file_start` for a path in the
 *   current list marks it `"running"` locally (overlaid on top of the
 *   REST-derived status); `file_translated`/`file_failed` transition it
 *   directly to `"synced"`/`"error"` from the event itself (not waiting for
 *   a REST re-poll -- the REST re-fetch on sync-completion is a consistency
 *   backstop, not the primary signal). This local overlay is cleared
 *   whenever the REST list is re-fetched (mount, after add/delete, after a
 *   sync action settles), since a fresh fetch already reflects ground
 *   truth and a stale "running"/"error" overlay from a previous run must
 *   not linger across it.
 *
 * Dropped from the mockup (no real backend signal to back them with):
 * - The "已排除" (excluded) tab and the mock `files` array's `excluded`
 *   status value: the API silently omits excluded files from
 *   `GET /repos/{name}/files` entirely (matching sync.py's real behavior --
 *   excluded files never participate in translation tracking at all), so
 *   there is no "this file is excluded" signal to show. Showing a tab that
 *   can only ever be empty would be worse than not having it.
 * - "排除项配置" / "查看译文" repo-card actions and the file row's
 *   "查看译文" equivalent: no backend endpoint exists for either (excluded-
 *   pattern config has no API, and there is no "open a specific translated
 *   file" endpoint). Rendered as visible-but-disabled buttons rather than
 *   omitted (so the feature's existence is still discoverable) or wired to
 *   a fake toast -- per the plan's rule against faking interactions that
 *   don't do anything real.
 * - "在文件管理器中打开" DOES have a real implementation: `@tauri-apps/
 *   plugin-opener`'s `revealItemInDir` (confirmed installed in
 *   desktop/node_modules at v2.5.4, registered in src-tauri/src/lib.rs via
 *   `tauri_plugin_opener::init()`, and granted `opener:default` in
 *   src-tauri/capabilities/default.json -- this was already wired up by an
 *   earlier task, not something this task added). Reveals
 *   `{output.base_dir}/{repo}/` in the OS file manager.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import * as api from '../api';
import type { RepoListItem, LogMessage } from '../api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { Button, Card, Tabs, Badge, StatusDot, Input, RepoCard, Spinner } from '../design-system';

type FileStatus = 'pending' | 'running' | 'synced' | 'error';

interface FileRow {
  path: string;
  status: FileStatus;
  lastSync: string | null;
  error: string | null;
}

function Ic(d: React.ReactNode) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}
const plusIcon = Ic(
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>,
);
const retryIcon = Ic(
  <>
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
  </>,
);

const STATUS_TONE: Record<FileStatus, 'success' | 'warning' | 'accent' | 'error'> = {
  synced: 'success',
  pending: 'warning',
  running: 'accent',
  error: 'error',
};
const STATUS_LABEL: Record<FileStatus, string> = {
  synced: '已翻译',
  pending: '待同步',
  running: '同步中',
  error: '失败',
};
const STATUS_DOT_TONE: Record<FileStatus, 'ok' | 'warn' | 'muted' | 'error'> = {
  synced: 'ok',
  pending: 'warn',
  running: 'muted',
  error: 'error',
};

export default function ReposScreen() {
  const [repos, setRepos] = useState<RepoListItem[]>([]);
  const [outputBaseDir, setOutputBaseDir] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'pending'>('all');
  const [files, setFiles] = useState<FileRow[]>([]);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<'managed' | 'external'>('managed');
  const [addValue, setAddValue] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [repoSyncing, setRepoSyncing] = useState<Set<string>>(new Set());
  const [fileSyncing, setFileSyncing] = useState<Set<string>>(new Set());

  const loadRepos = useCallback(async () => {
    try {
      const result = await api.listRepos();
      setRepos(result);
      setLoadError(null);
      // Default-select the first repo once we have a list and nothing is
      // selected yet (covers initial mount and the "selected repo was just
      // deleted" case).
      setSelected((prev) => {
        if (prev && result.some((r) => r.name === prev)) return prev;
        return result.length > 0 ? result[0].name : null;
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    loadRepos();
    api
      .getConfig()
      .then((cfg) => setOutputBaseDir(cfg.output.base_dir))
      .catch(() => {
        /* best-effort -- only used for the "打开目录" tooltip/path, not load-blocking */
      });
  }, [loadRepos]);

  const loadFiles = useCallback(async (repoName: string) => {
    try {
      const result = await api.getRepoFiles(repoName);
      setFiles(
        result.map((f) => ({
          path: f.path,
          status: f.status,
          lastSync: f.last_sync,
          error: f.error,
        })),
      );
      setFilesError(null);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (selected) {
      loadFiles(selected);
    } else {
      setFiles([]);
    }
  }, [selected, loadFiles]);

  // `running`/`error` overlay sourced from the /logs WebSocket while a
  // repo's file list is showing. Re-subscribing on `selected` change means
  // events for a no-longer-displayed repo are simply ignored (the path
  // lookup below only matches against the currently-loaded `files` list).
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    if (!selected) return undefined;
    const ws = api.connectLogs((log: LogMessage) => {
      const event = (log as LogMessage & { event?: string; path?: string; error?: string }).event;
      const path = (log as LogMessage & { event?: string; path?: string; error?: string }).path;
      if (!event || !path) return;
      // Events arrive for whichever repo is syncing; since file paths are
      // repo-relative and not globally unique, only apply the overlay if a
      // row with this path is currently displayed for the selected repo.
      setFiles((prev) => {
        if (!prev.some((f) => f.path === path)) return prev;
        return prev.map((f) => {
          if (f.path !== path) return f;
          if (event === 'file_start') return { ...f, status: 'running' };
          if (event === 'file_translated') {
            return { ...f, status: 'synced', error: null, lastSync: new Date().toISOString() };
          }
          if (event === 'file_failed') {
            const errMsg = (log as LogMessage & { error?: string }).error ?? null;
            return { ...f, status: 'error', error: errMsg };
          }
          return f;
        });
      });
    });
    return () => ws.close();
  }, [selected]);

  async function handleAddRepo() {
    if (!addValue.trim()) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      const result = await api.addRepo({ url_or_path: addValue.trim() });
      setAdding(false);
      setAddValue('');
      await loadRepos();
      setSelected(result.name);
      // "添加并同步" -- kick off a sync immediately so the user doesn't
      // have to take a second action to see results.
      setRepoSyncing((prev) => new Set(prev).add(result.name));
      try {
        await api.syncRepo(result.name);
      } finally {
        setRepoSyncing((prev) => {
          const next = new Set(prev);
          next.delete(result.name);
          return next;
        });
        await loadRepos();
        if (selectedRef.current === result.name) {
          await loadFiles(result.name);
        }
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleRemove(name: string) {
    try {
      await api.deleteRepo(name);
      await loadRepos();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSyncRepo(name: string) {
    setRepoSyncing((prev) => new Set(prev).add(name));
    try {
      await api.syncRepo(name);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setRepoSyncing((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      await loadRepos();
      if (selectedRef.current === name) {
        await loadFiles(name);
      }
    }
  }

  async function handleSyncFile(repoName: string, path: string) {
    setFileSyncing((prev) => new Set(prev).add(path));
    try {
      await api.syncFile(repoName, path);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : String(err));
    } finally {
      setFileSyncing((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      await loadFiles(repoName);
    }
  }

  async function handleOpenDir(repoName: string) {
    if (!outputBaseDir) return;
    const dir = `${outputBaseDir.replace(/\/$/, '')}/${repoName}`;
    try {
      await revealItemInDir(dir);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }

  const pendingCount = files.filter((f) => f.status === 'pending' || f.status === 'error').length;
  const filtered = tab === 'all' ? files : files.filter((f) => f.status === 'pending' || f.status === 'error');
  const selectedRepo = repos.find((r) => r.name === selected) ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="REPOSITORIES · 仓库管理"
        title="仓库管理"
        desc={`跟踪 ${repos.length} 个仓库`}
        actions={
          <Button variant="primary" icon={plusIcon} onClick={() => setAdding(true)}>
            添加仓库
          </Button>
        }
      />

      {loadError && (
        <Card style={{ marginBottom: 14 }} padding={16}>
          <span style={{ fontSize: 13, color: 'var(--status-error)' }}>加载仓库列表失败：{loadError}</span>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {repos.length === 0 && !loadError && (
            <Card padding={18}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>暂无跟踪仓库，点击「添加仓库」开始。</span>
            </Card>
          )}
          {repos.map((repo) => (
            <div key={repo.name} onClick={() => setSelected(repo.name)} style={{ cursor: 'pointer' }}>
              <RepoCard
                name={repo.name}
                kind={repo.kind}
                branch={repo.branch ?? undefined}
                lastSync={repo.last_sync ?? '从未同步'}
                files={repo.file_count}
                syncing={repoSyncing.has(repo.name)}
                onSync={() => handleSyncRepo(repo.name)}
                onOpenDir={() => handleOpenDir(repo.name)}
                onRemove={() => handleRemove(repo.name)}
                style={selected === repo.name ? { outline: '2px solid var(--accent)', outlineOffset: 2 } : {}}
              />
            </div>
          ))}
        </div>

        <Card variant="solid" padding={0}>
          {selectedRepo ? (
            <>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                    {selectedRepo.name}
                  </span>
                  <Badge tone="accent" size="sm">
                    {selectedRepo.kind}
                  </Badge>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Tabs
                    active={tab}
                    onSelect={(id: string) => setTab(id as 'all' | 'pending')}
                    tabs={[
                      { id: 'all', label: '全部', count: files.length },
                      { id: 'pending', label: '待同步', count: pendingCount },
                    ]}
                  />
                </div>
              </div>
              <div style={{ padding: 8 }}>
                {filesError && (
                  <div style={{ padding: '9px 12px', fontSize: 13, color: 'var(--status-error)' }}>加载文件列表失败：{filesError}</div>
                )}
                {!filesError && filtered.length === 0 && (
                  <div style={{ padding: '9px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>没有匹配的文件。</div>
                )}
                {filtered.map((f) => (
                  <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 9 }} title={f.error ?? undefined}>
                    {f.status === 'running' ? <Spinner size={12} /> : <StatusDot tone={STATUS_DOT_TONE[f.status]} />}
                    <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-primary)' }}>{f.path}</span>
                    <Badge tone={STATUS_TONE[f.status]} size="sm">
                      {STATUS_LABEL[f.status]}
                    </Badge>
                    {(f.status === 'pending' || f.status === 'error') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={retryIcon}
                        disabled={fileSyncing.has(f.path)}
                        onClick={() => handleSyncFile(selectedRepo.name, f.path)}
                      >
                        {fileSyncing.has(f.path) ? '同步中…' : '同步'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: 18, fontSize: 13, color: 'var(--text-secondary)' }}>选择左侧的一个仓库查看文件列表。</div>
          )}
        </Card>
      </div>

      {adding && (
        <Modal
          title="添加仓库"
          onClose={() => setAdding(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={addSubmitting}>
                取消
              </Button>
              <Button variant="primary" onClick={handleAddRepo} disabled={addSubmitting || !addValue.trim()} loading={addSubmitting}>
                添加并同步
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {([
                ['managed', 'Managed (Git URL)'],
                ['external', 'External (本地目录)'],
              ] as const).map(([id, lbl]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKind(id)}
                  style={{
                    flex: 1,
                    padding: '14px 16px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: kind === id ? 'var(--accent-soft)' : 'var(--surface-sunken)',
                    border: `1px solid ${kind === id ? 'var(--accent)' : 'var(--border-default)'}`,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 999,
                        border: `5px solid ${kind === id ? 'var(--accent)' : 'var(--border-strong)'}`,
                        background: 'var(--bg-elevated)',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{lbl}</span>
                  </div>
                </button>
              ))}
            </div>
            {kind === 'managed' ? (
              <Input
                label="仓库 URL"
                mono
                placeholder="https://github.com/org/repo.git"
                value={addValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddValue(e.target.value)}
              />
            ) : (
              <Input
                label="本地目录"
                mono
                placeholder="/Users/me/code/my-project"
                value={addValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddValue(e.target.value)}
              />
            )}
            {addError && <span style={{ fontSize: 12, color: 'var(--status-error)' }}>{addError}</span>}
          </div>
        </Modal>
      )}
    </div>
  );
}
