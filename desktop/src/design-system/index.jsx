/* ── repo-translator Design System · ES module port ──────────────────────
   Ported from the repo root's `_ds_bundle.js` (window.RepoTranslatorDesignSystem_dab506
   namespace bundle, generated from components/ (all .jsx files)). This is a 1:1 behavioral
   port — component names, props, and markup are unchanged; only the module
   wrapper (named exports instead of a window-global namespace object) differs.

   Verified export list (from _ds_bundle.js's trailing `__ds_ns.X = __ds_scope.X`
   assignments, lines 4011-4049 of the bundle) — 20 components:
     RepoCard, StatusBar, ThemeToggle, TitleBar, Badge, Card, ProgressBar,
     StatCard, ConsoleLine, Spinner, StatusDot, Button, IconButton, Input,
     Select, Slider, Switch, TagInput, NavRail, Tabs

   Note: the bundle's manifest comment / plan's example list omits `Spinner`
   and `IconButton`, which ARE exported by the actual bundle — both are
   ported and exported here too.
   ──────────────────────────────────────────────────────────────────────── */
import React from 'react';

/* ============================== app/StatusBar ============================== */

/**
 * StatusBar — the floating bottom status bar: engine/connection, cache state,
 * and a log-console toggle. Glass surface spanning the content width.
 */
export function StatusBar({
  engine = 'DeepSeek',
  connected = true,
  cache = '正常',
  logsOpen = false,
  onToggleLogs,
  latency = null,
  extra = null,
  style = {},
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        height: 36,
        padding: '0 16px',
        background: 'var(--surface-card)',
        borderTop: '1px solid var(--border-subtle)',
        backdropFilter: 'var(--blur-glass)',
        WebkitBackdropFilter: 'var(--blur-glass)',
        fontSize: 12.5,
        color: 'var(--text-secondary)',
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: connected ? 'var(--status-ok)' : 'var(--status-error)',
            boxShadow: `0 0 8px -1px ${connected ? 'var(--status-ok)' : 'var(--status-error)'}`,
          }}
        />
        {connected ? `引擎已连接: ${engine}` : '引擎未连接'}
      </span>
      <StatusBarDivider />
      <span>
        缓存状态: <span style={{ color: 'var(--text-primary)' }}>{cache}</span>
      </span>
      {latency != null && (
        <>
          <StatusBarDivider />
          <span style={{ fontFamily: 'var(--font-mono)' }}>API 延迟 {latency}ms</span>
        </>
      )}
      {extra && (
        <>
          <StatusBarDivider />
          {extra}
        </>
      )}
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onToggleLogs}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          height: 24,
          padding: '0 10px',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          cursor: 'pointer',
          background: logsOpen ? 'var(--accent-soft)' : 'transparent',
          color: logsOpen ? 'var(--accent)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          fontWeight: 600,
          transition: 'background var(--dur-base), color var(--dur-base)',
        }}
      >
        实时日志面板
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            transform: logsOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--dur-base)',
          }}
        >
          <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
function StatusBarDivider() {
  return <span style={{ width: 1, height: 14, background: 'var(--border-default)' }} />;
}

/* ============================== app/ThemeToggle ============================== */

/**
 * ThemeToggle — a segmented dark/light switch. Controlled: pass theme +
 * onChange. Reflects the app's 300ms cross-fade aesthetic.
 */
export function ThemeToggle({ theme = 'dark', onChange, style = {} }) {
  const opts = [
    { id: 'light', icon: <SunIcon />, label: '浅色' },
    { id: 'dark', icon: <MoonIcon />, label: '深色' },
  ];
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 3,
        padding: 3,
        borderRadius: 10,
        background: 'var(--surface-sunken)',
        border: '1px solid var(--border-subtle)',
        ...style,
      }}
    >
      {opts.map((o) => {
        const active = o.id === theme;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange && onChange(o.id)}
            aria-label={o.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 11px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: 12.5,
              fontWeight: 600,
              background: active ? 'var(--gradient-brand)' : 'transparent',
              color: active ? 'var(--text-on-accent)' : 'var(--text-secondary)',
              transition: 'background var(--dur-base), color var(--dur-base)',
            }}
          >
            <span style={{ display: 'inline-flex', width: 14, height: 14 }}>{o.icon}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
    </svg>
  );
}

