/* @ds-bundle: {"format":3,"namespace":"RepoTranslatorDesignSystem_dab506","components":[{"name":"RepoCard","sourcePath":"components/app/RepoCard.jsx"},{"name":"StatusBar","sourcePath":"components/app/StatusBar.jsx"},{"name":"ThemeToggle","sourcePath":"components/app/ThemeToggle.jsx"},{"name":"TitleBar","sourcePath":"components/app/TitleBar.jsx"},{"name":"Badge","sourcePath":"components/display/Badge.jsx"},{"name":"Card","sourcePath":"components/display/Card.jsx"},{"name":"ProgressBar","sourcePath":"components/display/ProgressBar.jsx"},{"name":"StatCard","sourcePath":"components/display/StatCard.jsx"},{"name":"ConsoleLine","sourcePath":"components/feedback/ConsoleLine.jsx"},{"name":"Spinner","sourcePath":"components/feedback/Spinner.jsx"},{"name":"StatusDot","sourcePath":"components/feedback/StatusDot.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Slider","sourcePath":"components/forms/Slider.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"TagInput","sourcePath":"components/forms/TagInput.jsx"},{"name":"NavRail","sourcePath":"components/navigation/NavRail.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/app/RepoCard.jsx":"a89bed62d69f","components/app/StatusBar.jsx":"f97e66778a13","components/app/ThemeToggle.jsx":"b15605077280","components/app/TitleBar.jsx":"c8da609a0149","components/display/Badge.jsx":"78014532b057","components/display/Card.jsx":"25f2f29e02e7","components/display/ProgressBar.jsx":"cae4631b5198","components/display/StatCard.jsx":"d0576ed23e72","components/feedback/ConsoleLine.jsx":"b15108782ef7","components/feedback/Spinner.jsx":"48dcbdde966c","components/feedback/StatusDot.jsx":"0c58ae5d3751","components/forms/Button.jsx":"9cf33fae6de0","components/forms/IconButton.jsx":"41e2914b0c25","components/forms/Input.jsx":"4388c91d0083","components/forms/Select.jsx":"bc11aaae95d1","components/forms/Slider.jsx":"266fe18ec034","components/forms/Switch.jsx":"c26e46d9b786","components/forms/TagInput.jsx":"8c109cca528a","components/navigation/NavRail.jsx":"ead479f34abe","components/navigation/Tabs.jsx":"f8bf6852eb58","ui_kits/desktop-app/AppShell.jsx":"499b39255186","ui_kits/desktop-app/ConsoleScreen.jsx":"28b0292de1c6","ui_kits/desktop-app/DashboardScreen.jsx":"31e27a18ded2","ui_kits/desktop-app/GlossaryScreen.jsx":"b8ea05119ef3","ui_kits/desktop-app/Modal.jsx":"fcb408b53162","ui_kits/desktop-app/PageHeader.jsx":"4390a85eaf99","ui_kits/desktop-app/ReposScreen.jsx":"43b40bc962bb","ui_kits/desktop-app/SettingsScreen.jsx":"24a3ee9800cf","ui_kits/desktop-app/UsageScreen.jsx":"c7e32712534b"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RepoTranslatorDesignSystem_dab506 = window.RepoTranslatorDesignSystem_dab506 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/app/StatusBar.jsx
try { (() => {
/**
 * StatusBar — the floating bottom status bar: engine/connection, cache state,
 * and a log-console toggle. Glass surface spanning the content width.
 */
function StatusBar({
  engine = 'DeepSeek',
  connected = true,
  cache = '正常',
  logsOpen = false,
  onToggleLogs,
  latency = null,
  extra = null,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
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
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 999,
      background: connected ? 'var(--status-ok)' : 'var(--status-error)',
      boxShadow: `0 0 8px -1px ${connected ? 'var(--status-ok)' : 'var(--status-error)'}`
    }
  }), connected ? `引擎已连接: ${engine}` : '引擎未连接'), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement("span", null, "\u7F13\u5B58\u72B6\u6001: ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-primary)'
    }
  }, cache)), latency != null && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)'
    }
  }, "API \u5EF6\u8FDF ", latency, "ms")), extra && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Divider, null), extra), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onToggleLogs,
    style: {
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
      transition: 'background var(--dur-base), color var(--dur-base)'
    }
  }, "\u5B9E\u65F6\u65E5\u5FD7\u9762\u677F", /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    style: {
      transform: logsOpen ? 'rotate(180deg)' : 'none',
      transition: 'transform var(--dur-base)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 15l6-6 6 6",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))));
}
function Divider() {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 14,
      background: 'var(--border-default)'
    }
  });
}
Object.assign(__ds_scope, { StatusBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/StatusBar.jsx", error: String((e && e.message) || e) }); }

// components/app/ThemeToggle.jsx
try { (() => {
/**
 * ThemeToggle — a segmented dark/light switch. Controlled: pass theme +
 * onChange. Reflects the app's 300ms cross-fade aesthetic.
 */
function ThemeToggle({
  theme = 'dark',
  onChange,
  style = {}
}) {
  const opts = [{
    id: 'light',
    icon: /*#__PURE__*/React.createElement(SunIcon, null),
    label: '浅色'
  }, {
    id: 'dark',
    icon: /*#__PURE__*/React.createElement(MoonIcon, null),
    label: '深色'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      gap: 3,
      padding: 3,
      borderRadius: 10,
      background: 'var(--surface-sunken)',
      border: '1px solid var(--border-subtle)',
      ...style
    }
  }, opts.map(o => {
    const active = o.id === theme;
    return /*#__PURE__*/React.createElement("button", {
      key: o.id,
      type: "button",
      onClick: () => onChange && onChange(o.id),
      "aria-label": o.label,
      style: {
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
        transition: 'background var(--dur-base), color var(--dur-base)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        width: 14,
        height: 14
      }
    }, o.icon), o.label);
  }));
}
function SunIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
  }));
}
function MoonIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"
  }));
}
Object.assign(__ds_scope, { ThemeToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/ThemeToggle.jsx", error: String((e && e.message) || e) }); }

// components/app/TitleBar.jsx
try { (() => {
/**
 * TitleBar — the custom window chrome: traffic-light dots, brand mark + name +
 * version, and minimize/close window controls. Glass surface; drag region.
 */
function TitleBar({
  title = 'repo-translator',
  version = 'v0.1.0',
  logoSrc = null,
  onMinimize,
  onClose,
  right = null,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      height: 44,
      padding: '0 14px',
      background: 'var(--surface-card)',
      borderBottom: '1px solid var(--border-subtle)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Light, {
    c: "#FF5F57",
    onClick: onClose
  }), /*#__PURE__*/React.createElement(Light, {
    c: "#FEBC2E",
    onClick: onMinimize
  }), /*#__PURE__*/React.createElement(Light, {
    c: "#28C840"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginLeft: 6
    }
  }, logoSrc && /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "",
    width: 20,
    height: 20,
    style: {
      borderRadius: 5
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 14,
      color: 'var(--text-primary)'
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-tertiary)'
    }
  }, version)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), right, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement(WinBtn, {
    onClick: onMinimize,
    label: "\u6700\u5C0F\u5316"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 6h8",
    stroke: "currentColor",
    strokeWidth: "1.4",
    strokeLinecap: "round"
  }))), /*#__PURE__*/React.createElement(WinBtn, {
    onClick: onClose,
    label: "\u5173\u95ED",
    danger: true
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 3l6 6M9 3l-6 6",
    stroke: "currentColor",
    strokeWidth: "1.4",
    strokeLinecap: "round"
  })))));
}
function Light({
  c,
  onClick
}) {
  return /*#__PURE__*/React.createElement("span", {
    onClick: onClick,
    style: {
      width: 12,
      height: 12,
      borderRadius: 999,
      background: c,
      cursor: onClick ? 'pointer' : 'default',
      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.18)'
    }
  });
}
function WinBtn({
  children,
  onClick,
  label,
  danger = false
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": label,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      border: 'none',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: hover ? danger ? 'var(--status-error)' : 'var(--surface-raised)' : 'transparent',
      color: hover && danger ? '#fff' : 'var(--text-secondary)',
      transition: 'background var(--dur-fast), color var(--dur-fast)'
    }
  }, children);
}
Object.assign(__ds_scope, { TitleBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/TitleBar.jsx", error: String((e && e.message) || e) }); }

// components/display/Badge.jsx
try { (() => {
/**
 * Badge — small status/category pill. Tone maps to the status color system;
 * a leading dot can be shown for live statuses.
 */
function Badge({
  children,
  tone = 'neutral',
  dot = false,
  soft = true,
  size = 'md',
  style = {}
}) {
  const tones = {
    neutral: {
      fg: 'var(--text-secondary)',
      bg: 'var(--status-muted-bg)',
      solid: 'var(--status-muted)'
    },
    accent: {
      fg: 'var(--accent)',
      bg: 'var(--accent-soft)',
      solid: 'var(--accent)'
    },
    success: {
      fg: 'var(--status-ok)',
      bg: 'var(--status-ok-bg)',
      solid: 'var(--status-ok)'
    },
    warning: {
      fg: 'var(--status-warn)',
      bg: 'var(--status-warn-bg)',
      solid: 'var(--status-warn)'
    },
    error: {
      fg: 'var(--status-error)',
      bg: 'var(--status-error-bg)',
      solid: 'var(--status-error)'
    }
  };
  const t = tones[tone] || tones.neutral;
  const sizes = {
    sm: {
      h: 20,
      fs: 11,
      px: 7
    },
    md: {
      h: 24,
      fs: 12,
      px: 9
    }
  };
  const s = sizes[size] || sizes.md;
  return /*#__PURE__*/React.createElement("span", {
    style: {
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
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 999,
      background: t.solid,
      flexShrink: 0
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/display/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Card — the frosted glass surface that nearly every panel sits on.
 * variant "glass" (translucent + blur) | "solid" (opaque elevated) | "outline".
 */
function Card({
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
      boxShadow: 'var(--shadow-card)'
    },
    solid: {
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-sm)'
    },
    outline: {
      background: 'transparent',
      border: '1px solid var(--border-default)'
    }
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      borderRadius: 16,
      ...(variants[variant] || variants.glass),
      ...(glow ? {
        boxShadow: 'var(--shadow-card), 0 0 40px -16px var(--accent-ring)'
      } : {}),
      ...(interactive ? {
        cursor: 'pointer',
        transform: hover ? 'translateY(-2px)' : 'none',
        borderColor: hover ? 'var(--border-strong)' : undefined,
        transition: 'transform var(--dur-base) var(--ease-out), border-color var(--dur-base), box-shadow var(--dur-base)'
      } : {}),
      ...style
    }
  }, rest), header && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `14px ${padding}px`,
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      padding
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Card.jsx", error: String((e && e.message) || e) }); }

// components/display/ProgressBar.jsx
try { (() => {
/**
 * ProgressBar — determinate (value 0–100) or indeterminate. Fill uses the
 * brand gradient. Shows an optional inline label/percentage.
 */
function ProgressBar({
  value = 0,
  indeterminate = false,
  label = null,
  showPct = false,
  height = 8,
  tone = 'brand',
  style = {}
}) {
  const fills = {
    brand: 'var(--gradient-brand)',
    success: 'var(--status-ok)',
    warning: 'var(--status-warn)'
  };
  const fill = fills[tone] || fills.brand;
  const pct = Math.max(0, Math.min(100, value));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      width: '100%',
      ...style
    }
  }, (label || showPct) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-secondary)'
    }
  }, label), showPct && !indeterminate && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-tertiary)'
    }
  }, Math.round(pct), "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height,
      borderRadius: 999,
      overflow: 'hidden',
      background: 'var(--surface-sunken)',
      border: '1px solid var(--border-subtle)'
    }
  }, indeterminate ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: '40%',
      borderRadius: 999,
      background: fill,
      animation: 'rt-indet 1.2s var(--ease-in-out) infinite'
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes rt-indet{0%{left:-40%}100%{left:100%}}')) : /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${pct}%`,
      borderRadius: 999,
      background: fill,
      boxShadow: '0 0 12px -2px var(--accent-ring)',
      transition: 'width var(--dur-base) var(--ease-out)'
    }
  })));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/display/StatCard.jsx
