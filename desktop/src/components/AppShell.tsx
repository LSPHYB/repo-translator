/**
 * AppShell — composes TitleBar + NavRail + content + StatusBar + Console drawer.
 *
 * Ported from ui_kits/desktop-app/AppShell.jsx (window.AppShell global) —
 * markup and behavior unchanged: same nav items (ids/labels/icons/badge),
 * same layout, same theme-toggle wiring via NavRail's footer slot, same
 * `key={page}` page-transition trick, and the same inline `rt-page` keyframe
 * animation. Switched to a typed default export reading design-system
 * components from `../design-system` instead of the `window.RepoTranslatorDesignSystem_dab506`
 * global.
 */
import type { ReactNode } from 'react';
import { NavRail, StatusBar, ThemeToggle } from '../design-system';
import { useSyncContext } from '../SyncContext';
import type { Theme } from '../App';

export type PageId = 'dashboard' | 'repos' | 'glossary' | 'usage' | 'settings' | 'logs';

export interface AppShellProps {
  page: PageId;
  onNav: (page: PageId) => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  logsOpen: boolean;
  onToggleLogs: () => void;
  pages: Record<PageId, ReactNode>;
  consoleNode?: ReactNode;
}

function Ic(d: ReactNode) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}

const NAV_ITEMS: Array<{ id: PageId; label: string; icon: ReactNode; badge?: number }> = [
  {
    id: 'dashboard',
    label: '仪表盘',
    icon: Ic(
      <>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </>,
    ),
  },
  {
    id: 'repos',
    label: '仓库管理',
    icon: Ic(<path d="M3 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />),
  },
  {
    id: 'glossary',
    label: '术语表',
    icon: Ic(
      <>
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </>,
    ),
  },
  {
    id: 'usage',
    label: '用量统计',
    icon: Ic(
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>,
    ),
  },
  {
    id: 'settings',
    label: '系统设置',
    icon: Ic(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7.7 1.6 1.6 0 01-3.2 0 1.6 1.6 0 00-2.7-.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-.7-2.7 1.6 1.6 0 010-3.2 1.6 1.6 0 00.7-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-.7 1.6 1.6 0 013.2 0 1.6 1.6 0 002.7.7l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8z" />
      </>,
    ),
  },
  {
    id: 'logs',
    label: '调试台',
    icon: Ic(
      <>
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </>,
    ),
  },
];

export default function AppShell({ page, onNav, theme, onTheme, logsOpen, onToggleLogs, pages, consoleNode }: AppShellProps) {
  // The "仓库管理" nav badge reflects the live tracked-repo count from the
  // shared SyncContext (it used to be a hardcoded `3` from the mockup). Hidden
  // when zero so an empty install doesn't show a stale "0" chip.
  const { repos } = useSyncContext();
  const navItems = NAV_ITEMS.map((item) =>
    item.id === 'repos'
      ? { ...item, badge: repos.length > 0 ? repos.length : undefined }
      : item,
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        borderRadius: 0,
      }}
    >
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <NavRail
          items={navItems}
          active={page}
          onSelect={(id: string) => onNav(id as PageId)}
          footer={<ThemeToggle theme={theme} onChange={(t: string) => onTheme(t as Theme)} />}
        />
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            {(Object.entries(pages) as [PageId, ReactNode][]).map(([id, node]) => (
              <div
                key={id}
                className={id === page ? 'rt-page' : undefined}
                style={{
                  display: id === page ? undefined : 'none',
                  padding: 28,
                }}
              >
                {node}
              </div>
            ))}
          </div>
          {logsOpen && consoleNode}
        </main>
      </div>
      <StatusBar engine="DeepSeek" connected cache="正常" latency={120} logsOpen={logsOpen} onToggleLogs={onToggleLogs} />
      <style>
        {
          '@media (prefers-reduced-motion: no-preference){.rt-page{animation:rt-page var(--dur-base) var(--ease-out)}}@keyframes rt-page{from{opacity:.4;transform:translateY(6px)}to{opacity:1;transform:none}}'
        }
      </style>
    </div>
  );
}
