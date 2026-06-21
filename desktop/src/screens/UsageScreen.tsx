/**
 * UsageScreen — token consumption statistics: monthly summary, daily trend
 * bar chart, per-engine split, and per-repo breakdown with cost estimates.
 *
 * Ported from ui_kits/desktop-app/UsageScreen.jsx (window.UsageScreen
 * global) -- same layout/components/Chinese copy as the mockup, but wired
 * to real data via `GET /usage` (see api.ts's `getUsage()`), following the
 * loading/error-state conventions established by GlossaryScreen.tsx /
 * SettingsScreen.tsx.
 *
 * Backend does all aggregation (repo_translator/usage_manager.py +
 * api_server.py's `get_usage()`), so this screen stays dumb: the 4
 * `StatCard`s map to `totals` (the per-file average is the one client-side
 * computation, derived from `totals.cost_usd / totals.files`), the bar
 * chart to `daily`, the engine list to `by_engine`, and the repo table to
 * `by_repo`.
 *
 * Dropped from the mockup (no real backend signal to back it):
 * - The `7d`/`30d`/`全部` range `Select` -- the backend always returns a
 *   fixed last-30-day window plus all-time totals/breakdowns; a selector
 *   that doesn't actually change anything would be misleading (same
 *   "drop rather than fake" precedent as Task 7's dropped "测试连接"
 *   button / "开启自动同步" switch).
 */
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api';
import type { UsageResponse } from '../api';
import PageHeader from '../components/PageHeader';
import { StatCard, Card, Badge, ProgressBar } from '../design-system';

function Ic(d: React.ReactNode) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}
const zapIcon = Ic(<path d="M13 2L3 14h7l-1 8 10-12h-7z" />);
const coinIcon = Ic(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M14.5 9.5a2.5 2.5 0 00-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 1.8 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2a2.5 2.5 0 01-2.5-1.5M12 6v1.5M12 16.5V18" />
  </>,
);
const fileIcon = Ic(
  <>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
  </>,
);
const calcIcon = Ic(
  <>
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="8" y2="10" />
    <line x1="12" y1="10" x2="12" y2="10" />
    <line x1="16" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="8" y2="14" />
    <line x1="12" y1="14" x2="12" y2="14" />
  </>,
);

const ENGINE_TONE: Record<string, 'accent' | 'success' | 'warning'> = {
  deepseek: 'accent',
  claude: 'success',
  openai: 'warning',
};

function engineTone(engine: string): 'accent' | 'success' | 'warning' {
  return ENGINE_TONE[engine] ?? 'accent';
}

function engineProgressTone(engine: string): 'brand' | 'success' | 'warning' {
  const tone = engineTone(engine);
  return tone === 'accent' ? 'brand' : tone;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatUsd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

export default function UsageScreen() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.getUsage();
      setUsage(result);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = usage?.totals ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost_usd: 0, files: 0 };
  const daily = usage?.daily ?? [];
  const byEngine = usage?.by_engine ?? [];
  const byRepo = usage?.by_repo ?? [];

  const maxDay = Math.max(1, ...daily.map((d) => d.total_tokens));
  const peakIndex = daily.reduce((best, d, i) => (d.total_tokens > daily[best].total_tokens ? i : best), 0);
  const perFileCost = totals.files > 0 ? totals.cost_usd / totals.files : 0;

  const maxEngineTokens = Math.max(1, ...byEngine.map((e) => e.total_tokens));
  const maxRepoTokens = Math.max(1, ...byRepo.map((r) => r.total_tokens));

  return (
    <div>
      <PageHeader
        eyebrow="TOKEN USAGE · 用量统计"
        title="用量统计"
        desc="按引擎与仓库追踪 Token 消耗与成本估算。"
      />

      {loadError && (
        <Card style={{ marginBottom: 14 }} padding={16}>
          <span style={{ fontSize: 13, color: 'var(--status-error)' }}>加载用量数据失败：{loadError}</span>
        </Card>
      )}

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 22 }}>
        <StatCard label="本月消耗 Token" value={formatTokens(totals.total_tokens)} sub={`${totals.files} 个文件已翻译`} accent icon={zapIcon} />
        <StatCard label="本月成本估算" value={formatUsd(totals.cost_usd)} sub="近似值，非账单金额" icon={coinIcon} />
        <StatCard label="已翻译文件" value={totals.files} unit="个" sub={totals.files > 0 ? `平均 ${formatTokens(totals.total_tokens / totals.files)} Token/文件` : '暂无数据'} icon={fileIcon} />
        <StatCard label="单文件均价" value={formatUsd(perFileCost)} sub="基于近似定价表估算" icon={calcIcon} />
      </div>

      {/* Daily trend bar chart */}
      <Card padding={20} style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>每日 Token 消耗</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>近 30 天</span>
        </div>
        {daily.length === 0 ? (
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>暂无用量数据。</span>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
              {daily.map((d, i) => (
                <div key={d.date} title={`${d.date} · ${formatTokens(d.total_tokens)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                  <div
                    style={{
                      height: `${Math.max(2, (d.total_tokens / maxDay) * 100)}%`,
                      borderRadius: '4px 4px 2px 2px',
                      background: i === peakIndex && d.total_tokens > 0 ? 'var(--gradient-brand)' : d.total_tokens === 0 ? 'var(--border-subtle)' : 'var(--accent-soft)',
                      border: i === peakIndex && d.total_tokens > 0 ? 'none' : '1px solid var(--border-subtle)',
                      boxShadow: i === peakIndex && d.total_tokens > 0 ? '0 0 16px -2px var(--accent-ring)' : 'none',
                      transition: 'height var(--dur-base) var(--ease-out)',
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              <span>{daily[0].date}</span>
              <span>峰值 {formatTokens(daily[peakIndex].total_tokens)} · {daily[peakIndex].date}</span>
              <span>{daily[daily.length - 1].date}</span>
            </div>
          </>
        )}
      </Card>

      {/* Engine split + repo breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, alignItems: 'start' }}>
        <Card padding={20}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>按引擎</div>
          {byEngine.length === 0 ? (
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>暂无数据。</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {byEngine.map((e) => (
                <div key={e.engine}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Badge tone={engineTone(e.engine)} dot size="sm">{e.engine}</Badge>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)' }}>{formatTokens(e.total_tokens)} · {formatUsd(e.cost_usd)}</span>
                  </div>
                  <ProgressBar value={(e.total_tokens / maxEngineTokens) * 100} tone={engineProgressTone(e.engine)} height={6} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card variant="solid" padding={0}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 1fr 0.8fr', padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            <span>仓库</span><span style={{ textAlign: 'right' }}>文件</span><span style={{ textAlign: 'right' }}>Token</span><span style={{ textAlign: 'right' }}>成本</span>
          </div>
          {byRepo.length === 0 && (
            <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-secondary)' }}>暂无数据。</div>
          )}
          {byRepo.map((r, i) => (
            <div key={r.repo} style={{ padding: '12px 18px', borderBottom: i < byRepo.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 1fr 0.8fr', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{r.repo}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)' }}>{r.files}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-primary)' }}>{formatTokens(r.total_tokens)}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--accent)' }}>{formatUsd(r.cost_usd)}</span>
              </div>
              <div style={{ marginTop: 9 }}><ProgressBar value={(r.total_tokens / maxRepoTokens) * 100} height={4} /></div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 1fr 0.8fr', padding: '12px 18px', alignItems: 'center', background: 'var(--surface-sunken)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>合计</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)' }}>{totals.files}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-primary)' }}>{formatTokens(totals.total_tokens)}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{formatUsd(totals.cost_usd)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