/* ============================== app/TitleBar ============================== */

/**
 * TitleBar — the custom window chrome: traffic-light dots, brand mark + name +
 * version, and minimize/close window controls. Glass surface; drag region.
 */
export function TitleBar({
  title = 'repo-translator',
  version = 'v0.1.0',
  logoSrc = null,
  onMinimize,
  onClose,
  right = null,
  style = {},
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        height: 44,
        padding: '0 14px',
        background: 'var(--surface-card)',
        borderBottom: '1px solid var(--border-subtle)',
        backdropFilter: 'var(--blur-glass)',
        WebkitBackdropFilter: 'var(--blur-glass)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <TitleBarLight c="#FF5F57" onClick={onClose} />
        <TitleBarLight c="#FEBC2E" onClick={onMinimize} />
        <TitleBarLight c="#28C840" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginLeft: 6 }}>
        {logoSrc && <img src={logoSrc} alt="" width={20} height={20} style={{ borderRadius: 5 }} />}
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{version}</span>
      </div>
      <div style={{ flex: 1 }} />
      {right}
      <div style={{ display: 'flex', gap: 2 }}>
        <TitleBarWinBtn onClick={onMinimize} label="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </TitleBarWinBtn>
        <TitleBarWinBtn onClick={onClose} label="关闭" danger>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </TitleBarWinBtn>
      </div>
    </div>
  );
}
function TitleBarLight({ c, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        width: 12,
        height: 12,
        borderRadius: 999,
        background: c,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.18)',
      }}
    />
  );
}
function TitleBarWinBtn({ children, onClick, label, danger = false }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? (danger ? 'var(--status-error)' : 'var(--surface-raised)') : 'transparent',
        color: hover && danger ? '#fff' : 'var(--text-secondary)',
        transition: 'background var(--dur-fast), color var(--dur-fast)',
      }}
    >
      {children}
    </button>
  );
}

/* ============================== display/Badge ============================== */

/**
 * Badge — small status/category pill. Tone maps to the status color system;
 * a leading dot can be shown for live statuses.
 */
export function Badge({ children, tone = 'neutral', dot = false, soft = true, size = 'md', style = {} }) {
  const tones = {
    neutral: { fg: 'var(--text-secondary)', bg: 'var(--status-muted-bg)', solid: 'var(--status-muted)' },
    accent: { fg: 'var(--accent)', bg: 'var(--accent-soft)', solid: 'var(--accent)' },
    success: { fg: 'var(--status-ok)', bg: 'var(--status-ok-bg)', solid: 'var(--status-ok)' },
    warning: { fg: 'var(--status-warn)', bg: 'var(--status-warn-bg)', solid: 'var(--status-warn)' },
    error: { fg: 'var(--status-error)', bg: 'var(--status-error-bg)', solid: 'var(--status-error)' },
  };
  const t = tones[tone] || tones.neutral;
  const sizes = { sm: { h: 20, fs: 11, px: 7 }, md: { h: 24, fs: 12, px: 9 } };
  const s = sizes[size] || sizes.md;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: s.h,
        padding: `0 ${s.px}px`,
        borderRadius: 999,
        fontSize: s.fs,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-sans)',
        color: soft ? t.fg : 'var(--text-on-accent)',
        background: soft ? t.bg : t.solid,
        border: soft ? '1px solid var(--border-subtle)' : '1px solid transparent',
        ...style,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: t.solid, flexShrink: 0 }} />}
      {children}
    </span>
  );
}

/* ============================== display/Card ============================== */

/**
 * Card — the frosted glass surface that nearly every panel sits on.
 * variant "glass" (translucent + blur) | "solid" (opaque elevated) | "outline".
 */
