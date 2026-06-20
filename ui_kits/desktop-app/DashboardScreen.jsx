/* global React */
// DashboardScreen — status cards, quick actions, live activity queue.
function DashboardScreen({ ds }) {
  const { StatCard, Card, Button, RepoCard, StatusDot } = ds;
  const Ic = (d) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
  const folder = Ic(<path d="M3 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>);
  const file = Ic(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></>);
  const zap = Ic(<path d="M13 2L3 14h7l-1 8 10-12h-7z"/>);
  const play = Ic(<polygon points="6 4 20 12 6 20 6 4"/>);
  const stop = Ic(<rect x="6" y="6" width="12" height="12" rx="2"/>);

  return (
    <div>
      <window.PageHeader
        eyebrow="SYNC STATUS · 同步状态"
        title="仪表盘"
        desc="跟踪 3 个仓库，引擎运行中 · API 延迟 120ms"
        actions={<>
          <window.PageHeaderStatus ds={ds} />
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 22 }}>
        <StatCard label="跟踪仓库数" value={3} unit="个" icon={folder} />
        <StatCard label="翻译文件数" value={24} unit="个" sub="本月新增 6" delta={6} icon={file} />
        <StatCard label="本月消耗 Token" value="1.2M" sub="约 $0.15" accent icon={zap} />
        <StatCard label="平均延迟" value="120" unit="ms" sub="DeepSeek · 健康" />
      </div>

      <Card style={{ marginBottom: 22 }} padding={18}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>快速开始</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>对所有跟踪仓库执行一次增量同步，或停止全部任务。</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="primary" icon={play}>全量同步</Button>
            <Button variant="secondary" icon={stop}>停止全部</Button>
          </div>
        </div>
      </Card>

      <div className="rt-eyebrow" style={{ marginBottom: 12 }}>LIVE QUEUE · 实时活动监控</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <RepoCard name="langchain" kind="managed" branch="main" lastSync="2分钟前" files={23} syncing progress={40} currentFile="docs/guide.md (2/5)" />
        <RepoCard name="fastapi-docs" kind="managed" branch="master" lastSync="刚刚" files={12} syncing progress={78} currentFile="advanced/security.md (7/9)" />
        <RepoCard name="my-project" kind="external" lastSync="1小时前" files={5} justFinished onOpenDir={() => {}} onViewDocs={() => {}} />
      </div>
    </div>
  );
}

function PageHeaderStatus({ ds }) {
  const { StatusDot } = ds;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px', borderRadius: 11, background: 'var(--status-ok-bg)', border: '1px solid var(--border-subtle)' }}>
      <StatusDot tone="ok" pulse />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-ok)' }}>运行中</span>
    </div>
  );
}

window.DashboardScreen = DashboardScreen;
window.PageHeaderStatus = PageHeaderStatus;
