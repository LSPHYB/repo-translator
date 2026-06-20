/* global React */
// UsageScreen — Token consumption statistics: monthly summary, daily trend
// bar chart, per-engine split, and per-repo breakdown with cost estimates.
function UsageScreen({ ds }) {
  const { StatCard, Card, Badge, ProgressBar, Select } = ds;
  const [range, setRange] = React.useState('30d');

  const Ic = (d) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
  const zap = Ic(<path d="M13 2L3 14h7l-1 8 10-12h-7z"/>);
  const coin = Ic(<><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a2.5 2.5 0 00-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 1.8 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2a2.5 2.5 0 01-2.5-1.5M12 6v1.5M12 16.5V18"/></>);
  const file = Ic(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></>);
  const calc = Ic(<><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/></>);

  // Mock daily token usage (in thousands of tokens) for the trend chart.
  const daily = [42, 58, 31, 0, 12, 88, 76, 64, 95, 120, 47, 33, 28, 61, 84, 102, 58, 0, 19, 73, 91, 110, 67, 52, 44, 80, 96, 71, 38, 63];
  const maxDay = Math.max(...daily);

  const engines = [
    { name: 'DeepSeek', tone: 'accent', tokens: '0.82M', pct: 68, cost: '$0.08' },
    { name: 'Claude', tone: 'success', tokens: '0.28M', pct: 23, cost: '$0.05' },
    { name: 'OpenAI', tone: 'warning', tokens: '0.10M', pct: 9, cost: '$0.02' },
  ];

  const repos = [
    { name: 'langchain', files: 23, tokens: '0.64M', pct: 53, cost: '$0.07' },
    { name: 'fastapi-docs', files: 12, tokens: '0.31M', pct: 26, cost: '$0.04' },
    { name: 'my-project', files: 5, tokens: '0.25M', pct: 21, cost: '$0.04' },
  ];

  return (
    <div>
      <window.PageHeader
        eyebrow="TOKEN USAGE · 用量统计"
        title="用量统计"
        desc="按引擎与仓库追踪 Token 消耗与成本估算。"
        actions={
          <div style={{ width: 150 }}>
            <Select value={range} onChange={setRange} fullWidth options={[
              { value: '7d', label: '近 7 天' },
              { value: '30d', label: '近 30 天' },
              { value: 'all', label: '全部' },
            ]} />
          </div>
        }
      />

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 22 }}>
        <StatCard label="本月消耗 Token" value="1.2M" sub="较上月 +18%" delta={18} accent icon={zap} />
        <StatCard label="本月成本估算" value="$0.15" sub="约 ¥1.08" icon={coin} />
        <StatCard label="已翻译文件" value={40} unit="个" sub="平均 30K Token/文件" icon={file} />
        <StatCard label="单文件均价" value="$0.004" sub="≈ ¥0.027" icon={calc} />
      </div>

      {/* Daily trend bar chart */}
      <Card padding={20} style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>每日 Token 消耗</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>单位：千 Token (K)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
          {daily.map((v, i) => (
            <div key={i} title={`第 ${i + 1} 天 · ${v}K`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{
                height: `${Math.max(2, (v / maxDay) * 100)}%`,
                borderRadius: '4px 4px 2px 2px',
                background: v === maxDay ? 'var(--gradient-brand)' : v === 0 ? 'var(--border-subtle)' : 'var(--accent-soft)',
                border: v === maxDay ? 'none' : '1px solid var(--border-subtle)',
                boxShadow: v === maxDay ? '0 0 16px -2px var(--accent-ring)' : 'none',
                transition: 'height var(--dur-base) var(--ease-out)',
              }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          <span>30 天前</span><span>峰值 {maxDay}K · 第 10 天</span><span>今天</span>
        </div>
      </Card>

      {/* Engine split + repo breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, alignItems: 'start' }}>
        <Card padding={20}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>按引擎</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {engines.map((e) => (
              <div key={e.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Badge tone={e.tone} dot size="sm">{e.name}</Badge>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)' }}>{e.tokens} · {e.cost}</span>
                </div>
                <ProgressBar value={e.pct} tone={e.tone === 'accent' ? 'brand' : e.tone === 'success' ? 'success' : 'warning'} height={6} />
              </div>
            ))}
          </div>
        </Card>

        <Card variant="solid" padding={0}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 1fr 0.8fr', padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            <span>仓库</span><span style={{ textAlign: 'right' }}>文件</span><span style={{ textAlign: 'right' }}>Token</span><span style={{ textAlign: 'right' }}>成本</span>
          </div>
          {repos.map((r, i) => (
            <div key={r.name} style={{ padding: '12px 18px', borderBottom: i < repos.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 1fr 0.8fr', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{r.name}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)' }}>{r.files}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-primary)' }}>{r.tokens}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--accent)' }}>{r.cost}</span>
              </div>
              <div style={{ marginTop: 9 }}><ProgressBar value={r.pct} height={4} /></div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 1fr 0.8fr', padding: '12px 18px', alignItems: 'center', background: 'var(--surface-sunken)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>合计</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-secondary)' }}>40</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-primary)' }}>1.2M</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>$0.15</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
window.UsageScreen = UsageScreen;