try { (() => {
/**
 * StatCard — a dashboard metric: big numeral, label, optional delta + icon.
 * Numerals use the display font with tabular figures.
 */
function StatCard({
  label,
  value,
  unit = '',
  sub = null,
  icon = null,
  accent = false,
  delta = null,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
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
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-secondary)',
      fontWeight: 500
    }
  }, label), icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 30,
      height: 30,
      borderRadius: 9,
      color: 'var(--accent)',
      background: 'var(--accent-soft)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 16,
      height: 16
    }
  }, icon))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 32,
      lineHeight: 1,
      letterSpacing: '-0.02em',
      color: 'var(--text-primary)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, value), unit && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, unit), delta != null && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 12,
      fontWeight: 600,
      color: delta >= 0 ? 'var(--status-ok)' : 'var(--status-error)'
    }
  }, delta >= 0 ? '↑' : '↓', " ", Math.abs(delta))), sub && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-tertiary)'
    }
  }, sub));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ConsoleLine.jsx
try { (() => {
/**
 * ConsoleLine — one row in the interactive debug console. Renders a timestamp,
 * a colored level tag, and the message in monospace. Use inside a dark console
 * surface (var(--console-bg)).
 */
function ConsoleLine({
  time,
  level = 'INFO',
  children,
  dim = false
}) {
  const levels = {
    INFO: 'var(--console-info)',
    WARN: 'var(--console-warn)',
    WARNING: 'var(--console-warn)',
    ERROR: 'var(--console-error)',
    DONE: 'var(--console-ok)',
    OK: 'var(--console-ok)'
  };
  const c = levels[level] || 'var(--console-info)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      padding: '2px 0',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      lineHeight: 1.7,
      opacity: dim ? 0.55 : 1
    }
  }, time && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--console-dim)',
      flexShrink: 0
    }
  }, time), /*#__PURE__*/React.createElement("span", {
    style: {
      color: c,
      fontWeight: 700,
      flexShrink: 0,
      width: 48
    }
  }, level), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--console-text)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    }
  }, children));
}
Object.assign(__ds_scope, { ConsoleLine });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ConsoleLine.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Spinner.jsx
try { (() => {
/**
 * Spinner — gentle continuous loading indicator. Optional brand gradient ring.
 */
function Spinner({
  size = 18,
  thickness = 2,
  tone = 'accent',
  style = {}
}) {
  const color = tone === 'accent' ? 'var(--accent)' : 'currentColor';
  return /*#__PURE__*/React.createElement("span", {
    role: "status",
    "aria-label": "\u52A0\u8F7D\u4E2D",
    style: {
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      border: `${thickness}px solid var(--border-default)`,
      borderTopColor: color,
      animation: 'rt-spin 0.7s linear infinite',
      ...style
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes rt-spin{to{transform:rotate(360deg)}}'));
}
Object.assign(__ds_scope, { Spinner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Spinner.jsx", error: String((e && e.message) || e) }); }

// components/feedback/StatusDot.jsx
try { (() => {
/**
 * StatusDot — a small colored dot with optional pulse, plus optional label.
 * The canonical "● 运行中 / 引擎已连接" indicator.
 */
function StatusDot({
  tone = 'ok',
  pulse = false,
  label = null,
  size = 8,
  style = {}
}) {
  const tones = {
    ok: 'var(--status-ok)',
    warn: 'var(--status-warn)',
    error: 'var(--status-error)',
    muted: 'var(--status-muted)',
    accent: 'var(--accent)'
  };
  const c = tones[tone] || tones.ok;
  const dot = /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      width: size,
      height: size,
      flexShrink: 0
    }
  }, pulse && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 999,
      background: c,
      animation: 'rt-pulse 1.6s var(--ease-out) infinite'
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes rt-pulse{0%{transform:scale(1);opacity:.55}70%{transform:scale(2.6);opacity:0}100%{opacity:0}}')), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      width: size,
      height: size,
      borderRadius: 999,
      background: c,
      boxShadow: `0 0 8px -1px ${c}`
    }
  }));
  if (!label) return dot;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 13,
      color: 'var(--text-secondary)',
      ...style
    }
  }, dot, label);
}
Object.assign(__ds_scope, { StatusDot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/StatusDot.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Button — repo-translator's primary action control.
 * Primary uses the brand gradient with an accent glow on hover; secondary is a
 * glass surface; ghost is transparent; danger uses the coral alert color.
 */
function Button({
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
    sm: {
      height: 30,
      padding: '0 12px',
      fontSize: 13,
      radius: 9,
      gap: 6,
      icon: 15
    },
    md: {
      height: 38,
      padding: '0 16px',
      fontSize: 14,
      radius: 11,
      gap: 8,
      icon: 17
    },
    lg: {
      height: 46,
      padding: '0 22px',
      fontSize: 15,
      radius: 13,
      gap: 9,
      icon: 19
    }
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
    transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), background var(--dur-base), color var(--dur-base)',
    transform: active && !isDisabled ? 'scale(0.97)' : 'scale(1)',
    opacity: isDisabled ? 0.55 : 1,
    userSelect: 'none'
  };
  const variants = {
    primary: {
      background: 'var(--gradient-brand)',
      color: 'var(--text-on-accent)',
      boxShadow: hover && !isDisabled ? '0 8px 28px -6px var(--accent-ring)' : '0 2px 10px -4px rgba(0,0,0,0.4)'
    },
    secondary: {
      background: hover && !isDisabled ? 'var(--surface-raised)' : 'var(--surface-card)',
      color: 'var(--text-primary)',
      borderColor: 'var(--border-default)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)'
    },
    ghost: {
      background: hover && !isDisabled ? 'var(--accent-soft)' : 'transparent',
      color: hover && !isDisabled ? 'var(--accent)' : 'var(--text-secondary)',
      borderColor: 'transparent'
    },
    danger: {
      background: hover && !isDisabled ? 'var(--status-error)' : 'var(--status-error-bg)',
      color: hover && !isDisabled ? '#fff' : 'var(--status-error)',
      borderColor: 'var(--status-error)'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: isDisabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    style: {
      ...base,
      ...(variants[variant] || variants.primary),
      ...style
    }
  }, rest), loading ? /*#__PURE__*/React.createElement(Spinner, {
    size: s.icon
  }) : icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: s.icon,
      height: s.icon
    }
  }, icon), children, iconRight && !loading && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: s.icon,
      height: s.icon
    }
  }, iconRight));
}
function Spinner({
  size = 16
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      border: '2px solid currentColor',
      borderTopColor: 'transparent',
      display: 'inline-block',
      animation: 'rt-spin 0.7s linear infinite'
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes rt-spin{to{transform:rotate(360deg)}}'));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/app/RepoCard.jsx
try { (() => {
const ico = (d, sw = 1.8) => /*#__PURE__*/React.createElement("svg", {
  width: "15",
  height: "15",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: sw,
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, d);
const ICON = {
  openDir: ico(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 13l3 3 5-6"
  }))),
  viewDocs: ico(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 2v6h6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 14h6M9 17h4"
  }))),
  configure: ico(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M3 6h18M3 12h18M3 18h12"
  }))),
  remove: ico(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
    points: "3 6 5 6 21 6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
  })))
};