export function Card({
  children,
  variant = 'glass',
  padding = 20,
  interactive = false,
  glow = false,
  header = null,
  style = {},
  onClick,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const variants = {
    glass: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      boxShadow: 'var(--shadow-card)',
    },
    solid: {
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-sm)',
    },
    outline: { background: 'transparent', border: '1px solid var(--border-default)' },
  };
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 16,
        ...(variants[variant] || variants.glass),
        ...(glow ? { boxShadow: 'var(--shadow-card), 0 0 40px -16px var(--accent-ring)' } : {}),
        ...(interactive
          ? {
              cursor: 'pointer',
              transform: hover ? 'translateY(-2px)' : 'none',
              borderColor: hover ? 'var(--border-strong)' : undefined,
              transition: 'transform var(--dur-base) var(--ease-out), border-color var(--dur-base), box-shadow var(--dur-base)',
            }
          : {}),
        ...style,
      }}
      {...rest}
    >
      {header && <div style={{ padding: `14px ${padding}px`, borderBottom: '1px solid var(--border-subtle)' }}>{header}</div>}
      <div style={{ padding }}>{children}</div>
    </div>
  );
}

/* ============================== display/ProgressBar ============================== */

/**
 * ProgressBar — determinate (value 0–100) or indeterminate. Fill uses the
 * brand gradient. Shows an optional inline label/percentage.
 */
export function ProgressBar({ value = 0, indeterminate = false, label = null, showPct = false, height = 8, tone = 'brand', style = {} }) {
  const fills = { brand: 'var(--gradient-brand)', success: 'var(--status-ok)', warning: 'var(--status-warn)' };
  const fill = fills[tone] || fills.brand;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', ...style }}>
      {(label || showPct) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          {label && <span style={{ color: 'var(--text-secondary)' }}>{label}</span>}
          {showPct && !indeterminate && (
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{Math.round(pct)}%</span>
          )}
        </div>
      )}
      <div
        style={{
          position: 'relative',
          height,
          borderRadius: 999,
          overflow: 'hidden',
          background: 'var(--surface-sunken)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {indeterminate ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '40%',
              borderRadius: 999,
              background: fill,
              animation: 'rt-indet 1.2s var(--ease-in-out) infinite',
            }}
          >
            <style>{'@keyframes rt-indet{0%{left:-40%}100%{left:100%}}'}</style>
          </div>
        ) : (
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 999,
              background: fill,
              boxShadow: '0 0 12px -2px var(--accent-ring)',
              transition: 'width var(--dur-base) var(--ease-out)',
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ============================== display/StatCard ============================== */

/**
 * StatCard — a dashboard metric: big numeral, label, optional delta + icon.
 * Numerals use the display font with tabular figures.
 */
export function StatCard({ label, value, unit = '', sub = null, icon = null, accent = false, delta = null, style = {} }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 18,
        borderRadius: 16,
        background: accent ? 'var(--gradient-brand-soft)' : 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'var(--blur-glass)',
        WebkitBackdropFilter: 'var(--blur-glass)',
        boxShadow: 'var(--shadow-card)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
        {icon && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 9,
              color: 'var(--accent)',
              background: 'var(--accent-soft)',
            }}
          >
            <span style={{ display: 'inline-flex', width: 16, height: 16 }}>{icon}</span>
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 32,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {unit && <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{unit}</span>}
        {delta != null && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              fontWeight: 600,
              color: delta >= 0 ? 'var(--status-ok)' : 'var(--status-error)',
            }}
          >
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}
          </span>
        )}
      </div>
      {sub && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{sub}</span>}
    </div>
  );
}

/* ============================== feedback/ConsoleLine ============================== */

/**
 * ConsoleLine — one row in the interactive debug console. Renders a timestamp,
 * a colored level tag, and the message in monospace. Use inside a dark console
 * surface (var(--console-bg)).
 */
export function ConsoleLine({ time, level = 'INFO', children, dim = false }) {
  const levels = {
    INFO: 'var(--console-info)',
    WARN: 'var(--console-warn)',
    WARNING: 'var(--console-warn)',
    ERROR: 'var(--console-error)',
    DONE: 'var(--console-ok)',
    OK: 'var(--console-ok)',
  };
  const c = levels[level] || 'var(--console-info)';
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '2px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        lineHeight: 1.7,
        opacity: dim ? 0.55 : 1,
      }}
    >
      {time && <span style={{ color: 'var(--console-dim)', flexShrink: 0 }}>{time}</span>}
      <span style={{ color: c, fontWeight: 700, flexShrink: 0, width: 48 }}>{level}</span>
      <span style={{ color: 'var(--console-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{children}</span>
    </div>
  );
}

/* ============================== feedback/Spinner ============================== */

/**
 * Spinner — gentle continuous loading indicator. Optional brand gradient ring.
 */
