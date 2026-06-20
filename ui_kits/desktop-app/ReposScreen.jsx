/* global React */
// ReposScreen — repo list + a selected repo's file tree, plus add-repo modal.
function ReposScreen({ ds }) {
  const { RepoCard, Button, Card, Tabs, Badge, StatusDot, Input, Select } = ds;
  const [selected, setSelected] = React.useState('langchain');
  const [tab, setTab] = React.useState('all');
  const [adding, setAdding] = React.useState(false);
  const [kind, setKind] = React.useState('managed');
  const [toast, setToast] = React.useState(null);

  const tRef = React.useRef(null);
  function notify(msg) {
    setToast(msg);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(null), 2600);
  }
  function repoActions(repo) {
    return {
      onSync: () => notify('开始同步 ' + repo + ' …'),
      onOpenDir: () => notify('在文件管理器中打开 ~/.repo-translator/output/' + repo + '/'),
      onViewDocs: () => notify('打开 ' + repo + ' 的译文（*_zh.md）'),
      onConfigure: () => notify('配置 ' + repo + ' 的排除规则'),
      onRemove: () => notify('已将 ' + repo + ' 移出跟踪'),
    };
  }

  const Ic = (d) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
  const plus = Ic(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>);

  const files = [
    { p: 'README.md', s: 'done' },
    { p: 'docs/intro.md', s: 'done' },
    { p: 'docs/guide.md', s: 'pending' },
    { p: 'docs/api/reference.md', s: 'pending' },
    { p: 'CHANGELOG.md', s: 'excluded' },
    { p: 'examples/quickstart.md', s: 'done' },
  ];
  const filtered = tab === 'all' ? files : files.filter(f => (tab === 'pending' ? f.s === 'pending' : f.s === 'excluded'));
  const tone = { done: 'success', pending: 'warning', excluded: 'neutral' };
  const fileLabel = { done: '已翻译', pending: '待同步', excluded: '已排除' };

  return (
    <div>
      <window.PageHeader
        eyebrow="REPOSITORIES · 仓库管理"
        title="仓库管理"
        desc="跟踪 3 个仓库 · 2 个 Managed，1 个 External"
        actions={<Button variant="primary" icon={plus} onClick={() => setAdding(true)}>添加仓库</Button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div onClick={() => setSelected('langchain')} style={{ cursor: 'pointer' }}>
            <RepoCard name="langchain" kind="managed" branch="main" lastSync="2分钟前" files={23} justFinished {...repoActions('langchain')} style={selected === 'langchain' ? { outline: '2px solid var(--accent)', outlineOffset: 2 } : {}} />
          </div>
          <div onClick={() => setSelected('fastapi-docs')} style={{ cursor: 'pointer' }}>
            <RepoCard name="fastapi-docs" kind="managed" branch="master" lastSync="刚刚" files={12} {...repoActions('fastapi-docs')} style={selected === 'fastapi-docs' ? { outline: '2px solid var(--accent)', outlineOffset: 2 } : {}} />
          </div>
          <div onClick={() => setSelected('my-project')} style={{ cursor: 'pointer' }}>
            <RepoCard name="my-project" kind="external" lastSync="1小时前" files={5} {...repoActions('my-project')} style={selected === 'my-project' ? { outline: '2px solid var(--accent)', outlineOffset: 2 } : {}} />
          </div>
        </div>

        <Card variant="solid" padding={0}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{selected}</span>
              <Badge tone="accent" size="sm">{selected === 'my-project' ? 'external' : 'managed'}</Badge>
            </div>
            <div style={{ marginTop: 12 }}>
              <Tabs active={tab} onSelect={setTab} tabs={[{ id: 'all', label: '全部', count: files.length }, { id: 'pending', label: '待同步', count: 2 }, { id: 'excluded', label: '已排除', count: 1 }]} />
            </div>
          </div>
          <div style={{ padding: 8 }}>
            {filtered.map((f) => (
              <div key={f.p} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 9 }}>
                <StatusDot tone={f.s === 'done' ? 'ok' : f.s === 'pending' ? 'warn' : 'muted'} />
                <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: f.s === 'excluded' ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{f.p}</span>
                <Badge tone={tone[f.s]} size="sm">{fileLabel[f.s]}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {adding && (
        <window.Modal title="添加仓库" onClose={() => setAdding(false)} ds={ds}
          footer={<>
            <Button variant="ghost" onClick={() => setAdding(false)}>取消</Button>
            <Button variant="primary" onClick={() => setAdding(false)}>添加并同步</Button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['managed', 'Managed (Git URL)'], ['external', 'External (本地目录)']].map(([id, lbl]) => (
                <button key={id} onClick={() => setKind(id)} style={{
                  flex: 1, padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  background: kind === id ? 'var(--accent-soft)' : 'var(--surface-sunken)',
                  border: `1px solid ${kind === id ? 'var(--accent)' : 'var(--border-default)'}`,
                  color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, border: `5px solid ${kind === id ? 'var(--accent)' : 'var(--border-strong)'}`, background: 'var(--bg-elevated)', boxSizing: 'border-box' }} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{lbl}</span>
                  </div>
                </button>
              ))}
            </div>
            {kind === 'managed'
              ? <Input label="仓库 URL" mono placeholder="https://github.com/org/repo.git" />
              : <Input label="本地目录" mono placeholder="/Users/me/code/my-project" suffix="浏览…" hint="支持拖拽文件夹到此处" />}
            <Input label="输出目录" mono placeholder="~/.repo-translator/output/" suffix="浏览…" hint="译文写入位置，默认在缓存目录下按仓库名镜像；可指定到仓库内或自定义路径。" />
            <Select label="目标语言" value="zh" onChange={() => {}} options={[{ value: 'zh', label: '简体中文 (zh)' }, { value: 'zh-tw', label: '繁體中文 (zh-tw)' }]} />
          </div>
        </window.Modal>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 52, left: '50%', transform: 'translateX(-50%)',
          zIndex: 'var(--z-toast)', display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 16px', borderRadius: 12, maxWidth: '70vw',
          background: 'var(--surface-raised)', border: '1px solid var(--border-default)',
          backdropFilter: 'var(--blur-strong)', WebkitBackdropFilter: 'var(--blur-strong)',
          boxShadow: 'var(--shadow-lg)', animation: 'rt-toast var(--dur-base) var(--ease-out)',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--status-ok)', boxShadow: '0 0 8px -1px var(--status-ok)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{toast}</span>
          <style>{'@keyframes rt-toast{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}'}</style>
        </div>
      )}
    </div>
  );
}
window.ReposScreen = ReposScreen;
