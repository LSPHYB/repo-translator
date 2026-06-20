/**
 * DashboardScreen — status cards, quick actions, live activity queue.
 *
 * Ported from ui_kits/desktop-app/DashboardScreen.jsx (window.DashboardScreen
 * global) — same layout/components/Chinese copy as the mockup, but wired to
 * real data:
 *   - The repo list (cards in "LIVE QUEUE") and the "跟踪仓库数" /
 *     "翻译文件数" stats come from `api.listRepos()` instead of the mockup's
 *     hardcoded `RepoCard` rows and `value={3}` / `value={24}` literals.
 *   - "全量同步" / "停止全部" call `api.syncAll()` / `api.cancelSyncAll()`.
 *     `syncAll()` resolves only once the backend's synchronous sync-all run
 *     finishes (see api.ts's `SyncAllResponse` — no separate "started"
 *     event), so the in-progress visual state here is a simple local
 *     `syncing` boolean set true right before the call and cleared in a
 *     `finally` after it settles, plus a `listRepos()` re-fetch on
 *     completion so the queue reflects the new `last_sync`/`file_count`
 *     values. This intentionally does not poll mid-run or hook into the
 *     `/logs` WebSocket (that live-progress wiring is Task 8's scope) — the
 *     per-card `syncing`/`progress`/`currentFile` props that the mockup used
 *     for a fake animated progress bar have no real backend source today,
 *     so every card is rendered in its plain (non-syncing) state and the
 *     only in-progress feedback is the header quick-actions card (spinner +
 *     disabled buttons).
 *   - The mockup's fake "API 延迟 120ms" header stat and "平均延迟"
 *     StatCard are DROPPED per the plan's explicit default: there is no
 *     real backend source for a translator-call latency metric.
 *     `/health`'s round-trip time was considered instead, but it measures
 *     this frontend's loopback HTTP call to the local sidecar (sub-ms,
 *     dominated by JS event-loop/fetch overhead), not anything resembling
 *     translator API latency, so displaying it as "延迟" would itself be a
 *     misleading invented metric — worse than just removing the stat.
 *   - "本月消耗 Token" has no backend source either (no token-usage
 *     endpoint exists yet — that's Task 6/Usage's scope) and is dropped for
 *     the same reason, leaving two real StatCards (tracked repos, file
 *     count) instead of the mockup's four.
 */
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api';
import type { RepoListItem } from '../api';
import PageHeader from '../components/PageHeader';
import { StatCard, Card, Button, RepoCard, StatusDot, Spinner } from '../design-system';

function Ic(d: React.ReactNode) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}
const folderIcon = Ic(<path d="M3 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />);
const fileIcon = Ic(
  <>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
  </>,
);
const playIcon = Ic(<polygon points="6 4 20 12 6 20 6 4" />);
const stopIcon = Ic(<rect x="6" y="6" width="12" height="12" rx="2" />);

function PageHeaderStatus() {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 38,
        padding: '0 14px',
        borderRadius: 11,
        background: 'var(--status-ok-bg)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <StatusDot tone="ok" pulse />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-ok)' }}>运行中</span>
    </div>
  );
}

export default function DashboardScreen() {
  const [repos, setRepos] = useState<RepoListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadRepos = useCallback(async () => {
    try {
      const result = await api.listRepos();
      setRepos(result);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  async function handleSyncAll() {
    setSyncing(true);
    try {
      await api.syncAll();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
      // Sync-all has finished (succeeded, failed, or was cancelled) by the
      // time the request above resolves -- re-fetch so last_sync/file_count
      // reflect the run that just happened.
      await loadRepos();
    }
  }

  async function handleCancelAll() {
    try {
      await api.cancelSyncAll();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }

  const fileCount = repos.reduce((sum, r) => sum + r.file_count, 0);

  return (
    <div>
      <PageHeader
        eyebrow="SYNC STATUS · 同步状态"
        title="仪表盘"
        desc={`跟踪 ${repos.length} 个仓库，引擎运行中`}
        actions={<PageHeaderStatus />}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 22 }}>
        <StatCard label="跟踪仓库数" value={repos.length} unit="个" icon={folderIcon} />
        <StatCard label="翻译文件数" value={fileCount} unit="个" icon={fileIcon} />
      </div>

      <Card style={{ marginBottom: 22 }} padding={18}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>快速开始</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>对所有跟踪仓库执行一次增量同步，或停止全部任务。</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="primary" icon={syncing ? <Spinner size={16} /> : playIcon} disabled={syncing} onClick={handleSyncAll}>
              {syncing ? '同步中…' : '全量同步'}
            </Button>
            <Button variant="secondary" icon={stopIcon} disabled={!syncing} onClick={handleCancelAll}>
              停止全部
            </Button>
          </div>
        </div>
      </Card>

      <div className="rt-eyebrow" style={{ marginBottom: 12 }}>LIVE QUEUE · 实时活动监控</div>
      {loadError && (
        <Card style={{ marginBottom: 14 }} padding={16}>
          <span style={{ fontSize: 13, color: 'var(--status-error)' }}>加载仓库列表失败：{loadError}</span>
        </Card>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {repos.length === 0 && !loadError && (
          <Card padding={18}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>暂无跟踪仓库。前往「仓库管理」添加一个。</span>
          </Card>
        )}
        {repos.map((repo) => (
          <RepoCard
            key={repo.name}
            name={repo.name}
            kind={repo.kind}
            branch={repo.branch ?? undefined}
            lastSync={repo.last_sync ?? '从未同步'}
            files={repo.file_count}
          />
        ))}
      </div>
    </div>
  );
}
