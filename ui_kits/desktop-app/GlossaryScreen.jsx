/* global React */
// GlossaryScreen — editable term table + exclude-pattern tag input.
function GlossaryScreen({ ds }) {
  const { Card, Button, TagInput, Badge, Input } = ds;
  const [terms, setTerms] = React.useState([
    { en: 'repository', zh: '仓库' },
    { en: 'commit', zh: '提交' },
    { en: 'pull request', zh: '拉取请求' },
    { en: 'token', zh: 'Token' },
    { en: 'embedding', zh: '向量嵌入' },
  ]);
  const [excludes, setExcludes] = React.useState(['CHANGELOG.md', 'LICENSE.md', '**/node_modules/**']);
  const [editing, setEditing] = React.useState(null);

  const Ic = (d) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
  const plus = Ic(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>);
  const imp = Ic(<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>);

  return (
    <div>
      <window.PageHeader
        eyebrow="GLOSSARY & RULES · 术语表与规则"
        title="术语表"
        desc="统一翻译用词，双击单元格即可编辑。"
        actions={<>
          <Button variant="secondary" icon={imp}>导入 CSV</Button>
          <Button variant="primary" icon={plus} onClick={() => setTerms([{ en: '', zh: '' }, ...terms])}>新增术语</Button>
        </>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card variant="solid" padding={0}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px', padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            <span>原文 (EN)</span><span>译文 (ZH)</span><span style={{ textAlign: 'right' }}>操作</span>
          </div>
          {terms.map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px', padding: '11px 16px', borderBottom: i < terms.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center' }}>
              <Cell value={t.en} mono editing={editing === `${i}-en`} onEdit={() => setEditing(`${i}-en`)} onCommit={(v) => { const n = [...terms]; n[i] = { ...n[i], en: v }; setTerms(n); setEditing(null); }} placeholder="english term" />
              <Cell value={t.zh} editing={editing === `${i}-zh`} onEdit={() => setEditing(`${i}-zh`)} onCommit={(v) => { const n = [...terms]; n[i] = { ...n[i], zh: v }; setTerms(n); setEditing(null); }} placeholder="中文译法" />
              <div style={{ textAlign: 'right' }}>
                <button onClick={() => setTerms(terms.filter((_, idx) => idx !== i))} aria-label="删除" style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </Card>

        <Card padding={18}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>排除模式</div>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>匹配的文件不会被翻译。支持 glob 规则。</p>
          <TagInput tags={excludes} onChange={setExcludes} />
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge tone="neutral" size="sm">{excludes.length} 条规则</Badge>
            <Badge tone="accent" size="sm">已生效</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Cell({ value, mono, editing, onEdit, onCommit, placeholder }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value, editing]);
  if (editing) {
    return (
      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)} onKeyDown={(e) => { if (e.key === 'Enter') onCommit(draft); }}
        placeholder={placeholder}
        style={{ width: '90%', height: 30, padding: '0 8px', borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--surface-sunken)', outline: 'none', color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: 13 }} />
    );
  }
  return (
    <span onDoubleClick={onEdit} title="双击编辑" style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: 13.5, color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: 'text' }}>
      {value || placeholder}
    </span>
  );
}
window.GlossaryScreen = GlossaryScreen;