export function Spinner({ size = 18, thickness = 2, tone = 'accent', style = {} }) {
  const color = tone === 'accent' ? 'var(--accent)' : 'currentColor';
  return (
    <span
      role="status"
      aria-label="加载中"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${thickness}px solid var(--border-default)`,
        borderTopColor: color,
        animation: 'rt-spin 0.7s linear infinite',
        ...style,
      }}
    >
      <style>{'@keyframes rt-spin{to{transform:rotate(360deg)}}'}</style>
    </span>
  );
}

/* ============================== feedback/StatusDot ============================== */

/**
 * StatusDot — a small colored dot with optional pulse, plus optional label.
 * The canonical "● 运行中 / 引擎已连接" indicator.
 */
export function StatusDot({ tone = 'ok', pulse = false, label = null, size = 8, style = {} }) {
  const tones = {
    ok: 'var(--status-ok)',
    warn: 'var(--status-warn)',
    error: 'var(--status-error)',
    muted: 'var(--status-muted)',
    accent: 'var(--accent)',
  };
  const c = tones[tone] || tones.ok;
  const dot = (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      {pulse && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: c,
            animation: 'rt-pulse 1.6s var(--ease-out) infinite',
          }}
        >
          <style>{'@keyframes rt-pulse{0%{transform:scale(1);opacity:.55}70%{transform:scale(2.6);opacity:0}100%{opacity:0}}'}</style>
        </span>
      )}
      <span style={{ position: 'relative', width: size, height: size, borderRadius: 999, background: c, boxShadow: `0 0 8px -1px ${c}` }} />
    </span>
  );
  if (!label) return dot;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-secondary)', ...style }}>
      {dot}
      {label}
    </span>
  );
}

/* ============================== forms/Button ============================== */

/**
 * Button — repo-translator's primary action control.
 * Primary uses the brand gradient with an accent glow on hover; secondary is a
 * glass surface; ghost is transparent; danger uses the coral alert color.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon = null,
  iconRight = null,
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button',
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const isDisabled = disabled || loading;
  const sizes = {
    sm: { height: 30, padding: '0 12px', fontSize: 13, radius: 9, gap: 6, icon: 15 },
    md: { height: 38, padding: '0 16px', fontSize: 14, radius: 11, gap: 8, icon: 17 },
    lg: { height: 46, padding: '0 22px', fontSize: 15, radius: 13, gap: 9, icon: 19 },
  };
  const s = sizes[size] || sizes.md;
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.gap,
    height: s.height,
    padding: s.padding,
    width: fullWidth ? '100%' : undefined,
    borderRadius: s.radius,
    fontFamily: 'var(--font-sans)',
    fontSize: s.fontSize,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    border: '1px solid transparent',
    transition:
      'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), background var(--dur-base), color var(--dur-base)',
    transform: active && !isDisabled ? 'scale(0.97)' : 'scale(1)',
    opacity: isDisabled ? 0.55 : 1,
    userSelect: 'none',
  };
  const variants = {
    primary: {
      background: 'var(--gradient-brand)',
      color: 'var(--text-on-accent)',
      boxShadow: hover && !isDisabled ? '0 8px 28px -6px var(--accent-ring)' : '0 2px 10px -4px rgba(0,0,0,0.4)',
    },
    secondary: {
      background: hover && !isDisabled ? 'var(--surface-raised)' : 'var(--surface-card)',
      color: 'var(--text-primary)',
      borderColor: 'var(--border-default)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
    },
    ghost: {
      background: hover && !isDisabled ? 'var(--accent-soft)' : 'transparent',
      color: hover && !isDisabled ? 'var(--accent)' : 'var(--text-secondary)',
      borderColor: 'transparent',
    },
    danger: {
      background: hover && !isDisabled ? 'var(--status-error)' : 'var(--status-error-bg)',
      color: hover && !isDisabled ? '#fff' : 'var(--status-error)',
      borderColor: 'var(--status-error)',
    },
  };
  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{ ...base, ...(variants[variant] || variants.primary), ...style }}
      {...rest}
    >
      {loading ? (
        <ButtonSpinner size={s.icon} />
      ) : (
        icon && <span style={{ display: 'inline-flex', width: s.icon, height: s.icon }}>{icon}</span>
      )}
      {children}
      {iconRight && !loading && <span style={{ display: 'inline-flex', width: s.icon, height: s.icon }}>{iconRight}</span>}
    </button>
  );
}
function ButtonSpinner({ size = 16 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        display: 'inline-block',
        animation: 'rt-spin 0.7s linear infinite',
      }}
    >
      <style>{'@keyframes rt-spin{to{transform:rotate(360deg)}}'}</style>
    </span>
  );
}

/* ============================== app/RepoCard ============================== */

const repoCardIco = (d, sw = 1.8) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const REPO_CARD_ICON = {
  openDir: repoCardIco(
    <>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path d="M8 13l3 3 5-6" />
    </>,
  ),
  viewDocs: repoCardIco(
    <>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 14h6M9 17h4" />
    </>,
  ),
  configure: repoCardIco(<path d="M3 6h18M3 12h18M3 18h12" />),
  remove: repoCardIco(
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </>,
  ),
};

/**
 * RepoCard — a tracked repository in the Repos list / Dashboard queue. Shows
 * name, kind (managed/external) badge, branch, last-sync, file count, and —
 * when syncing — a live progress row. Closes the loop after a sync with
 * one-click "打开目录" / "查看译文" actions, plus a 更多 menu for the rest.
 */
export function RepoCard({
  name,
  kind = 'managed',
  branch = 'main',
  lastSync = '从未同步',
  files = 0,
  syncing = false,
  progress = null,
  currentFile = null,
  justFinished = false,
  onSync,
  onOpenDir,
  onViewDocs,
  onConfigure,
  onRemove,
  onMore,
  style = {},
}) {
  const hasOutput = files > 0;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 18,
        borderRadius: 16,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'var(--blur-glass)',
        WebkitBackdropFilter: 'var(--blur-glass)',
        boxShadow: 'var(--shadow-card)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 38,
            height: 38,
            borderRadius: 10,
            flexShrink: 0,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M3 6a3 3 0 013-3h7l2 2h3a2 2 0 012 2v9a2 2 0 01-2 2H6a3 3 0 01-3-3V6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{name}</span>
            <Badge tone={kind === 'managed' ? 'accent' : 'neutral'} size="sm">
              {kind}
            </Badge>
            {justFinished && !syncing && (
              <Badge tone="success" dot size="sm">
                翻译完成
              </Badge>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {kind === 'managed' && <span>⎇ {branch}</span>}
            <span>{files} 个文件</span>
            <span>上次同步 {lastSync}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {syncing ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--accent)' }}>
              <Spinner size={14} /> 同步中
            </span>
          ) : (
            <Button size="sm" variant="secondary" onClick={onSync}>
              立即同步
            </Button>
          )}
          <RepoCardMoreMenu
            onMore={onMore}
            items={[
              {
                id: 'configure',
                label: '排除项配置',
                icon: REPO_CARD_ICON.configure,
                onClick: onConfigure,
                disabled: !onConfigure,
                title: onConfigure ? undefined : '即将推出',
              },
              { id: 'remove', label: '移出跟踪', icon: REPO_CARD_ICON.remove, onClick: onRemove, danger: true },
            ]}
          />
        </div>
      </div>
      {syncing && progress != null && <ProgressBar value={progress} label={currentFile || '正在翻译…'} showPct />}
      {!syncing && hasOutput && (
        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <Button size="sm" variant="ghost" icon={REPO_CARD_ICON.openDir} onClick={onOpenDir}>
            打开目录
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={REPO_CARD_ICON.viewDocs}
            onClick={onViewDocs}
            disabled={!onViewDocs}
            title={onViewDocs ? undefined : '即将推出'}
          >
            查看译文
          </Button>
        </div>
      )}
    </div>
  );
}
function RepoCardMoreMenu({ items = [], onMore }) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="更多操作"
        title="更多操作"
        onClick={() => {
          setOpen((o) => !o);
          if (onMore) onMore();
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          cursor: 'pointer',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border-subtle)'}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: open || hover ? 'var(--surface-raised)' : 'transparent',
          color: open ? 'var(--accent)' : 'var(--text-secondary)',
          transition: 'background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 'var(--z-overlay)',
            minWidth: 168,
            padding: 6,
            borderRadius: 12,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-default)',
            backdropFilter: 'var(--blur-strong)',
            WebkitBackdropFilter: 'var(--blur-strong)',
            boxShadow: 'var(--shadow-lg)',
            animation: 'rt-menu var(--dur-base) var(--ease-out)',
          }}
        >
          <style>{'@keyframes rt-menu{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'}</style>
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              title={it.title}
              onClick={() => {
                if (it.disabled) return;
                setOpen(false);
                if (it.onClick) it.onClick();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '9px 10px',
                borderRadius: 8,
                border: 'none',
                cursor: it.disabled ? 'not-allowed' : 'pointer',
                background: 'transparent',
                textAlign: 'left',
                fontFamily: 'var(--font-sans)',
                fontSize: 13.5,
                opacity: it.disabled ? 0.5 : 1,
                color: it.danger ? 'var(--status-error)' : 'var(--text-primary)',
              }}
              onMouseEnter={(e) => {
                if (it.disabled) return;
                e.currentTarget.style.background = it.danger ? 'var(--status-error-bg)' : 'var(--surface-card)';
              }}
              onMouseLeave={(e) => {
                if (it.disabled) return;
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ display: 'inline-flex', width: 15, height: 15 }}>{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== forms/IconButton ============================== */

/**
 * IconButton — square, icon-only control for toolbars and window chrome.
 * Variants: ghost (default), solid (glass), accent (brand-tinted).
 */
export function IconButton({ icon, label, variant = 'ghost', size = 'md', active = false, disabled = false, onClick, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const sizes = { sm: 28, md: 34, lg: 40 };
  const dim = sizes[size] || sizes.md;
  const variants = {
    ghost: {
      background: active ? 'var(--accent-soft)' : hover ? 'var(--surface-card)' : 'transparent',
      color: active ? 'var(--accent)' : hover ? 'var(--text-primary)' : 'var(--text-secondary)',
      border: '1px solid transparent',
    },
    solid: {
      background: hover ? 'var(--surface-raised)' : 'var(--surface-card)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-subtle)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
    },
    accent: {
      background: hover ? 'var(--gradient-brand)' : 'var(--accent-soft)',
      color: hover ? 'var(--text-on-accent)' : 'var(--accent)',
      border: '1px solid transparent',
    },
  };
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: dim,
        height: dim,
        borderRadius: 10,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--dur-base), color var(--dur-base)',
        ...(variants[variant] || variants.ghost),
        ...style,
      }}
      {...rest}
    >
      <span style={{ display: 'inline-flex', width: Math.round(dim * 0.5), height: Math.round(dim * 0.5) }}>{icon}</span>
    </button>
  );
}

/* ============================== forms/Input ============================== */

/**
 * Input — text field with optional label, leading icon, suffix, and error.
 * Frosted surface, brand-ring focus.
 */
export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon = null,
  suffix = null,
  error = null,
  hint = null,
  disabled = false,
  mono = false,
  fullWidth = true,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const borderColor = error ? 'var(--status-error)' : focus ? 'var(--accent)' : 'var(--border-default)';
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7, width: fullWidth ? '100%' : undefined, ...style }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          height: 40,
          padding: '0 12px',
          borderRadius: 11,
          background: 'var(--surface-sunken)',
          border: `1px solid ${borderColor}`,
          boxShadow: focus && !error ? '0 0 0 3px var(--accent-soft)' : 'none',
          transition: 'border-color var(--dur-base), box-shadow var(--dur-base)',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {icon && <span style={{ display: 'inline-flex', width: 16, height: 16, color: 'var(--text-tertiary)', flexShrink: 0 }}>{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
            fontSize: mono ? 13 : 14,
            color: 'var(--text-primary)',
          }}
          {...rest}
        />
        {suffix && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{suffix}</span>}
      </span>
      {error ? (
        <span style={{ fontSize: 12, color: 'var(--status-error)' }}>{error}</span>
      ) : (
        hint && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{hint}</span>
      )}
    </label>
  );
}

/* ============================== forms/Select ============================== */

/**
 * Select — custom dropdown matching the glass aesthetic. Used for the engine
 * picker (OpenAI / DeepSeek / Claude) and other enumerated settings.
 */
export function Select({ label, value, onChange, options = [], placeholder = '请选择', disabled = false, fullWidth = true, style = {} }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const selected = options.find((o) => (o.value ?? o) === value);
  const selectedLabel = selected ? selected.label ?? selected : placeholder;
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 7, width: fullWidth ? '100%' : undefined, position: 'relative', ...style }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          height: 40,
          padding: '0 12px',
          borderRadius: 11,
          background: 'var(--surface-sunken)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border-default)'}`,
          boxShadow: open ? '0 0 0 3px var(--accent-soft)' : 'none',
          color: selected ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color var(--dur-base), box-shadow var(--dur-base)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selected && selected.icon && <span style={{ display: 'inline-flex', width: 16, height: 16 }}>{selected.icon}</span>}
          {selectedLabel}
        </span>
        <SelectChevron open={open} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 'var(--z-overlay)',
            padding: 6,
            borderRadius: 12,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-default)',
            backdropFilter: 'var(--blur-strong)',
            WebkitBackdropFilter: 'var(--blur-strong)',
            boxShadow: 'var(--shadow-lg)',
            animation: 'rt-pop var(--dur-base) var(--ease-out)',
          }}
        >
          <style>{'@keyframes rt-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'}</style>
          {options.map((o) => {
            const v = o.value ?? o;
            const l = o.label ?? o;
            const isSel = v === value;
            return (
              <div
                key={v}
                onClick={() => {
                  onChange && onChange(v);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '9px 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: isSel ? 'var(--accent)' : 'var(--text-primary)',
                  background: isSel ? 'var(--accent-soft)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isSel) e.currentTarget.style.background = 'var(--surface-card)';
                }}
                onMouseLeave={(e) => {
                  if (!isSel) e.currentTarget.style.background = 'transparent';
                }}
              >
                {o.icon && <span style={{ display: 'inline-flex', width: 16, height: 16 }}>{o.icon}</span>}
                {l}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function SelectChevron({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ transition: 'transform var(--dur-base)', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--text-tertiary)' }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ============================== forms/Slider ============================== */

/**
 * Slider — range control for concurrency and polling interval. The filled
 * track uses the brand gradient; the value bubble shows the current number.
 */
export function Slider({ label, value = 0, min = 0, max = 100, step = 1, onChange, unit = '', disabled = false, style = {} }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', ...style }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
            {value}
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 2 }}>{unit}</span>
          </span>
        </div>
      )}
      <div style={{ position: 'relative', height: 22, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 999, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }} />
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 6, borderRadius: 999, background: 'var(--gradient-brand)' }} />
        <div
          style={{
            position: 'absolute',
            left: `calc(${pct}% )`,
            transform: 'translateX(-50%)',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            border: '2px solid var(--accent)',
            boxShadow: '0 2px 8px -1px var(--accent-ring)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange && onChange(Number(e.target.value))}
          style={{ position: 'absolute', left: 0, right: 0, width: '100%', height: 22, margin: 0, opacity: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
      </div>
    </div>
  );
}

/* ============================== forms/Switch ============================== */

/**
 * Switch — toggle for booleans (theme, auto-sync, log filters as toggles).
 * On state fills with the brand gradient.
 */
export function Switch({ checked = false, onChange, label, disabled = false, size = 'md', style = {} }) {
  const dims = { sm: { w: 34, h: 20, k: 14 }, md: { w: 42, h: 24, k: 18 } };
  const d = dims[size] || dims.md;
  const pad = (d.h - d.k) / 2;
  const toggle = (
    <span
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange && onChange(!checked)}
      style={{
        position: 'relative',
        width: d.w,
        height: d.h,
        borderRadius: 999,
        flexShrink: 0,
        background: checked ? 'var(--gradient-brand)' : 'var(--surface-sunken)',
        border: `1px solid ${checked ? 'transparent' : 'var(--border-default)'}`,
        boxShadow: checked ? '0 2px 12px -2px var(--accent-ring)' : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--dur-base), box-shadow var(--dur-base)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: pad,
          left: checked ? d.w - d.k - pad : pad,
          width: d.k,
          height: d.k,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'left var(--dur-base) var(--ease-spring)',
        }}
      />
    </span>
  );
  if (!label) return toggle;
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', ...style }}>
      {toggle}
      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{label}</span>
    </label>
  );
}

