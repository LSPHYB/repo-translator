/**
 * SettingsScreen — translator engine config + sync/concurrency settings,
 * wired to `GET`/`PUT /config` (`AppConfig.translator` / `AppConfig.sync`).
 *
 * Ported from ui_kits/desktop-app/SettingsScreen.jsx (window.SettingsScreen
 * global), following the read-modify-write conventions established by
 * GlossaryScreen.tsx:
 *
 * - Loads the full `AppConfig` via `api.getConfig()` on mount; local state
 *   holds `revision` (the optimistic-concurrency token from Task 6) inside
 *   the held `config`.
 * - `persist(overrides)` spreads `{...config, ...overrides}` and saves the
 *   *entire* `AppConfig` via `api.putConfig()`, including `revision`.
 * - On a 409 (`ApiError` with `.status === 409`), discards the in-flight
 *   edit, re-fetches via `load()`, and shows the fixed message
 *   '配置已更新，请重新加载后重试' (same string Task 6 used) instead of
 *   relaying the server's text.
 *
 * API key handling (see api.ts's `TranslatorConfig.api_key`/`api_key_set`
 * and api_server.py's `_serialize_config`/`put_config`): GET never returns
 * the literal key, only whether one is set. Local `apiKeyDraft`/
 * `apiKeyTouched` state tracks whether the user actually typed a new value
 * in this session -- `api_key` is only included in the PUT body when
 * `apiKeyTouched` is true, so saving any other field never clears or
 * disturbs the stored key.
 *
 * Dropped from the mockup (no real backend signal/endpoint to back it):
 * - "测试连接" button -- the mockup fakes this with `setTimeout` +
 *   `Math.random()`; there is no backend connectivity-test endpoint, and a
 *   button that randomly claims success/failure would be actively
 *   misleading. Dropped entirely for v1 (explicit product decision, not a
 *   placeholder).
 * - "开启自动同步" switch -- `config.py` has no enable/disable flag for the
 *   background scheduler (the `watch`/background scheduler always runs
 *   per-repo on `sync.interval_hours`; there is no top-level on/off field
 *   anywhere in `AppConfig`/`SyncConfig`). Same treatment as GlossaryScreen's
 *   dropped "导入 CSV" button: omitted rather than faked.
 */
import { useCallback, useEffect, useState } from 'react';
import { check as checkForUpdate } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import * as api from '../api';
import { ApiError } from '../api';
import type { AppConfig } from '../api';
import PageHeader from '../components/PageHeader';
import { Card, Select, Input, Slider, Button } from '../design-system';

const STALE_REVISION_MESSAGE = '配置已更新，请重新加载后重试';

const ENGINE_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'claude', label: 'Claude' },
];

const BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com',
  claude: 'https://api.anthropic.com',
};

const MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat',
  claude: 'claude-3-5-sonnet',
};

