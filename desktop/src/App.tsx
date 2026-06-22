/**
 * App — top-level shell: owns `page`/`theme`/`logsOpen` state exactly as the
 * mockup's inline `App` function did (ui_kits/desktop-app/index.html's
 * `<script type="text/babel">` block). Renders AppShell with the active
 * screen as children and the console drawer as `consoleNode`.
 *
 * All six screens (Dashboard / Repos / Glossary / Usage / Settings /
 * Console) are wired to real `api.ts` calls as of Task 9 (Usage was the
 * last screen still on `PlaceholderScreen`).
 *
 * Startup gate (Task 11): before rendering any screen, resolve the sidecar's
 * port (`initBackendPort()`, a no-op outside Tauri) and poll `GET /health`
 * until both `config_loaded` and `cache_loaded` are true. This guards
 * against a race where the frontend renders and fires API calls before the
 * Python sidecar has finished loading `config.yaml`/`cache.json` (or, in the
 * packaged app, before the sidecar process has even started listening).
 * Shows a minimal loading state while waiting and a plain error state if
 * the sidecar fails to start or `/health` never reports both flags true
 * within the timeout.
 */
import { useEffect, useState } from 'react';
import AppShell, { type PageId } from './components/AppShell';
import DashboardScreen from './screens/DashboardScreen';
import ReposScreen from './screens/ReposScreen';
import GlossaryScreen from './screens/GlossaryScreen';
import UsageScreen from './screens/UsageScreen';
import SettingsScreen from './screens/SettingsScreen';
import ConsoleScreen, { ConsoleDrawer } from './screens/ConsoleScreen';
import { health, initBackendPort } from './api';

export type Theme = 'light' | 'dark';

const HEALTH_POLL_INTERVAL_MS = 250;
const HEALTH_POLL_TIMEOUT_MS = 15_000;

type StartupState =
  | { phase: 'loading' }
  | { phase: 'ready' }
  | { phase: 'error'; message: string };

function StartupGate({ state }: { state: StartupState }) {
  const isError = state.phase === 'error';
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        background: 'var(--bg-base)',
        color: isError ? '#F87171' : 'var(--text-secondary)',
        fontFamily: 'var(--font-sans, sans-serif)',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div>{isError ? 'Backend failed to start' : 'Starting backend…'}</div>
      {isError && (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 480 }}>
          {state.message}
        </div>
      )}
    </div>
  );
}

function App() {
  const [page, setPage] = useState<PageId>('dashboard');
  const [theme, setTheme] = useState<Theme>('dark');
  const [logsOpen, setLogsOpen] = useState(false);
  const [startup, setStartup] = useState<StartupState>({ phase: 'loading' });

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : '';
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    async function waitForBackend() {
      try {
        await initBackendPort();
      } catch (err) {
        if (!cancelled) {
          setStartup({
            phase: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }

      const deadline = Date.now() + HEALTH_POLL_TIMEOUT_MS;
      while (!cancelled) {
        try {
          const result = await health();
          if (result.config_loaded && result.cache_loaded) {
            if (!cancelled) setStartup({ phase: 'ready' });
            return;
          }
        } catch {
          // Sidecar not accepting connections yet -- keep polling until
          // the timeout below.
        }
        if (Date.now() > deadline) {
          if (!cancelled) {
            setStartup({
              phase: 'error',
              message:
                'Backend did not finish loading config/cache before timing out.',
            });
          }
          return;
        }
        await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
      }
    }

    waitForBackend();
    return () => {
      cancelled = true;
    };
  }, []);

  if (startup.phase !== 'ready') {
    return <StartupGate state={startup} />;
  }

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
