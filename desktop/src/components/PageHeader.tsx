/**
 * PageHeader — shared section title + optional eyebrow + actions row.
 * Used at the top of every screen (Dashboard, Repos, Glossary, Settings,
 * Console/debug).
 *
 * Ported from ui_kits/desktop-app/PageHeader.jsx (window.PageHeader global) —
 * markup and behavior unchanged, switched to a typed default export.
 */
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** Small uppercase label above the title, e.g. "SYNC STATUS · 同步状态". */
  eyebrow?: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  /** Right-aligned action row (buttons, status pills, a select, etc). */
  actions?: ReactNode;
}

export default function PageHeader({ eyebrow, title, desc, actions }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
      <div>
        {eyebrow && (
          <div className="rt-eyebrow" style={{ marginBottom: 8 }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {desc && <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>{desc}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