/* ============================== forms/TagInput ============================== */

/**
 * TagInput — tag/chip input for exclude glob patterns. Type a pattern and
 * press Enter to add; click × to remove.
 */
export function TagInput({ label, tags = [], onChange, placeholder = '添加规则后回车…', mono = true, style = {} }) {
  const [draft, setDraft] = React.useState('');
  const [focus, setFocus] = React.useState(false);
  function commit() {
    const v = draft.trim();
    if (v && !tags.includes(v)) onChange && onChange([...tags, v]);
    setDraft('');
  }
  function removeAt(i) {
    onChange && onChange(tags.filter((_, idx) => idx !== i));
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%', ...style }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 7,
          alignItems: 'center',
          minHeight: 40,
          padding: 7,
          borderRadius: 11,
          background: 'var(--surface-sunken)',
          border: `1px solid ${focus ? 'var(--accent)' : 'var(--border-default)'}`,
          boxShadow: focus ? '0 0 0 3px var(--accent-soft)' : 'none',
          transition: 'border-color var(--dur-base), box-shadow var(--dur-base)',
        }}
      >
        {tags.map((t, i) => (
          <span
            key={t}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 26,
              padding: '0 6px 0 10px',
              borderRadius: 8,
              background: 'var(--accent-soft)',
              border: '1px solid var(--border-subtle)',
              fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
              fontSize: 12.5,
              color: 'var(--accent)',
            }}
          >
            {t}
            <button
              type="button"
              onClick={() => removeAt(i)}
              style={{ display: 'inline-flex', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--accent)', padding: 2, borderRadius: 5, lineHeight: 0 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Backspace' && !draft && tags.length) removeAt(tags.length - 1);
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false);
            commit();
          }}
          placeholder={tags.length ? '' : placeholder}
          style={{ flex: 1, minWidth: 90, height: 26, border: 'none', background: 'transparent', outline: 'none', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: 13, color: 'var(--text-primary)' }}
        />
      </div>
    </div>
  );
}

