/**
 * Type declarations for `./index.jsx` (the ported design-system bundle).
 *
 * The bundle itself stays plain JSX (1:1 port of the mockup's components —
 * see the file header in index.jsx), so TypeScript consumers need a shim.
 * Props are typed loosely (matching the JS components' actual permissiveness
 * — e.g. NavRail items take any icon/label shape) rather than over-specified;
 * tighten individual signatures here as later tasks need stricter typing.
 */
import type { ReactNode } from 'react';

export declare function StatusBar(props: {
  engine?: string;
  connected?: boolean;
  cache?: string;
  logsOpen?: boolean;
  onToggleLogs?: () => void;
  latency?: number | null;
  extra?: ReactNode;
  style?: React.CSSProperties;
}): JSX.Element;

export declare function ThemeToggle(props: {
  theme?: string;
  onChange?: (theme: string) => void;
  style?: React.CSSProperties;
}): JSX.Element;

export declare function TitleBar(props: {
  title?: string;
  version?: string;
  logoSrc?: string | null;
  onMinimize?: () => void;
  onClose?: () => void;
  right?: ReactNode;
  style?: React.CSSProperties;
}): JSX.Element;

export declare function Badge(props: {
  children?: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'error';
  dot?: boolean;
  soft?: boolean;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}): JSX.Element;

export declare function Card(props: {
  children?: ReactNode;
  variant?: 'glass' | 'solid' | 'outline';
  padding?: number;
  interactive?: boolean;
  glow?: boolean;
  header?: ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  [key: string]: unknown;
}): JSX.Element;

export declare function ProgressBar(props: {
  value?: number;
  indeterminate?: boolean;
  label?: ReactNode;
  showPct?: boolean;
  height?: number;
  tone?: 'brand' | 'success' | 'warning';
  style?: React.CSSProperties;
}): JSX.Element;

export declare function StatCard(props: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
  delta?: number | null;
  style?: React.CSSProperties;
}): JSX.Element;

export declare function ConsoleLine(props: {
  time?: ReactNode;
  level?: string;
  children?: ReactNode;
  dim?: boolean;
}): JSX.Element;

export declare function Spinner(props: {
  size?: number;
  thickness?: number;
  tone?: 'accent' | string;
  style?: React.CSSProperties;
}): JSX.Element;

export declare function StatusDot(props: {
  tone?: 'ok' | 'warn' | 'error' | 'muted' | 'accent';
  pulse?: boolean;
  label?: ReactNode;
  size?: number;
  style?: React.CSSProperties;
}): JSX.Element;

export declare function Button(props: {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
  [key: string]: unknown;
}): JSX.Element;

export declare function RepoCard(props: {
  name: ReactNode;
  kind?: 'managed' | 'external' | string;
  branch?: string;
  lastSync?: ReactNode;
  files?: number;
  syncing?: boolean;
  progress?: number | null;
  currentFile?: ReactNode;
  justFinished?: boolean;
  onSync?: () => void;
  onOpenDir?: () => void;
  onViewDocs?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
  onMore?: () => void;
  style?: React.CSSProperties;
}): JSX.Element;

export declare function IconButton(props: {
  icon: ReactNode;
  label?: string;
  variant?: 'ghost' | 'solid' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  [key: string]: unknown;
}): JSX.Element;

export declare function Input(props: {
  label?: ReactNode;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  mono?: boolean;
  fullWidth?: boolean;
  style?: React.CSSProperties;
  [key: string]: unknown;
}): JSX.Element;

export declare function Select(props: {
  label?: ReactNode;
  value?: unknown;
  onChange?: (value: unknown) => void;
  options?: Array<{ value?: unknown; label?: ReactNode; icon?: ReactNode } | string>;
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}): JSX.Element;

export declare function Slider(props: {
  label?: ReactNode;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  unit?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}): JSX.Element;

export declare function Switch(props: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}): JSX.Element;

export declare function TagInput(props: {
  label?: ReactNode;
  tags?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  mono?: boolean;
  style?: React.CSSProperties;
}): JSX.Element;

export interface NavRailItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  badge?: number | string | null;
}

export declare function NavRail(props: {
  items?: NavRailItem[];
  active?: string;
  onSelect?: (id: string) => void;
  footer?: ReactNode;
  style?: React.CSSProperties;
}): JSX.Element;

export declare function Tabs(props: {
  tabs?: Array<{ id?: string; label?: ReactNode; icon?: ReactNode; count?: number | null } | string>;
  active?: string;
  onSelect?: (id: string) => void;
  style?: React.CSSProperties;
}): JSX.Element;