/**
 * RepoCard — a tracked repository in the Repos list / Dashboard queue. Shows
 * name, kind (managed/external) badge, branch, last-sync, file count, and —
 * when syncing — a live progress row. Closes the loop after a sync with
 * one-click "打开目录" / "查看译文" actions, plus a 更多 menu for the rest.
 */
function RepoCard({
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
  style = {}
}) {
  const hasOutput = files > 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
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
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 38,
      height: 38,
      borderRadius: 10,
      flexShrink: 0,
      background: 'var(--accent-soft)',
      color: 'var(--accent)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "19",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 6a3 3 0 013-3h7l2 2h3a2 2 0 012 2v9a2 2 0 01-2 2H6a3 3 0 01-3-3V6z",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 16,
      color: 'var(--text-primary)'
    }
  }, name), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: kind === 'managed' ? 'accent' : 'neutral',
    size: "sm"
  }, kind), justFinished && !syncing && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "success",
    dot: true,
    size: "sm"
  }, "\u7FFB\u8BD1\u5B8C\u6210")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 5,
      fontSize: 12,
      color: 'var(--text-tertiary)',
      fontFamily: 'var(--font-mono)'
    }
  }, kind === 'managed' && /*#__PURE__*/React.createElement("span", null, "\u2387 ", branch), /*#__PURE__*/React.createElement("span", null, files, " \u4E2A\u6587\u4EF6"), /*#__PURE__*/React.createElement("span", null, "\u4E0A\u6B21\u540C\u6B65 ", lastSync))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexShrink: 0
    }
  }, syncing ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 12.5,
      color: 'var(--accent)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Spinner, {
    size: 14
  }), " \u540C\u6B65\u4E2D") : /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: "secondary",
    onClick: onSync
  }, "\u7ACB\u5373\u540C\u6B65"), /*#__PURE__*/React.createElement(MoreMenu, {
    onMore: onMore,
    items: [{
      id: 'configure',
      label: '排除项配置',
      icon: ICON.configure,
      onClick: onConfigure
    }, {
      id: 'remove',
      label: '移出跟踪',
      icon: ICON.remove,
      onClick: onRemove,
      danger: true
    }]
  }))), syncing && progress != null && /*#__PURE__*/React.createElement(__ds_scope.ProgressBar, {
    value: progress,
    label: currentFile || '正在翻译…',
    showPct: true
  }), !syncing && hasOutput && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      paddingTop: 12,
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: "ghost",
    icon: ICON.openDir,
    onClick: onOpenDir
  }, "\u6253\u5F00\u76EE\u5F55"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: "ghost",
    icon: ICON.viewDocs,
    onClick: onViewDocs
  }, "\u67E5\u770B\u8BD1\u6587")));
}
function MoreMenu({
  items = [],
  onMore
}) {
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
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "\u66F4\u591A\u64CD\u4F5C",
    title: "\u66F4\u591A\u64CD\u4F5C",
    onClick: () => {
      setOpen(o => !o);
      if (onMore) onMore();
    },
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
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
      transition: 'background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "5",
    cy: "12",
    r: "1.6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "1.6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "12",
    r: "1.6"
  }))), open && /*#__PURE__*/React.createElement("div", {
    role: "menu",
    style: {
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
      animation: 'rt-menu var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes rt-menu{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'), items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.id,
    type: "button",
    role: "menuitem",
    onClick: () => {
      setOpen(false);
      if (it.onClick) it.onClick();
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      padding: '9px 10px',
      borderRadius: 8,
      border: 'none',
      cursor: 'pointer',
      background: 'transparent',
      textAlign: 'left',
      fontFamily: 'var(--font-sans)',
      fontSize: 13.5,
      color: it.danger ? 'var(--status-error)' : 'var(--text-primary)'
    },
    onMouseEnter: e => {
      e.currentTarget.style.background = it.danger ? 'var(--status-error-bg)' : 'var(--surface-card)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.background = 'transparent';
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 15,
      height: 15
    }
  }, it.icon), it.label))));
}
Object.assign(__ds_scope, { RepoCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/RepoCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * IconButton — square, icon-only control for toolbars and window chrome.
 * Variants: ghost (default), solid (glass), accent (brand-tinted).
 */
function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  active = false,
  disabled = false,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const sizes = {
    sm: 28,
    md: 34,
    lg: 40
  };
  const dim = sizes[size] || sizes.md;
  const variants = {
    ghost: {
      background: active ? 'var(--accent-soft)' : hover ? 'var(--surface-card)' : 'transparent',
      color: active ? 'var(--accent)' : hover ? 'var(--text-primary)' : 'var(--text-secondary)',
      border: '1px solid transparent'
    },
    solid: {
      background: hover ? 'var(--surface-raised)' : 'var(--surface-card)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-subtle)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)'
    },
    accent: {
      background: hover ? 'var(--gradient-brand)' : 'var(--accent-soft)',
      color: hover ? 'var(--text-on-accent)' : 'var(--accent)',
      border: '1px solid transparent'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
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
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: Math.round(dim * 0.5),
      height: Math.round(dim * 0.5)
    }
  }, icon));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Input — text field with optional label, leading icon, suffix, and error.
 * Frosted surface, brand-ring focus.
 */
function Input({
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
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      width: fullWidth ? '100%' : undefined,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
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
      opacity: disabled ? 0.55 : 1
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 16,
      height: 16,
      color: 'var(--text-tertiary)',
      flexShrink: 0
    }
  }, icon), /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      background: 'transparent',
      outline: 'none',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: mono ? 13 : 14,
      color: 'var(--text-primary)'
    }
  }, rest)), suffix && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-tertiary)',
      flexShrink: 0
    }
  }, suffix)), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--status-error)'
    }
  }, error) : hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-tertiary)'
    }
  }, hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
/**
 * Select — custom dropdown matching the glass aesthetic. Used for the engine
 * picker (OpenAI / DeepSeek / Claude) and other enumerated settings.
 */
