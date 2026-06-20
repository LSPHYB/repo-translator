/* global React */
// SettingsScreen — engine config with sliding fields + API connectivity test.
function SettingsScreen({ ds }) {
  const { Card, Select, Input, Button, Slider, Switch, StatusDot } = ds;
  const [engine, setEngine] = React.useState('deepseek');
  const [concurrency, setConcurrency] = React.useState(4);
  const [interval, setIntervalH] = React.useState(6);
  const [autoSync, setAutoSync] = React.useState(true);
  const [test, setTest] = React.useState('idle'); // idle | testing | ok | fail

  const baseUrls = { openai: 'https://api.openai.com/v1', deepseek: 'https://api.deepseek.com', claude: 'https://api.anthropic.com' };
  const models = { openai: 'gpt-4o-mini', deepseek: 'deepseek-chat', claude: 'claude-3-5-sonnet' };

  function runTest() {
    setTest('testing');
    setTimeout(() => setTest(Math.random() > 0.15 ? 'ok' : 'fail'), 1100);
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <window.PageHeader eyebrow="SETTINGS · 系统设置" title="系统设置" desc="配置翻译引擎、并发与同步频率。" />

      <Card padding={22} style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>翻译引擎</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Select label="引擎" value={engine} onChange={(v) => { setEngine(v); setTest('idle'); }} options={[{ value: 'openai', label: 'OpenAI' }, { value: 'deepseek', label: 'DeepSeek' }, { value: 'claude', label: 'Claude' }]} />
          <div key={engine} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, animation: 'rt-slidein var(--dur-base) var(--ease-out)' }}>
            <Input label="API Key" mono type="password" placeholder="sk-xxxxxxxxxxxx" />
            <Input label="Model" mono placeholder={models[engine]} />
            <Input label="Base URL" mono placeholder={baseUrls[engine]} style={{ gridColumn: '1 / -1' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Button variant="primary" loading={test === 'testing'} onClick={runTest}>测试连接</Button>
            {test === 'ok' && <StatusDot tone="ok" label="连接成功 · 延迟 118ms" />}
            {test === 'fail' && <StatusDot tone="error" label="连接失败 · 401 Unauthorized" />}
            {test === 'idle' && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>点击进行一次轻量级 API 调用</span>}
          </div>
        </div>
      </Card>

      <Card padding={22}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>并发与同步</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <Slider label="并发翻译数" value={concurrency} onChange={setConcurrency} min={1} max={10} unit="个" />
          <Slider label="后台轮询间隔" value={interval} onChange={setIntervalH} min={1} max={24} unit="h" />
        </div>
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>开启自动同步</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>按轮询间隔在后台自动检查并翻译更新。</div>
          </div>
          <Switch checked={autoSync} onChange={setAutoSync} />
        </div>
      </Card>
      <style>{'@keyframes rt-slidein{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}'}</style>
    </div>
  );
}
window.SettingsScreen = SettingsScreen;
