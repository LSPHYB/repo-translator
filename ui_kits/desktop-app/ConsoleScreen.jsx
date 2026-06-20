/* global React */
// ConsoleScreen / ConsoleDrawer — terminal-style log stream with level filters.
const RT_LOGS = [
  { t: '10:30:01', l: 'INFO', m: 'git pull langchain → a3f2c1d8e4b7f6a2' },
  { t: '10:30:02', l: 'INFO', m: 'markdown-it: parsed 5 blocks (3 text, 2 code)' },
  { t: '10:30:02', l: 'INFO', m: 'translate docs/intro.md (1/5) ...' },
  { t: '10:30:04', l: 'DONE', m: 'wrote output/langchain/intro_zh.md' },
  { t: '10:30:04', l: 'INFO', m: 'translate docs/guide.md (2/5) ...' },
  { t: '10:30:05', l: 'WARN', m: '429 rate-limited, backoff 2s' },
  { t: '10:30:07', l: 'INFO', m: 'retry docs/guide.md (2/5) ...' },
  { t: '10:30:09', l: 'ERROR', m: 'timeout on docs/api/reference.md, skipped' },
  { t: '10:30:10', l: 'DONE', m: 'wrote output/langchain/guide_zh.md' },
  { t: '10:30:11', l: 'INFO', m: 'cache hit README.md (blob unchanged)' },
];

function LogStream({ ds, filters, height }) {
  const { ConsoleLine } = ds;
  const ref = React.useRef(null);
  const rows = RT_LOGS.filter(r => filters[r.l] !== false && !(r.l === 'DONE' && filters.INFO === false));
  React.useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [filters]);
  return (
    <div ref={ref} style={{ background: 'var(--console-bg)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: '14px 16px', height, overflow: 'auto' }}>
      {rows.map((r, i) => <ConsoleLine key={i} time={r.t} level={r.l}>{r.m}</ConsoleLine>)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--console-dim)' }}>
        <span style={{ color: 'var(--console-ok)' }}>$</span>
        <span style={{ width: 8, height: 15, background: 'var(--console-ok)', animation: 'rt-blink 1s step-end infinite' }} />
      </div>
      <style>{'@keyframes rt-blink{50%{opacity:0}}'}</style>
    </div>
  );
}

function FilterBar({ filters, onToggle, ds }) {
  const { Badge } = ds;
  const levels = [['INFO', 'accent'], ['WARN', 'warning'], ['ERROR', 'error']];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>级别过滤</span>
      {levels.map(([lvl, tone]) => {
        const on = filters[lvl] !== false;
        return (
          <button key={lvl} onClick={() => onToggle(lvl)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, opacity: on ? 1 : 0.4 }}>
            <Badge tone={tone} dot size="sm">{lvl}</Badge>
          </button>
        );
      })}
    </div>
  );
}

// Full-screen variant (Logs nav page)
function ConsoleScreen({ ds }) {
  const { Button } = ds;
  const [filters, setFilters] = React.useState({});
  const toggle = (l) => setFilters(f => ({ ...f, [l]: f[l] === false ? true : false }));
  return (
    <div>
      <window.PageHeader
        eyebrow="DEBUG CONSOLE · 交互式调试台"
        title="调试台"
        desc="实时流式显示 Python 后台的执行过程。"
        actions={<FilterBar filters={filters} onToggle={toggle} ds={ds} />}
      />
      <LogStream ds={ds} filters={filters} height="calc(100vh - 290px)" />
    </div>
  );
}

// Bottom drawer variant (toggled from StatusBar)
function ConsoleDrawer({ ds }) {
  const [filters, setFilters] = React.useState({});
  const toggle = (l) => setFilters(f => ({ ...f, [l]: f[l] === false ? true : false }));
  return (
    <div style={{ borderTop: '1px solid var(--border-default)', background: 'var(--surface-sunken)', padding: '12px 16px', animation: 'rt-drawer var(--dur-base) var(--ease-out)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>实时日志面板</span>
        <FilterBar filters={filters} onToggle={toggle} ds={ds} />
      </div>
      <LogStream ds={ds} filters={filters} height={180} />
      <style>{'@keyframes rt-drawer{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'}</style>
    </div>
  );
}

window.ConsoleScreen = ConsoleScreen;
window.ConsoleDrawer = ConsoleDrawer;
