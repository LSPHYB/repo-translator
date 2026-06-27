/**
 * ConsoleScreen / ConsoleDrawer — terminal-style live log stream with level
 * filters.
 *
 * Ported from ui_kits/desktop-app/ConsoleScreen.jsx (window.ConsoleScreen /
 * window.ConsoleDrawer globals), which shared a `LogStream`/`FilterBar` pair
 * over a static `RT_LOGS` fixture. Both pieces are kept here, now backed by
 * a live buffer fed from `api.connectLogs()` (the `WS /logs` wrapper) instead
 * of the fixture:
 *
 * - `useLogBuffer()` is a small shared hook: opens its own `connectLogs()`
 *   WebSocket, keeps the last 1000 lines (oldest dropped once the cap is
 *   exceeded -- the WS stream itself is unbounded for the life of the
 *   connection), and closes the socket on unmount. `ConsoleScreen` and
 *   `ConsoleDrawer` each call this hook independently and each get their own
 *   connection/buffer -- exactly like `ReposScreen.tsx` already opens its own
 *   independent `connectLogs()` connection for its per-file status overlay.
 *   Two sockets is an accepted tradeoff here (see task brief): both surfaces
 *   can be visible at once (the drawer is independent of page navigation)
 *   and each showing the live stream correctly is what matters, not
 *   connection dedup.
 * - `DONE` is **not** a real `LogMessage.level` -- the mockup's fixture used
 *   it as a 4th pseudo-level for the file-completion line. The real signal
 *   is the structured `event` field added in an earlier task: a line is
 *   displayed as `DONE` iff `log.event === 'file_translated'`, never by
 *   matching message text. Every other line displays its real `log.level`,
 *   normalized to the mockup's display labels (`WARNING` -> `WARN`; `INFO`/
 *   `ERROR`/`CRITICAL`/`DEBUG` pass through, with `CRITICAL` bucketed under
 *   the `ERROR` filter same as the backend never actually emits `CRITICAL`
 *   for per-file events but DEBUG/CRITICAL lines should still be visible by
 *   default rather than silently dropped).
 * - Filter bar: exactly 3 buttons (`INFO`/`WARN`/`ERROR`), matching the
 *   mockup's actual `FilterBar` -- not 4. A `DONE`-displayed line is
 *   filtered by the `INFO` toggle (since `file_translated` is logged at
 *   Python's INFO level under the hood), matching the mockup's
 *   `!(r.l === 'DONE' && filters.INFO === false)` exactly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogMessage } from '../api';
import { useSyncContext } from '../SyncContext';
import PageHeader from '../components/PageHeader';
import { Badge, ConsoleLine } from '../design-system';

/** Display level shown in the console UI -- not the same union as the real `LogMessage['level']`. */
type DisplayLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'DONE';

/** Which of the 3 filter buttons a given display level is gated by. */
type FilterBucket = 'INFO' | 'WARN' | 'ERROR';

interface LogLine {
  time: string;
  displayLevel: DisplayLevel;
  filterBucket: FilterBucket;
  message: string;
}

function toDisplayLevel(level: LogMessage['level']): DisplayLevel {
  if (level === 'WARNING') return 'WARN';
  return level;
}

function toFilterBucket(displayLevel: DisplayLevel): FilterBucket {
  if (displayLevel === 'WARN') return 'WARN';
  if (displayLevel === 'ERROR' || displayLevel === 'CRITICAL') return 'ERROR';
  // INFO, DEBUG, and DONE (file_translated is logged at INFO under the hood)
  // all fall under the INFO toggle, matching the mockup's DONE-follows-INFO
  // behavior.
  return 'INFO';
}

function toLogLine(log: LogMessage): LogLine {
  const isDone = log.event === 'file_translated';
  const displayLevel: DisplayLevel = isDone ? 'DONE' : toDisplayLevel(log.level);
  return {
    time: log.time,
    displayLevel,
    filterBucket: toFilterBucket(displayLevel),
    message: log.message,
  };
}

/**
 * Maps the shared raw log buffer (SyncContext owns the single `/logs`
 * WebSocket; see SyncContext.tsx) into this screen's display rows. Reading the
 * shared buffer -- rather than opening a fresh socket per surface -- means the
 * bottom drawer shows the backlog accumulated before it was opened instead of
 * starting empty.
 */
function useLogBuffer(): LogLine[] {
  const { logs } = useSyncContext();
  return logs.map(toLogLine);
}

type FilterState = Partial<Record<FilterBucket, boolean>>;

function LogStream({ lines, filters, height }: { lines: LogLine[]; filters: FilterState; height: number | string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rows = lines.filter(
    (r) => filters[r.filterBucket] !== false && !(r.displayLevel === 'DONE' && filters.INFO === false),
  );

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [rows.length]);

  return (
    <div
      ref={ref}
      style={{
        background: 'var(--console-bg)',
        borderRadius: 12,
        border: '1px solid var(--border-subtle)',
        padding: '14px 16px',
        height,
        overflow: 'auto',
      }}
    >
      {rows.map((r, i) => (
        <ConsoleLine key={i} time={r.time} level={r.displayLevel}>
          {r.message}
        </ConsoleLine>
      ))}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
          color: 'var(--console-dim)',
        }}
      >
        <span style={{ color: 'var(--console-ok)' }}>$</span>
        <span style={{ width: 8, height: 15, background: 'var(--console-ok)', animation: 'rt-blink 1s step-end infinite' }} />
      </div>
      <style>{'@keyframes rt-blink{50%{opacity:0}}'}</style>
    </div>
  );
}

function FilterBar({ filters, onToggle }: { filters: FilterState; onToggle: (level: FilterBucket) => void }) {
  const levels: [FilterBucket, 'accent' | 'warning' | 'error'][] = [
    ['INFO', 'accent'],
    ['WARN', 'warning'],
    ['ERROR', 'error'],
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>级别过滤</span>
      {levels.map(([lvl, tone]) => {
        const on = filters[lvl] !== false;
        return (
          <button
            key={lvl}
            onClick={() => onToggle(lvl)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, opacity: on ? 1 : 0.4 }}
          >
            <Badge tone={tone} dot size="sm">
              {lvl}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

function useFilters() {
  const [filters, setFilters] = useState<FilterState>({});
  const toggle = useCallback(
    (l: FilterBucket) => setFilters((f) => ({ ...f, [l]: f[l] === false ? true : false })),
    [],
  );
  return { filters, toggle };
}

/** Full-screen variant (Logs nav page / "调试台"). */
export default function ConsoleScreen() {
  const lines = useLogBuffer();
  const { filters, toggle } = useFilters();
  return (
    <div>
      <PageHeader
        eyebrow="DEBUG CONSOLE · 交互式调试台"
        title="调试台"
        desc="实时流式显示 Python 后台的执行过程。"
        actions={<FilterBar filters={filters} onToggle={toggle} />}
      />
      <LogStream lines={lines} filters={filters} height="calc(100vh - 290px)" />
    </div>
  );
}

/** Bottom drawer variant (toggled from StatusBar). */
export function ConsoleDrawer() {
  const lines = useLogBuffer();
  const { filters, toggle } = useFilters();
  return (
    <div
      style={{
        borderTop: '1px solid var(--border-default)',
        background: 'var(--surface-sunken)',
        padding: '12px 16px',
        animation: 'rt-drawer var(--dur-base) var(--ease-out)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>实时日志面板</span>
        <FilterBar filters={filters} onToggle={toggle} />
      </div>
      <LogStream lines={lines} filters={filters} height={180} />
      <style>{'@keyframes rt-drawer{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'}</style>
    </div>
  );
}
