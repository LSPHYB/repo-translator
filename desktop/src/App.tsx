/**
 * App — top-level shell: owns `page`/`theme`/`logsOpen` state exactly as the
 * mockup's inline `App` function did (ui_kits/desktop-app/index.html's
 * `<script type="text/babel">` block). Renders AppShell with the active
 * screen as children and the console drawer as `consoleNode`.
 *
 * Screens are placeholders for now (Task 4-8 fill in Dashboard / Repos /
 * Glossary / Usage / Settings / Console with real content and `api.ts`
 * wiring) — this task only ports navigation, theme, and the console-drawer
 * toggle.
 */
import { useEffect, useState } from 'react';
import AppShell, { type PageId } from './components/AppShell';
import DashboardScreen from './screens/DashboardScreen';
import ReposScreen from './screens/ReposScreen';
import GlossaryScreen from './screens/GlossaryScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';
import ConsoleDrawerPlaceholder from './screens/ConsoleDrawerPlaceholder';

export type Theme = 'light' | 'dark';

const SCREEN_TITLES: Record<PageId, string> = {
  dashboard: '仪表盘',
  repos: '仓库管理',
  glossary: '术语表',
  usage: '用量统计',
  settings: '系统设置',
  logs: '调试台',
};

function App() {
  const [page, setPage] = useState<PageId>('dashboard');
  const [theme, setTheme] = useState<Theme>('dark');
  const [logsOpen, setLogsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : '';
  }, [theme]);

  const screens: Record<PageId, React.ReactNode> = {
    dashboard: <DashboardScreen />,
    repos: <ReposScreen />,
    glossary: <GlossaryScreen />,
    usage: <PlaceholderScreen title={SCREEN_TITLES.usage} />,
    settings: <PlaceholderScreen title={SCREEN_TITLES.settings} />,
    logs: <PlaceholderScreen title={SCREEN_TITLES.logs} />,
  };

  return (
    <AppShell
      page={page}
      onNav={setPage}
      theme={theme}
      onTheme={setTheme}
      logsOpen={logsOpen}
      onToggleLogs={() => setLogsOpen((o) => !o)}
      consoleNode={<ConsoleDrawerPlaceholder />}
    >
      {screens[page]}
    </AppShell>
  );
}

export default App;
