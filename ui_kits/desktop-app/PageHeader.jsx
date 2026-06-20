/* global React */
// PageHeader — shared section title + optional eyebrow + actions row.
function PageHeader({ eyebrow, title, desc, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
      <div>
        {eyebrow && <div className="rt-eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{title}</h1>
        {desc && <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>{desc}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
window.PageHeader = PageHeader;