export default function SettingsScreen() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [apiKeyTouched, setApiKeyTouched] = useState(false);

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  async function handleTestConnection() {
    setTestStatus('testing');
    setTestError('');
    try {
      const result = await api.testConnection();
      if (result.ok) {
        setTestStatus('ok');
      } else {
        setTestStatus('error');
        setTestError(result.error ?? '连接失败');
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : String(err));
    }
  }

  // Auto-update (Task 12): manual "检查更新" action only -- no on-startup
  // check, per the task's framing (avoids an extra blocking network call in
  // App.tsx's already-present sidecar-ready startup gate from Task 11).
  const [updateStatus, setUpdateStatus] = useState<
    | { phase: 'idle' }
    | { phase: 'checking' }
    | { phase: 'up-to-date' }
    | { phase: 'downloading'; version: string }
    | { phase: 'error'; message: string }
  >({ phase: 'idle' });

  async function handleCheckForUpdate() {
    setUpdateStatus({ phase: 'checking' });
    try {
      const update = await checkForUpdate();
      if (!update) {
        setUpdateStatus({ phase: 'up-to-date' });
        return;
      }
      setUpdateStatus({ phase: 'downloading', version: update.version });
      await update.downloadAndInstall();
      await relaunch();
    } catch (err) {
      setUpdateStatus({
        phase: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const load = useCallback(async () => {
    try {
      const cfg = await api.getConfig();
      setConfig(cfg);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Persists the full AppConfig (current `config` + the given overrides),
  // including the held `revision`. On success, adopts the server's response
  // (carrying the bumped revision) as the new baseline. On a 409 (some other
  // writer saved since we last fetched), discard our in-flight edit,
  // re-fetch the latest state, and surface a message -- never silently
  // retry with stale data.
  async function persist(overrides: Partial<Pick<AppConfig, 'translator' | 'sync'>>) {
    if (!config) return;
    const payload: AppConfig = { ...config, ...overrides };
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await api.putConfig(payload);
      setConfig(saved);
      setApiKeyTouched(false);
      setApiKeyDraft('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSaveError(STALE_REVISION_MESSAGE);
        await load();
      } else {
        setSaveError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSaving(false);
    }
  }

  function handleEngineChange(value: unknown) {
    if (!config) return;
    void persist({ translator: { ...config.translator, engine: String(value) } });
  }

  function handleModelChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!config) return;
    void persist({ translator: { ...config.translator, model: e.target.value } });
  }

  function handleBaseUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!config) return;
    void persist({ translator: { ...config.translator, base_url: e.target.value } });
  }

  function handleApiKeyChange(e: React.ChangeEvent<HTMLInputElement>) {
    setApiKeyTouched(true);
    setApiKeyDraft(e.target.value);
  }

  function handleApiKeyBlur() {
    if (!config || !apiKeyTouched) return;
    void persist({ translator: { ...config.translator, api_key: apiKeyDraft } });
  }

  function handleConcurrencyChange(value: number) {
    if (!config) return;
    void persist({ sync: { ...config.sync, concurrency: value } });
  }

  function handleIntervalChange(value: number) {
    if (!config) return;
    void persist({ sync: { ...config.sync, interval_hours: value } });
  }

  const engine = config?.translator.engine ?? 'deepseek';
  const apiKeyPlaceholder =
    config?.translator.api_key_set && !apiKeyTouched ? '••••••••' : '输入 API Key';

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader eyebrow="SETTINGS · 系统设置" title="系统设置" desc="配置翻译引擎、并发与同步频率。" />

      {loadError && (
        <Card style={{ marginBottom: 14 }} padding={16}>
          <span style={{ fontSize: 13, color: 'var(--status-error)' }}>加载配置失败：{loadError}</span>
        </Card>
      )}
      {saveError && (
        <Card style={{ marginBottom: 14 }} padding={16}>
          <span style={{ fontSize: 13, color: 'var(--status-error)' }}>{saveError}</span>
        </Card>
      )}

      <Card padding={22} style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>
          翻译引擎
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Select
            label="引擎"
            value={engine}
            onChange={handleEngineChange}
            options={ENGINE_OPTIONS}
            disabled={!config || saving}
          />
          <div
            key={engine}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
          >
            <Input
              label="API Key"
              mono
              type="password"
              value={apiKeyDraft}
              onChange={handleApiKeyChange}
              onBlur={handleApiKeyBlur}
              placeholder={apiKeyPlaceholder}
              disabled={!config || saving}
            />
            <Input
              label="Model"
              mono
              value={config?.translator.model ?? ''}
              onChange={handleModelChange}
              placeholder={MODELS[engine]}
              disabled={!config || saving}
            />
            <Input
              label="Base URL"
              mono
              value={config?.translator.base_url ?? ''}
              onChange={handleBaseUrlChange}
              placeholder={BASE_URLS[engine]}
              style={{ gridColumn: '1 / -1' }}
              disabled={!config || saving}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <Button
              variant="secondary"
              onClick={handleTestConnection}
              loading={testStatus === 'testing'}
              disabled={!config || saving || testStatus === 'testing'}
            >
              测试连接
            </Button>
            {testStatus === 'ok' && (
              <span style={{ fontSize: 13, color: 'var(--status-ok)' }}>连接成功</span>
            )}
            {testStatus === 'error' && (
              <span style={{ fontSize: 13, color: 'var(--status-error)' }}>{testError}</span>
            )}
          </div>
        </div>
      </Card>

      <Card padding={22}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>
          并发与同步
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <Slider
            label="并发翻译数"
            value={config?.sync.concurrency ?? 3}
            onChange={handleConcurrencyChange}
            min={1}
            max={10}
            unit="个"
            disabled={!config || saving}
          />
          <Slider
            label="后台轮询间隔"
            value={config?.sync.interval_hours ?? 6}
            onChange={handleIntervalChange}
            min={1}
            max={24}
            unit="h"
            disabled={!config || saving}
          />
        </div>
      </Card>

      <Card padding={22} style={{ marginTop: 18 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>
          更新
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button
            variant="secondary"
            onClick={handleCheckForUpdate}
            loading={updateStatus.phase === 'checking' || updateStatus.phase === 'downloading'}
            disabled={updateStatus.phase === 'checking' || updateStatus.phase === 'downloading'}
          >
            检查更新
          </Button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {updateStatus.phase === 'checking' && '检查更新中…'}
            {updateStatus.phase === 'up-to-date' && '已是最新版本'}
            {updateStatus.phase === 'downloading' &&
              `发现新版本 v${updateStatus.version}，下载安装中…`}
            {updateStatus.phase === 'error' && (
              <span style={{ color: 'var(--status-error)' }}>检查更新失败：{updateStatus.message}</span>
            )}
          </span>
        </div>
      </Card>
    </div>
  );
}