function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = '请选择',
  disabled = false,
  fullWidth = true,
  style = {}
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const selected = options.find(o => (o.value ?? o) === value);
  const selectedLabel = selected ? selected.label ?? selected : placeholder;
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      width: fullWidth ? '100%' : undefined,
      position: 'relative',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: disabled,
    onClick: () => setOpen(o => !o),
    style: {
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
      transition: 'border-color var(--dur-base), box-shadow var(--dur-base)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, selected && selected.icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 16,
      height: 16
    }
  }, selected.icon), selectedLabel), /*#__PURE__*/React.createElement(Chevron, {
    open: open
  })), open && /*#__PURE__*/React.createElement("div", {
    style: {
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
      animation: 'rt-pop var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes rt-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'), options.map(o => {
    const v = o.value ?? o;
    const l = o.label ?? o;
    const isSel = v === value;
    return /*#__PURE__*/React.createElement("div", {
      key: v,
      onClick: () => {
        onChange && onChange(v);
        setOpen(false);
      },
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '9px 10px',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 14,
        color: isSel ? 'var(--accent)' : 'var(--text-primary)',
        background: isSel ? 'var(--accent-soft)' : 'transparent'
      },
      onMouseEnter: e => {
        if (!isSel) e.currentTarget.style.background = 'var(--surface-card)';
      },
      onMouseLeave: e => {
        if (!isSel) e.currentTarget.style.background = 'transparent';
      }
    }, o.icon && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        width: 16,
        height: 16
      }
    }, o.icon), l);
  })));
}
function Chevron({
  open
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    style: {
      transition: 'transform var(--dur-base)',
      transform: open ? 'rotate(180deg)' : 'none',
      color: 'var(--text-tertiary)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 9l6 6 6-6",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Slider.jsx
try { (() => {
/**
 * Slider — range control for concurrency and polling interval. The filled
 * track uses the brand gradient; the value bubble shows the current number.
 */
function Slider({
  label,
  value = 0,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  unit = '',
  disabled = false,
  style = {}
}) {
  const pct = (value - min) / (max - min) * 100;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      width: '100%',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--accent)'
    }
  }, value, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--text-tertiary)',
      marginLeft: 2
    }
  }, unit))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 22,
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 6,
      borderRadius: 999,
      background: 'var(--surface-sunken)',
      border: '1px solid var(--border-subtle)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      width: `${pct}%`,
      height: 6,
      borderRadius: 999,
      background: 'var(--gradient-brand)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: `calc(${pct}% )`,
      transform: 'translateX(-50%)',
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: '#fff',
      border: '2px solid var(--accent)',
      boxShadow: '0 2px 8px -1px var(--accent-ring)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: min,
    max: max,
    step: step,
    value: value,
    disabled: disabled,
    onChange: e => onChange && onChange(Number(e.target.value)),
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      width: '100%',
      height: 22,
      margin: 0,
      opacity: 0,
      cursor: disabled ? 'not-allowed' : 'pointer'
    }
  })));
}
Object.assign(__ds_scope, { Slider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Slider.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
/**
 * Switch — toggle for booleans (theme, auto-sync, log filters as toggles).
 * On state fills with the brand gradient.
 */
function Switch({
  checked = false,
  onChange,
  label,
  disabled = false,
  size = 'md',
  style = {}
}) {
  const dims = {
    sm: {
      w: 34,
      h: 20,
      k: 14
    },
    md: {
      w: 42,
      h: 24,
      k: 18
    }
  };
  const d = dims[size] || dims.md;
  const pad = (d.h - d.k) / 2;
  const toggle = /*#__PURE__*/React.createElement("span", {
    role: "switch",
    "aria-checked": checked,
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
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
      transition: 'background var(--dur-base), box-shadow var(--dur-base)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: pad,
      left: checked ? d.w - d.k - pad : pad,
      width: d.k,
      height: d.k,
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      transition: 'left var(--dur-base) var(--ease-spring)'
    }
  }));
  if (!label) return toggle;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style
    }
  }, toggle, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--text-primary)'
    }
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/TagInput.jsx
try { (() => {
/**
 * TagInput — tag/chip input for exclude glob patterns. Type a pattern and
 * press Enter to add; click × to remove.
 */
function TagInput({
  label,
  tags = [],
  onChange,
  placeholder = '添加规则后回车…',
  mono = true,
  style = {}
}) {
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
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      width: '100%',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
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
      transition: 'border-color var(--dur-base), box-shadow var(--dur-base)'
    }
  }, tags.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
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
      color: 'var(--accent)'
    }
  }, t, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => removeAt(i),
    style: {
      display: 'inline-flex',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      color: 'var(--accent)',
      padding: 2,
      borderRadius: 5,
      lineHeight: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 6l12 12M18 6L6 18",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round"
  }))))), /*#__PURE__*/React.createElement("input", {
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Backspace' && !draft && tags.length) removeAt(tags.length - 1);
    },
    onFocus: () => setFocus(true),
    onBlur: () => {
      setFocus(false);
      commit();
    },
    placeholder: tags.length ? '' : placeholder,
    style: {
      flex: 1,
      minWidth: 90,
      height: 26,
      border: 'none',
      background: 'transparent',
      outline: 'none',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: 13,
      color: 'var(--text-primary)'
    }
  })));
}
Object.assign(__ds_scope, { TagInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TagInput.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavRail.jsx
try { (() => {
/**
 * NavRail — the left icon navigation rail. Each item shows an icon and label;
 * the active item gets a brand-tinted pill and an accent indicator bar.
 */
function NavRail({
  items = [],
  active,
  onSelect,
  footer = null,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      width: 200,
      padding: 12,
      borderRight: '1px solid var(--border-subtle)',
      height: '100%',
      boxSizing: 'border-box',
      ...style
    }
  }, items.map(it => /*#__PURE__*/React.createElement(NavItem, {
    key: it.id,
    item: it,
    active: it.id === active,
    onClick: () => onSelect && onSelect(it.id)
  })), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto'
    }
  }, footer));
}
function NavItem({
  item,
  active,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
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
      transition: 'background var(--dur-base), color var(--dur-base)'
    }
  }, active && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: -12,
      top: 10,
      bottom: 10,
      width: 3,
      borderRadius: 999,
      background: 'var(--gradient-brand)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 18,
      height: 18,
      flexShrink: 0
    }
  }, item.icon), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, item.label), item.badge != null && /*#__PURE__*/React.createElement("span", {
    style: {
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
      background: 'var(--accent)'
    }
  }, item.badge));
}
Object.assign(__ds_scope, { NavRail });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavRail.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
/**
 * Tabs — underline-style tab bar. Used inside content panels (e.g. a repo's
 * file tree vs. settings, or log-level views).
 */
function Tabs({
  tabs = [],
  active,
  onSelect,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--border-subtle)',
      ...style
    }
  }, tabs.map(t => {
    const id = t.id ?? t;
    const label = t.label ?? t;
    const isActive = id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      type: "button",
      onClick: () => onSelect && onSelect(id),
      style: {
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
        transition: 'color var(--dur-base)'
      }
    }, t.icon && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        width: 15,
        height: 15
      }
    }, t.icon), label, t.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)'
      }
    }, t.count), isActive && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 10,
        right: 10,
        bottom: -1,
        height: 2,
        borderRadius: 999,
        background: 'var(--gradient-brand)'
      }
    }));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop-app/AppShell.jsx
try { (() => {
/* global React */
// AppShell — composes TitleBar + NavRail + content + StatusBar + Console drawer.
// Reads design-system components off the global namespace.
const DS = window.RepoTranslatorDesignSystem_dab506;
function AppShell({
  page,
  onNav,
  theme,
  onTheme,
  logsOpen,
  onToggleLogs,
  children,
  consoleNode
}) {
  const {
    TitleBar,
    NavRail,
    StatusBar,
    ThemeToggle
  } = DS;
  const Ic = d => /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, d);
  const items = [{
    id: 'dashboard',
    label: '仪表盘',
    icon: Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "3",
      width: "7",
      height: "9",
      rx: "1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "14",
      y: "3",
      width: "7",
      height: "5",
      rx: "1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "14",
      y: "12",
      width: "7",
      height: "9",
      rx: "1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "16",
      width: "7",
      height: "5",
      rx: "1"
    })))
  }, {
    id: 'repos',
    label: '仓库管理',
    icon: Ic(/*#__PURE__*/React.createElement("path", {
      d: "M3 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"
    })),
    badge: 3
  }, {
    id: 'glossary',
    label: '术语表',
    icon: Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M4 19.5A2.5 2.5 0 016.5 17H20"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
    })))
  }, {
    id: 'usage',
    label: '用量统计',
    icon: Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "18",
      y1: "20",
      x2: "18",
      y2: "10"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "20",
      x2: "12",
      y2: "4"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "6",
      y1: "20",
      x2: "6",
      y2: "14"
    })))
  }, {
    id: 'settings',
    label: '系统设置',
    icon: Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7.7 1.6 1.6 0 01-3.2 0 1.6 1.6 0 00-2.7-.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-.7-2.7 1.6 1.6 0 010-3.2 1.6 1.6 0 00.7-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-.7 1.6 1.6 0 013.2 0 1.6 1.6 0 002.7.7l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8z"
    })))
  }, {
    id: 'logs',
    label: '调试台',
    icon: Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
      points: "4 17 10 11 4 5"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "19",
      x2: "20",
      y2: "19"
    })))
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      borderRadius: 0
    }
  }, /*#__PURE__*/React.createElement(TitleBar, {
    logoSrc: "../../assets/logo-mark.svg",
    version: "v0.1.0"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement(NavRail, {
    items: items,
    active: page,
    onSelect: onNav,
    footer: /*#__PURE__*/React.createElement(ThemeToggle, {
      theme: theme,
      onChange: onTheme
    })
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    key: page,
    className: "rt-page",
    style: {
      flex: 1,
      overflow: 'auto',
      padding: 28
    }
  }, children), logsOpen && consoleNode)), /*#__PURE__*/React.createElement(StatusBar, {
    engine: "DeepSeek",
    connected: true,
    cache: "\u6B63\u5E38",
    latency: 120,
    logsOpen: logsOpen,
    onToggleLogs: onToggleLogs
  }), /*#__PURE__*/React.createElement("style", null, '@media (prefers-reduced-motion: no-preference){.rt-page{animation:rt-page var(--dur-base) var(--ease-out)}}@keyframes rt-page{from{opacity:.4;transform:translateY(6px)}to{opacity:1;transform:none}}'));
}
window.AppShell = AppShell;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop-app/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop-app/ConsoleScreen.jsx
try { (() => {
/* global React */
// ConsoleScreen / ConsoleDrawer — terminal-style log stream with level filters.
const RT_LOGS = [{
  t: '10:30:01',
  l: 'INFO',
  m: 'git pull langchain → a3f2c1d8e4b7f6a2'
}, {
  t: '10:30:02',
  l: 'INFO',
  m: 'markdown-it: parsed 5 blocks (3 text, 2 code)'
}, {
  t: '10:30:02',
  l: 'INFO',
  m: 'translate docs/intro.md (1/5) ...'
}, {
  t: '10:30:04',
  l: 'DONE',
  m: 'wrote output/langchain/intro_zh.md'
}, {
  t: '10:30:04',
  l: 'INFO',
  m: 'translate docs/guide.md (2/5) ...'
}, {
  t: '10:30:05',
  l: 'WARN',
  m: '429 rate-limited, backoff 2s'
}, {
  t: '10:30:07',
  l: 'INFO',
  m: 'retry docs/guide.md (2/5) ...'
}, {
  t: '10:30:09',
  l: 'ERROR',
  m: 'timeout on docs/api/reference.md, skipped'
}, {
  t: '10:30:10',
  l: 'DONE',
  m: 'wrote output/langchain/guide_zh.md'
}, {
  t: '10:30:11',
  l: 'INFO',
  m: 'cache hit README.md (blob unchanged)'
}];
function LogStream({
  ds,
  filters,
  height
}) {
  const {
    ConsoleLine
  } = ds;
  const ref = React.useRef(null);
  const rows = RT_LOGS.filter(r => filters[r.l] !== false && !(r.l === 'DONE' && filters.INFO === false));
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [filters]);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      background: 'var(--console-bg)',
      borderRadius: 12,
      border: '1px solid var(--border-subtle)',
      padding: '14px 16px',
      height,
      overflow: 'auto'
    }
  }, rows.map((r, i) => /*#__PURE__*/React.createElement(ConsoleLine, {
    key: i,
    time: r.t,
    level: r.l
  }, r.m)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      color: 'var(--console-dim)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--console-ok)'
    }
  }, "$"), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 15,
      background: 'var(--console-ok)',
      animation: 'rt-blink 1s step-end infinite'
    }
  })), /*#__PURE__*/React.createElement("style", null, '@keyframes rt-blink{50%{opacity:0}}'));
}
function FilterBar({
  filters,
  onToggle,
  ds
}) {
  const {
    Badge
  } = ds;
  const levels = [['INFO', 'accent'], ['WARN', 'warning'], ['ERROR', 'error']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-tertiary)'
    }
  }, "\u7EA7\u522B\u8FC7\u6EE4"), levels.map(([lvl, tone]) => {
    const on = filters[lvl] !== false;
    return /*#__PURE__*/React.createElement("button", {
      key: lvl,
      onClick: () => onToggle(lvl),
      style: {
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: 0,
        opacity: on ? 1 : 0.4
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: tone,
      dot: true,
      size: "sm"
    }, lvl));
  }));
}

