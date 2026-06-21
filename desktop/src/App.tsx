/**
 * App — top-level shell: owns `page`/`theme`/`logsOpen` state exactly as the
 * mockup's inline `App` function did (ui_kits/desktop-app/index.html's
 * `<script type="text/babel">` block). Renders AppShell with the active
 * screen as children and the console drawer as `consoleNode`.
 *
 * All six screens (Dashboard / Repos / Glossary / Usage / Settings /
 * Console) are wired to real `api.ts` calls as of Task 9 (Usage was the
 * last screen still on `PlaceholderScreen`).
 */
import { useEffect, useState } from 'react';
import AppShell, { type PageId } from './components/AppShell';
import DashboardScreen from './screens/DashboardScreen';
import ReposScreen from './screens/ReposScreen';
import GlossaryScreen from './screens/GlossaryScreen';
import UsageScreen from './screens/UsageScreen';
import SettingsScreen from './screens/SettingsScreen';
import ConsoleScreen, { ConsoleDrawer } from './screens/ConsoleScreen';

export type Theme = 'light' | 'dark';

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
    usage: <UsageScreen />,
    settings: <SettingsScreen />,
    logs: <ConsoleScreen />,
  };

  return (
    <AppShell
      page={page}
      onNav={setPage}
      theme={theme}
      onTheme={setTheme}
      logsOpen={logsOpen}
      onToggleLogs={() => setLogsOpen((o) => !o)}
      consoleNode={<ConsoleDrawer />}
    >
      {screens[page]}
    </AppShell>
  );
}

export default App;
