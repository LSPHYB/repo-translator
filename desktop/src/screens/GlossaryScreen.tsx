/**
 * GlossaryScreen — editable glossary term table + exclude-pattern tag input,
 * wired to `GET`/`PUT /config` (`AppConfig.glossary` / `AppConfig.output.exclude`).
 *
 * Ported from ui_kits/desktop-app/GlossaryScreen.jsx (window.GlossaryScreen
 * global) -- same layout/components/Chinese copy as the mockup, but wired to
 * real data following the conventions established by ReposScreen.tsx:
 *
 * - Loads the full `AppConfig` via `api.getConfig()` on mount; local state
 *   holds `revision` (the optimistic-concurrency token, see `AppConfig.
 *   revision` in config.py) alongside the editable `terms`/`excludes`.
 * - Every edit (add/edit/remove a term, add/remove an exclude pattern)
 *   updates local state immediately (so the UI feels responsive, same as
 *   the mockup) and then persists the *entire* `AppConfig` via
 *   `api.putConfig()`, including the held `revision` -- the backend's 409
 *   guard exists specifically so two screens editing the same config can't
 *   silently clobber each other's saves.
 * - On a 409 (`ApiError` with `.status === 409`), do not retry with the
 *   stale payload: re-fetch via `api.getConfig()` to pick up the new
 *   revision + whatever the other writer saved, discard the in-flight edit,
 *   and show a user-visible message asking the user to redo it.
 *
 * Dropped from the mockup (no real backend signal/endpoint to back it):
 * - "导入 CSV" -- no CSV-import endpoint exists; the button renders
 *   disabled rather than faking the interaction.
 */
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api';
import { ApiError } from '../api';
import type { AppConfig, GlossaryEntry } from '../api';
import PageHeader from '../components/PageHeader';
import { Button, Card, Badge, TagInput } from '../design-system';

function Ic(d: React.ReactNode) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}
const plusIcon = Ic(
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>,
);
const importIcon = Ic(
  <>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </>,
);
const trashIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const STALE_REVISION_MESSAGE = '配置已更新，请重新加载后重试';

interface CellProps {
  value: string;
  mono?: boolean;
  editing: boolean;
  onEdit: () => void;
  onCommit: (value: string) => void;
  placeholder: string;
}

function Cell({ value, mono, editing, onEdit, onCommit, placeholder }: CellProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value, editing]);
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit(draft);
        }}
        placeholder={placeholder}
        style={{
          width: '90%',
          height: 30,
          padding: '0 8px',
          borderRadius: 7,
          border: '1px solid var(--accent)',
          background: 'var(--surface-sunken)',
          outline: 'none',
          color: 'var(--text-primary)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
          fontSize: 13,
        }}
      />
    );
  }
  return (
    <span
      onDoubleClick={onEdit}
      title="双击编辑"
      style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: 13.5,
        color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
        cursor: 'text',
      }}
    >
      {value || placeholder}
    </span>
  );
}

export default function GlossaryScreen() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [terms, setTerms] = useState<GlossaryEntry[]>([]);
  const [excludes, setExcludes] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const cfg = await api.getConfig();
      setConfig(cfg);
      setTerms(cfg.glossary);
      setExcludes(cfg.output.exclude);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Persists the full AppConfig (current `config` + the given overrides),
  // including the held `revision`. On success, adopts the server's
  // response (which carries the bumped revision) as the new baseline. On a
  // 409 (some other writer saved since we last fetched), discard our
  // in-flight edit, re-fetch the latest state, and surface a message --
  // never silently retry with stale data.
  async function persist(overrides: Partial<Pick<AppConfig, 'glossary' | 'output'>>) {
    if (!config) return;
    const payload: AppConfig = { ...config, ...overrides };
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await api.putConfig(payload);
      setConfig(saved);
      setTerms(saved.glossary);
      setExcludes(saved.output.exclude);
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

  function handleAddTerm() {
    if (!config) return;
    setTerms([{ term: '', translation: '' }, ...terms]);
  }

  function handleCommitTerm(index: number, field: 'term' | 'translation', value: string) {
    const next = terms.map((t, i) => (i === index ? { ...t, [field]: value } : t));
    setTerms(next);
    setEditing(null);
    void persist({ glossary: next });
  }

  function handleRemoveTerm(index: number) {
    const next = terms.filter((_, i) => i !== index);
    setTerms(next);
    void persist({ glossary: next });
  }

  function handleExcludesChange(next: string[]) {
    if (!config) return;
    setExcludes(next);
    void persist({ output: { ...config.output, exclude: next } });
  }

  return (
    <div>
      <PageHeader
        eyebrow="GLOSSARY & RULES · 术语表与规则"
        title="术语表"
        desc="统一翻译用词，双击单元格即可编辑。"
        actions={
          <>
            <Button variant="secondary" icon={importIcon} disabled>
              导入 CSV
            </Button>
            <Button variant="primary" icon={plusIcon} onClick={handleAddTerm} disabled={!config || saving}>
              新增术语
            </Button>
          </>
        }
      />

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

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card variant="solid" padding={0}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 60px',
              padding: '11px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
            }}
          >
            <span>原文 (EN)</span>
            <span>译文 (ZH)</span>
            <span style={{ textAlign: 'right' }}>操作</span>
          </div>
          {terms.length === 0 && (
            <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>暂无术语，点击「新增术语」开始。</div>
          )}
          {terms.map((t, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 60px',
                padding: '11px 16px',
                borderBottom: i < terms.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                alignItems: 'center',
              }}
            >
              <Cell
                value={t.term}
                mono
                editing={editing === `${i}-en`}
                onEdit={() => setEditing(`${i}-en`)}
                onCommit={(v) => handleCommitTerm(i, 'term', v)}
                placeholder="english term"
              />
              <Cell
                value={t.translation ?? ''}
                editing={editing === `${i}-zh`}
                onEdit={() => setEditing(`${i}-zh`)}
                onCommit={(v) => handleCommitTerm(i, 'translation', v)}
                placeholder="中文译法"
              />
              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={() => handleRemoveTerm(i)}
                  aria-label="删除"
                  style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                >
                  {trashIcon}
                </button>
              </div>
            </div>
          ))}
        </Card>

        <Card padding={18}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>排除模式</div>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>匹配的文件不会被翻译。支持 glob 规则。</p>
          <TagInput tags={excludes} onChange={handleExcludesChange} />
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge tone="neutral" size="sm">
              {excludes.length} 条规则
            </Badge>
            <Badge tone="accent" size="sm">
              已生效
            </Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