// Full-screen variant (Logs nav page)
function ConsoleScreen({
  ds
}) {
  const {
    Button
  } = ds;
  const [filters, setFilters] = React.useState({});
  const toggle = l => setFilters(f => ({
    ...f,
    [l]: f[l] === false ? true : false
  }));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(window.PageHeader, {
    eyebrow: "DEBUG CONSOLE \xB7 \u4EA4\u4E92\u5F0F\u8C03\u8BD5\u53F0",
    title: "\u8C03\u8BD5\u53F0",
    desc: "\u5B9E\u65F6\u6D41\u5F0F\u663E\u793A Python \u540E\u53F0\u7684\u6267\u884C\u8FC7\u7A0B\u3002",
    actions: /*#__PURE__*/React.createElement(FilterBar, {
      filters: filters,
      onToggle: toggle,
      ds: ds
    })
  }), /*#__PURE__*/React.createElement(LogStream, {
    ds: ds,
    filters: filters,
    height: "calc(100vh - 290px)"
  }));
}

// Bottom drawer variant (toggled from StatusBar)
function ConsoleDrawer({
  ds
}) {
  const [filters, setFilters] = React.useState({});
  const toggle = l => setFilters(f => ({
    ...f,
    [l]: f[l] === false ? true : false
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border-default)',
      background: 'var(--surface-sunken)',
      padding: '12px 16px',
      animation: 'rt-drawer var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 13,
      color: 'var(--text-primary)'
    }
  }, "\u5B9E\u65F6\u65E5\u5FD7\u9762\u677F"), /*#__PURE__*/React.createElement(FilterBar, {
    filters: filters,
    onToggle: toggle,
    ds: ds
  })), /*#__PURE__*/React.createElement(LogStream, {
    ds: ds,
    filters: filters,
    height: 180
  }), /*#__PURE__*/React.createElement("style", null, '@keyframes rt-drawer{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'));
}
window.ConsoleScreen = ConsoleScreen;
window.ConsoleDrawer = ConsoleDrawer;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop-app/ConsoleScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop-app/DashboardScreen.jsx
try { (() => {
/* global React */
// DashboardScreen — status cards, quick actions, live activity queue.
function DashboardScreen({
  ds
}) {
  const {
    StatCard,
    Card,
    Button,
    RepoCard,
    StatusDot
  } = ds;
  const Ic = d => /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, d);
  const folder = Ic(/*#__PURE__*/React.createElement("path", {
    d: "M3 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"
  }));
  const file = Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 2v6h6"
  })));
  const zap = Ic(/*#__PURE__*/React.createElement("path", {
    d: "M13 2L3 14h7l-1 8 10-12h-7z"
  }));
  const play = Ic(/*#__PURE__*/React.createElement("polygon", {
    points: "6 4 20 12 6 20 6 4"
  }));
  const stop = Ic(/*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "6",
    width: "12",
    height: "12",
    rx: "2"
  }));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(window.PageHeader, {
    eyebrow: "SYNC STATUS \xB7 \u540C\u6B65\u72B6\u6001",
    title: "\u4EEA\u8868\u76D8",
    desc: "\u8DDF\u8E2A 3 \u4E2A\u4ED3\u5E93\uFF0C\u5F15\u64CE\u8FD0\u884C\u4E2D \xB7 API \u5EF6\u8FDF 120ms",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(window.PageHeaderStatus, {
      ds: ds
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 16,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "\u8DDF\u8E2A\u4ED3\u5E93\u6570",
    value: 3,
    unit: "\u4E2A",
    icon: folder
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "\u7FFB\u8BD1\u6587\u4EF6\u6570",
    value: 24,
    unit: "\u4E2A",
    sub: "\u672C\u6708\u65B0\u589E 6",
    delta: 6,
    icon: file
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "\u672C\u6708\u6D88\u8017 Token",
    value: "1.2M",
    sub: "\u7EA6 $0.15",
    accent: true,
    icon: zap
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "\u5E73\u5747\u5EF6\u8FDF",
    value: "120",
    unit: "ms",
    sub: "DeepSeek \xB7 \u5065\u5EB7"
  })), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 22
    },
    padding: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 16,
      color: 'var(--text-primary)'
    }
  }, "\u5FEB\u901F\u5F00\u59CB"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)',
      marginTop: 4
    }
  }, "\u5BF9\u6240\u6709\u8DDF\u8E2A\u4ED3\u5E93\u6267\u884C\u4E00\u6B21\u589E\u91CF\u540C\u6B65\uFF0C\u6216\u505C\u6B62\u5168\u90E8\u4EFB\u52A1\u3002")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: play
  }, "\u5168\u91CF\u540C\u6B65"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: stop
  }, "\u505C\u6B62\u5168\u90E8")))), /*#__PURE__*/React.createElement("div", {
    className: "rt-eyebrow",
    style: {
      marginBottom: 12
    }
  }, "LIVE QUEUE \xB7 \u5B9E\u65F6\u6D3B\u52A8\u76D1\u63A7"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(RepoCard, {
    name: "langchain",
    kind: "managed",
    branch: "main",
    lastSync: "2\u5206\u949F\u524D",
    files: 23,
    syncing: true,
    progress: 40,
    currentFile: "docs/guide.md (2/5)"
  }), /*#__PURE__*/React.createElement(RepoCard, {
    name: "fastapi-docs",
    kind: "managed",
    branch: "master",
    lastSync: "\u521A\u521A",
    files: 12,
    syncing: true,
    progress: 78,
    currentFile: "advanced/security.md (7/9)"
  }), /*#__PURE__*/React.createElement(RepoCard, {
    name: "my-project",
    kind: "external",
    lastSync: "1\u5C0F\u65F6\u524D",
    files: 5,
    justFinished: true,
    onOpenDir: () => {},
    onViewDocs: () => {}
  })));
}
function PageHeaderStatus({
  ds
}) {
  const {
    StatusDot
  } = ds;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      height: 38,
      padding: '0 14px',
      borderRadius: 11,
      background: 'var(--status-ok-bg)',
      border: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement(StatusDot, {
    tone: "ok",
    pulse: true
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--status-ok)'
    }
  }, "\u8FD0\u884C\u4E2D"));
}
window.DashboardScreen = DashboardScreen;
window.PageHeaderStatus = PageHeaderStatus;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop-app/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop-app/GlossaryScreen.jsx
try { (() => {
/* global React */
// GlossaryScreen — editable term table + exclude-pattern tag input.
function GlossaryScreen({
  ds
}) {
  const {
    Card,
    Button,
    TagInput,
    Badge,
    Input
  } = ds;
  const [terms, setTerms] = React.useState([{
    en: 'repository',
    zh: '仓库'
  }, {
    en: 'commit',
    zh: '提交'
  }, {
    en: 'pull request',
    zh: '拉取请求'
  }, {
    en: 'token',
    zh: 'Token'
  }, {
    en: 'embedding',
    zh: '向量嵌入'
  }]);
  const [excludes, setExcludes] = React.useState(['CHANGELOG.md', 'LICENSE.md', '**/node_modules/**']);
  const [editing, setEditing] = React.useState(null);
  const Ic = d => /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, d);
  const plus = Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  })));
  const imp = Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 10 12 15 17 10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "15",
    x2: "12",
    y2: "3"
  })));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(window.PageHeader, {
    eyebrow: "GLOSSARY & RULES \xB7 \u672F\u8BED\u8868\u4E0E\u89C4\u5219",
    title: "\u672F\u8BED\u8868",
    desc: "\u7EDF\u4E00\u7FFB\u8BD1\u7528\u8BCD\uFF0C\u53CC\u51FB\u5355\u5143\u683C\u5373\u53EF\u7F16\u8F91\u3002",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: imp
    }, "\u5BFC\u5165 CSV"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: plus,
      onClick: () => setTerms([{
        en: '',
        zh: ''
      }, ...terms])
    }, "\u65B0\u589E\u672F\u8BED"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: 16,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "solid",
    padding: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 60px',
      padding: '11px 16px',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--text-tertiary)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u539F\u6587 (EN)"), /*#__PURE__*/React.createElement("span", null, "\u8BD1\u6587 (ZH)"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "\u64CD\u4F5C")), terms.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 60px',
      padding: '11px 16px',
      borderBottom: i < terms.length - 1 ? '1px solid var(--border-subtle)' : 'none',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Cell, {
    value: t.en,
    mono: true,
    editing: editing === `${i}-en`,
    onEdit: () => setEditing(`${i}-en`),
    onCommit: v => {
      const n = [...terms];
      n[i] = {
        ...n[i],
        en: v
      };
      setTerms(n);
      setEditing(null);
    },
    placeholder: "english term"
  }), /*#__PURE__*/React.createElement(Cell, {
    value: t.zh,
    editing: editing === `${i}-zh`,
    onEdit: () => setEditing(`${i}-zh`),
    onCommit: v => {
      const n = [...terms];
      n[i] = {
        ...n[i],
        zh: v
      };
      setTerms(n);
      setEditing(null);
    },
    placeholder: "\u4E2D\u6587\u8BD1\u6CD5"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setTerms(terms.filter((_, idx) => idx !== i)),
    "aria-label": "\u5220\u9664",
    style: {
      width: 28,
      height: 28,
      borderRadius: 7,
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      color: 'var(--text-tertiary)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "3 6 5 6 21 6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
  }))))))), /*#__PURE__*/React.createElement(Card, {
    padding: 18
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 15,
      color: 'var(--text-primary)',
      marginBottom: 6
    }
  }, "\u6392\u9664\u6A21\u5F0F"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 14px',
      fontSize: 12.5,
      color: 'var(--text-secondary)'
    }
  }, "\u5339\u914D\u7684\u6587\u4EF6\u4E0D\u4F1A\u88AB\u7FFB\u8BD1\u3002\u652F\u6301 glob \u89C4\u5219\u3002"), /*#__PURE__*/React.createElement(TagInput, {
    tags: excludes,
    onChange: setExcludes
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral",
    size: "sm"
  }, excludes.length, " \u6761\u89C4\u5219"), /*#__PURE__*/React.createElement(Badge, {
    tone: "accent",
    size: "sm"
  }, "\u5DF2\u751F\u6548")))));
}
function Cell({
  value,
  mono,
  editing,
  onEdit,
  onCommit,
  placeholder
}) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value, editing]);
  if (editing) {
    return /*#__PURE__*/React.createElement("input", {
      autoFocus: true,
      value: draft,
      onChange: e => setDraft(e.target.value),
      onBlur: () => onCommit(draft),
      onKeyDown: e => {
        if (e.key === 'Enter') onCommit(draft);
      },
      placeholder: placeholder,
      style: {
        width: '90%',
        height: 30,
        padding: '0 8px',
        borderRadius: 7,
        border: '1px solid var(--accent)',
        background: 'var(--surface-sunken)',
        outline: 'none',
        color: 'var(--text-primary)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: 13
      }
    });
  }
  return /*#__PURE__*/React.createElement("span", {
    onDoubleClick: onEdit,
    title: "\u53CC\u51FB\u7F16\u8F91",
    style: {
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: 13.5,
      color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
      cursor: 'text'
    }
  }, value || placeholder);
}
window.GlossaryScreen = GlossaryScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop-app/GlossaryScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop-app/Modal.jsx
try { (() => {
/* global React */
// Modal — shared glass dialog with backdrop. Used by the kit screens.
function Modal({
  title,
  children,
  footer,
  onClose,
  ds,
  width = 480
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 'var(--z-modal)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(2,6,12,0.55)',
      backdropFilter: 'blur(3px)',
      WebkitBackdropFilter: 'blur(3px)',
      animation: 'rt-fade var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width,
      maxWidth: '92vw',
      borderRadius: 20,
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-default)',
      backdropFilter: 'var(--blur-strong)',
      WebkitBackdropFilter: 'var(--blur-strong)',
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden',
      animation: 'rt-modal var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 16,
      color: 'var(--text-primary)'
    },
    "data-comment-anchor": "6fd523a26a-span-25-11"
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "\u5173\u95ED",
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      color: 'var(--text-secondary)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 6l12 12M18 6L6 18",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10,
      padding: '14px 20px',
      borderTop: '1px solid var(--border-subtle)'
    }
  }, footer)), /*#__PURE__*/React.createElement("style", null, '@keyframes rt-fade{from{opacity:0}to{opacity:1}}@keyframes rt-modal{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}'));
}
window.Modal = Modal;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop-app/Modal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop-app/PageHeader.jsx
try { (() => {
/* global React */
// PageHeader — shared section title + optional eyebrow + actions row.
function PageHeader({
  eyebrow,
  title,
  desc,
  actions
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", null, eyebrow && /*#__PURE__*/React.createElement("div", {
    className: "rt-eyebrow",
    style: {
      marginBottom: 8
    }
  }, eyebrow), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 26,
      letterSpacing: '-0.02em',
      color: 'var(--text-primary)'
    }
  }, title), desc && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '6px 0 0',
      fontSize: 13.5,
      color: 'var(--text-secondary)'
    }
  }, desc)), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexShrink: 0
    }
  }, actions));
}
window.PageHeader = PageHeader;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop-app/PageHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop-app/ReposScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* global React */
// ReposScreen — repo list + a selected repo's file tree, plus add-repo modal.
function ReposScreen({
  ds
}) {
  const {
    RepoCard,
    Button,
    Card,
    Tabs,
    Badge,
    StatusDot,
    Input,
    Select
  } = ds;
  const [selected, setSelected] = React.useState('langchain');
  const [tab, setTab] = React.useState('all');
  const [adding, setAdding] = React.useState(false);
  const [kind, setKind] = React.useState('managed');
  const [toast, setToast] = React.useState(null);
  const tRef = React.useRef(null);
  function notify(msg) {
    setToast(msg);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(null), 2600);
  }
  function repoActions(repo) {
    return {
      onSync: () => notify('开始同步 ' + repo + ' …'),
      onOpenDir: () => notify('在文件管理器中打开 ~/.repo-translator/output/' + repo + '/'),
      onViewDocs: () => notify('打开 ' + repo + ' 的译文（*_zh.md）'),
      onConfigure: () => notify('配置 ' + repo + ' 的排除规则'),
      onRemove: () => notify('已将 ' + repo + ' 移出跟踪')
    };
  }
  const Ic = d => /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, d);
  const plus = Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  })));
  const files = [{
    p: 'README.md',
    s: 'done'
  }, {
    p: 'docs/intro.md',
    s: 'done'
  }, {
    p: 'docs/guide.md',
    s: 'pending'
  }, {
    p: 'docs/api/reference.md',
    s: 'pending'
  }, {
    p: 'CHANGELOG.md',
    s: 'excluded'
  }, {
    p: 'examples/quickstart.md',
    s: 'done'
  }];
  const filtered = tab === 'all' ? files : files.filter(f => tab === 'pending' ? f.s === 'pending' : f.s === 'excluded');
  const tone = {
    done: 'success',
    pending: 'warning',
    excluded: 'neutral'
  };
  const fileLabel = {
    done: '已翻译',
    pending: '待同步',
    excluded: '已排除'
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(window.PageHeader, {
    eyebrow: "REPOSITORIES \xB7 \u4ED3\u5E93\u7BA1\u7406",
    title: "\u4ED3\u5E93\u7BA1\u7406",
    desc: "\u8DDF\u8E2A 3 \u4E2A\u4ED3\u5E93 \xB7 2 \u4E2A Managed\uFF0C1 \u4E2A External",
    actions: /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: plus,
      onClick: () => setAdding(true)
    }, "\u6DFB\u52A0\u4ED3\u5E93")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setSelected('langchain'),
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(RepoCard, _extends({
    name: "langchain",
    kind: "managed",
    branch: "main",
    lastSync: "2\u5206\u949F\u524D",
    files: 23,
    justFinished: true
  }, repoActions('langchain'), {
    style: selected === 'langchain' ? {
      outline: '2px solid var(--accent)',
      outlineOffset: 2
    } : {}
  }))), /*#__PURE__*/React.createElement("div", {
    onClick: () => setSelected('fastapi-docs'),
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(RepoCard, _extends({
    name: "fastapi-docs",
    kind: "managed",
    branch: "master",
    lastSync: "\u521A\u521A",
    files: 12
  }, repoActions('fastapi-docs'), {
    style: selected === 'fastapi-docs' ? {
      outline: '2px solid var(--accent)',
      outlineOffset: 2
    } : {}
  }))), /*#__PURE__*/React.createElement("div", {
    onClick: () => setSelected('my-project'),
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(RepoCard, _extends({
    name: "my-project",
    kind: "external",
    lastSync: "1\u5C0F\u65F6\u524D",
    files: 5
  }, repoActions('my-project'), {
    style: selected === 'my-project' ? {
      outline: '2px solid var(--accent)',
      outlineOffset: 2
    } : {}
  })))), /*#__PURE__*/React.createElement(Card, {
    variant: "solid",
    padding: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 16,
      color: 'var(--text-primary)'
    }
  }, selected), /*#__PURE__*/React.createElement(Badge, {
    tone: "accent",
    size: "sm"
  }, selected === 'my-project' ? 'external' : 'managed')), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    active: tab,
    onSelect: setTab,
    tabs: [{
      id: 'all',
      label: '全部',
      count: files.length
    }, {
      id: 'pending',
      label: '待同步',
      count: 2
    }, {
      id: 'excluded',
      label: '已排除',
      count: 1
    }]
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 8
    }
  }, filtered.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.p,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '9px 12px',
      borderRadius: 9
    }
  }, /*#__PURE__*/React.createElement(StatusDot, {
    tone: f.s === 'done' ? 'ok' : f.s === 'pending' ? 'warn' : 'muted'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      color: f.s === 'excluded' ? 'var(--text-tertiary)' : 'var(--text-primary)'
    }
  }, f.p), /*#__PURE__*/React.createElement(Badge, {
    tone: tone[f.s],
    size: "sm"
  }, fileLabel[f.s])))))), adding && /*#__PURE__*/React.createElement(window.Modal, {
    title: "\u6DFB\u52A0\u4ED3\u5E93",
    onClose: () => setAdding(false),
    ds: ds,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => setAdding(false)
    }, "\u53D6\u6D88"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setAdding(false)
    }, "\u6DFB\u52A0\u5E76\u540C\u6B65"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, [['managed', 'Managed (Git URL)'], ['external', 'External (本地目录)']].map(([id, lbl]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => setKind(id),
    style: {
      flex: 1,
      padding: '14px 16px',
      borderRadius: 12,
      cursor: 'pointer',
      textAlign: 'left',
      background: kind === id ? 'var(--accent-soft)' : 'var(--surface-sunken)',
      border: `1px solid ${kind === id ? 'var(--accent)' : 'var(--border-default)'}`,
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16,
      height: 16,
      borderRadius: 999,
      border: `5px solid ${kind === id ? 'var(--accent)' : 'var(--border-strong)'}`,
      background: 'var(--bg-elevated)',
      boxSizing: 'border-box'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      fontSize: 14
    }
  }, lbl))))), kind === 'managed' ? /*#__PURE__*/React.createElement(Input, {
    label: "\u4ED3\u5E93 URL",
    mono: true,
    placeholder: "https://github.com/org/repo.git"
  }) : /*#__PURE__*/React.createElement(Input, {
    label: "\u672C\u5730\u76EE\u5F55",
    mono: true,
    placeholder: "/Users/me/code/my-project",
    suffix: "\u6D4F\u89C8\u2026",
    hint: "\u652F\u6301\u62D6\u62FD\u6587\u4EF6\u5939\u5230\u6B64\u5904"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "\u8F93\u51FA\u76EE\u5F55",
    mono: true,
    placeholder: "~/.repo-translator/output/",
    suffix: "\u6D4F\u89C8\u2026",
    hint: "\u8BD1\u6587\u5199\u5165\u4F4D\u7F6E\uFF0C\u9ED8\u8BA4\u5728\u7F13\u5B58\u76EE\u5F55\u4E0B\u6309\u4ED3\u5E93\u540D\u955C\u50CF\uFF1B\u53EF\u6307\u5B9A\u5230\u4ED3\u5E93\u5185\u6216\u81EA\u5B9A\u4E49\u8DEF\u5F84\u3002"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "\u76EE\u6807\u8BED\u8A00",
    value: "zh",
    onChange: () => {},
    options: [{
      value: 'zh',
      label: '简体中文 (zh)'
    }, {
      value: 'zh-tw',
      label: '繁體中文 (zh-tw)'
    }]
  }))), toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      bottom: 52,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 'var(--z-toast)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '11px 16px',
      borderRadius: 12,
      maxWidth: '70vw',
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-default)',
      backdropFilter: 'var(--blur-strong)',
      WebkitBackdropFilter: 'var(--blur-strong)',
      boxShadow: 'var(--shadow-lg)',
      animation: 'rt-toast var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: 'var(--status-ok)',
      boxShadow: '0 0 8px -1px var(--status-ok)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)'
    }
  }, toast), /*#__PURE__*/React.createElement("style", null, '@keyframes rt-toast{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}')));
}
window.ReposScreen = ReposScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop-app/ReposScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop-app/SettingsScreen.jsx
try { (() => {
/* global React */
// SettingsScreen — engine config with sliding fields + API connectivity test.
function SettingsScreen({
  ds
}) {
  const {
    Card,
    Select,
    Input,
    Button,
    Slider,
    Switch,
    StatusDot
  } = ds;
  const [engine, setEngine] = React.useState('deepseek');
  const [concurrency, setConcurrency] = React.useState(4);
  const [interval, setIntervalH] = React.useState(6);
  const [autoSync, setAutoSync] = React.useState(true);
  const [test, setTest] = React.useState('idle'); // idle | testing | ok | fail

  const baseUrls = {
    openai: 'https://api.openai.com/v1',
    deepseek: 'https://api.deepseek.com',
    claude: 'https://api.anthropic.com'
  };
  const models = {
    openai: 'gpt-4o-mini',
    deepseek: 'deepseek-chat',
    claude: 'claude-3-5-sonnet'
  };
  function runTest() {
    setTest('testing');
    setTimeout(() => setTest(Math.random() > 0.15 ? 'ok' : 'fail'), 1100);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720
    }
  }, /*#__PURE__*/React.createElement(window.PageHeader, {
    eyebrow: "SETTINGS \xB7 \u7CFB\u7EDF\u8BBE\u7F6E",
    title: "\u7CFB\u7EDF\u8BBE\u7F6E",
    desc: "\u914D\u7F6E\u7FFB\u8BD1\u5F15\u64CE\u3001\u5E76\u53D1\u4E0E\u540C\u6B65\u9891\u7387\u3002"
  }), /*#__PURE__*/React.createElement(Card, {
    padding: 22,
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 15,
      color: 'var(--text-primary)',
      marginBottom: 16
    }
  }, "\u7FFB\u8BD1\u5F15\u64CE"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "\u5F15\u64CE",
    value: engine,
    onChange: v => {
      setEngine(v);
      setTest('idle');
    },
    options: [{
      value: 'openai',
      label: 'OpenAI'
    }, {
      value: 'deepseek',
      label: 'DeepSeek'
    }, {
      value: 'claude',
      label: 'Claude'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    key: engine,
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16,
      animation: 'rt-slidein var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "API Key",
    mono: true,
    type: "password",
    placeholder: "sk-xxxxxxxxxxxx"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Model",
    mono: true,
    placeholder: models[engine]
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Base URL",
    mono: true,
    placeholder: baseUrls[engine],
    style: {
      gridColumn: '1 / -1'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    loading: test === 'testing',
    onClick: runTest
  }, "\u6D4B\u8BD5\u8FDE\u63A5"), test === 'ok' && /*#__PURE__*/React.createElement(StatusDot, {
    tone: "ok",
    label: "\u8FDE\u63A5\u6210\u529F \xB7 \u5EF6\u8FDF 118ms"
  }), test === 'fail' && /*#__PURE__*/React.createElement(StatusDot, {
    tone: "error",
    label: "\u8FDE\u63A5\u5931\u8D25 \xB7 401 Unauthorized"
  }), test === 'idle' && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-tertiary)'
    }
  }, "\u70B9\u51FB\u8FDB\u884C\u4E00\u6B21\u8F7B\u91CF\u7EA7 API \u8C03\u7528")))), /*#__PURE__*/React.createElement(Card, {
    padding: 22
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 15,
      color: 'var(--text-primary)',
      marginBottom: 16
    }
  }, "\u5E76\u53D1\u4E0E\u540C\u6B65"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 24,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Slider, {
    label: "\u5E76\u53D1\u7FFB\u8BD1\u6570",
    value: concurrency,
    onChange: setConcurrency,
    min: 1,
    max: 10,
    unit: "\u4E2A"
  }), /*#__PURE__*/React.createElement(Slider, {
    label: "\u540E\u53F0\u8F6E\u8BE2\u95F4\u9694",
    value: interval,
    onChange: setIntervalH,
    min: 1,
    max: 24,
    unit: "h"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      paddingTop: 18,
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, "\u5F00\u542F\u81EA\u52A8\u540C\u6B65"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-secondary)',
      marginTop: 3
    }
  }, "\u6309\u8F6E\u8BE2\u95F4\u9694\u5728\u540E\u53F0\u81EA\u52A8\u68C0\u67E5\u5E76\u7FFB\u8BD1\u66F4\u65B0\u3002")), /*#__PURE__*/React.createElement(Switch, {
    checked: autoSync,
    onChange: setAutoSync
  }))), /*#__PURE__*/React.createElement("style", null, '@keyframes rt-slidein{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}'));
}
window.SettingsScreen = SettingsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop-app/SettingsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/desktop-app/UsageScreen.jsx
try { (() => {
/* global React */
// UsageScreen — Token consumption statistics: monthly summary, daily trend
// bar chart, per-engine split, and per-repo breakdown with cost estimates.
function UsageScreen({
  ds
}) {
  const {
    StatCard,
    Card,
    Badge,
    ProgressBar,
    Select
  } = ds;
  const [range, setRange] = React.useState('30d');
  const Ic = d => /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, d);
  const zap = Ic(/*#__PURE__*/React.createElement("path", {
    d: "M13 2L3 14h7l-1 8 10-12h-7z"
  }));
  const coin = Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14.5 9.5a2.5 2.5 0 00-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 1.8 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2a2.5 2.5 0 01-2.5-1.5M12 6v1.5M12 16.5V18"
  })));
  const file = Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 2v6h6"
  })));
  const calc = Ic(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "2",
    width: "16",
    height: "20",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "6",
    x2: "16",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "10",
    x2: "8",
    y2: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "10",
    x2: "12",
    y2: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "10",
    x2: "16",
    y2: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "14",
    x2: "8",
    y2: "14"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "14",
    x2: "12",
    y2: "14"
  })));

  // Mock daily token usage (in thousands of tokens) for the trend chart.
  const daily = [42, 58, 31, 0, 12, 88, 76, 64, 95, 120, 47, 33, 28, 61, 84, 102, 58, 0, 19, 73, 91, 110, 67, 52, 44, 80, 96, 71, 38, 63];
  const maxDay = Math.max(...daily);
  const engines = [{
    name: 'DeepSeek',
    tone: 'accent',
    tokens: '0.82M',
    pct: 68,
    cost: '$0.08'
  }, {
    name: 'Claude',
    tone: 'success',
    tokens: '0.28M',
    pct: 23,
    cost: '$0.05'
  }, {
    name: 'OpenAI',
    tone: 'warning',
    tokens: '0.10M',
    pct: 9,
    cost: '$0.02'
  }];
  const repos = [{
    name: 'langchain',
    files: 23,
    tokens: '0.64M',
    pct: 53,
    cost: '$0.07'
  }, {
    name: 'fastapi-docs',
    files: 12,
    tokens: '0.31M',
    pct: 26,
    cost: '$0.04'
  }, {
    name: 'my-project',
    files: 5,
    tokens: '0.25M',
    pct: 21,
    cost: '$0.04'
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(window.PageHeader, {
    eyebrow: "TOKEN USAGE \xB7 \u7528\u91CF\u7EDF\u8BA1",
    title: "\u7528\u91CF\u7EDF\u8BA1",
    desc: "\u6309\u5F15\u64CE\u4E0E\u4ED3\u5E93\u8FFD\u8E2A Token \u6D88\u8017\u4E0E\u6210\u672C\u4F30\u7B97\u3002",
    actions: /*#__PURE__*/React.createElement("div", {
      style: {
        width: 150
      }
    }, /*#__PURE__*/React.createElement(Select, {
      value: range,
      onChange: setRange,
      fullWidth: true,
      options: [{
        value: '7d',
        label: '近 7 天'
      }, {
        value: '30d',
        label: '近 30 天'
      }, {
        value: 'all',
        label: '全部'
      }]
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 16,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "\u672C\u6708\u6D88\u8017 Token",
    value: "1.2M",
    sub: "\u8F83\u4E0A\u6708 +18%",
    delta: 18,
    accent: true,
    icon: zap
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "\u672C\u6708\u6210\u672C\u4F30\u7B97",
    value: "$0.15",
    sub: "\u7EA6 \xA51.08",
    icon: coin
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "\u5DF2\u7FFB\u8BD1\u6587\u4EF6",
    value: 40,
    unit: "\u4E2A",
    sub: "\u5E73\u5747 30K Token/\u6587\u4EF6",
    icon: file
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "\u5355\u6587\u4EF6\u5747\u4EF7",
    value: "$0.004",
    sub: "\u2248 \xA50.027",
    icon: calc
  })), /*#__PURE__*/React.createElement(Card, {
    padding: 20,
    style: {
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 15,
      color: 'var(--text-primary)'
    }
  }, "\u6BCF\u65E5 Token \u6D88\u8017"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-tertiary)',
      fontFamily: 'var(--font-mono)'
    }
  }, "\u5355\u4F4D\uFF1A\u5343 Token (K)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 4,
      height: 160
    }
  }, daily.map((v, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    title: `第 ${i + 1} 天 · ${v}K`,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: `${Math.max(2, v / maxDay * 100)}%`,
      borderRadius: '4px 4px 2px 2px',
      background: v === maxDay ? 'var(--gradient-brand)' : v === 0 ? 'var(--border-subtle)' : 'var(--accent-soft)',
      border: v === maxDay ? 'none' : '1px solid var(--border-subtle)',
      boxShadow: v === maxDay ? '0 0 16px -2px var(--accent-ring)' : 'none',
      transition: 'height var(--dur-base) var(--ease-out)'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 10,
      fontSize: 11,
      color: 'var(--text-tertiary)',
      fontFamily: 'var(--font-mono)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "30 \u5929\u524D"), /*#__PURE__*/React.createElement("span", null, "\u5CF0\u503C ", maxDay, "K \xB7 \u7B2C 10 \u5929"), /*#__PURE__*/React.createElement("span", null, "\u4ECA\u5929"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1.4fr',
      gap: 16,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: 20
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 15,
      color: 'var(--text-primary)',
      marginBottom: 16
    }
  }, "\u6309\u5F15\u64CE"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, engines.map(e => /*#__PURE__*/React.createElement("div", {
    key: e.name
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: e.tone,
    dot: true,
    size: "sm"
  }, e.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      color: 'var(--text-secondary)'
    }
  }, e.tokens, " \xB7 ", e.cost)), /*#__PURE__*/React.createElement(ProgressBar, {
    value: e.pct,
    tone: e.tone === 'accent' ? 'brand' : e.tone === 'success' ? 'success' : 'warning',
    height: 6
  }))))), /*#__PURE__*/React.createElement(Card, {
    variant: "solid",
    padding: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.4fr 0.7fr 1fr 0.8fr',
      padding: '12px 18px',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--text-tertiary)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u4ED3\u5E93"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "\u6587\u4EF6"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "Token"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right'
    }
  }, "\u6210\u672C")), repos.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: r.name,
    style: {
      padding: '12px 18px',
      borderBottom: i < repos.length - 1 ? '1px solid var(--border-subtle)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.4fr 0.7fr 1fr 0.8fr',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 14,
      color: 'var(--text-primary)'
    }
  }, r.name), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      color: 'var(--text-secondary)'
    }
  }, r.files), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      color: 'var(--text-primary)'
    }
  }, r.tokens), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      color: 'var(--accent)'
    }
  }, r.cost)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 9
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: r.pct,
    height: 4
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.4fr 0.7fr 1fr 0.8fr',
      padding: '12px 18px',
      alignItems: 'center',
      background: 'var(--surface-sunken)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, "\u5408\u8BA1"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      color: 'var(--text-secondary)'
    }
  }, "40"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      color: 'var(--text-primary)'
    }
  }, "1.2M"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right',
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--accent)'
    }
  }, "$0.15")))));
}
window.UsageScreen = UsageScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/desktop-app/UsageScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.RepoCard = __ds_scope.RepoCard;

__ds_ns.StatusBar = __ds_scope.StatusBar;

__ds_ns.ThemeToggle = __ds_scope.ThemeToggle;

__ds_ns.TitleBar = __ds_scope.TitleBar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.ConsoleLine = __ds_scope.ConsoleLine;

__ds_ns.Spinner = __ds_scope.Spinner;

__ds_ns.StatusDot = __ds_scope.StatusDot;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Slider = __ds_scope.Slider;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.TagInput = __ds_scope.TagInput;

__ds_ns.NavRail = __ds_scope.NavRail;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