/* ============================== navigation/NavRail ============================== */

/**
 * NavRail — the left icon navigation rail. Each item shows an icon and label;
 * the active item gets a brand-tinted pill and an accent indicator bar.
 */
export function NavRail({ items = [], active, onSelect, footer = null, style = {} }) {
  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        width: 200,
        padding: 12,
        borderRight: '1px solid var(--border-subtle)',
        height: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {items.map((it) => (
        <NavRailItem key={it.id} item={it} active={it.id === active} onClick={() => onSelect && onSelect(it.id)} />
      ))}
      {footer && <div style={{ marginTop: 'auto' }}>{footer}</div>}
    </nav>
  );
}
function NavRailItem({ item, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        height: 40,
        padding: '0 12px',
        borderRadius: 11,
        border: 'none',
        width: '100%',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--accent)' : hover ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: active ? 'var(--accent-soft)' : hover ? 'var(--surface-card)' : 'transparent',
        transition: 'background var(--dur-base), color var(--dur-base)',
      }}
    >
      {active && (
        <span style={{ position: 'absolute', left: -12, top: 10, bottom: 10, width: 3, borderRadius: 999, background: 'var(--gradient-brand)' }} />
      )}
      <span style={{ display: 'inline-flex', width: 18, height: 18, flexShrink: 0 }}>{item.icon}</span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge != null && (
        <span
          style={{
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-on-accent)',
            background: 'var(--accent)',
          }}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}

/* ============================== navigation/Tabs ============================== */

/**
 * Tabs — underline-style tab bar. Used inside content panels (e.g. a repo's
 * file tree vs. settings, or log-level views).
 */
export function Tabs({ tabs = [], active, onSelect, style = {} }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', ...style }}>
      {tabs.map((t) => {
        const id = t.id ?? t;
        const label = t.label ?? t;
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect && onSelect(id)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: 13.5,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'color var(--dur-base)',
            }}
          >
            {t.icon && <span style={{ display: 'inline-flex', width: 15, height: 15 }}>{t.icon}</span>}
            {label}
            {t.count != null && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{t.count}</span>}
            {isActive && (
              <span style={{ position: 'absolute', left: 10, right: 10, bottom: -1, height: 2, borderRadius: 999, background: 'var(--gradient-brand)' }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
