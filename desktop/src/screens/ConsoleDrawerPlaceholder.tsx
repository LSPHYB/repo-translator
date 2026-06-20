/**
 * ConsoleDrawerPlaceholder — stand-in for the bottom log drawer
 * (`ConsoleDrawer` in ui_kits/desktop-app/ConsoleScreen.jsx), toggled from
 * StatusBar's "实时日志面板" button via AppShell's `logsOpen`/`consoleNode`.
 *
 * Task 7/8 replaces this with the real ConsoleDrawer (live log stream +
 * level filters). This task only needs the drawer to open/close visibly.
 */
export default function ConsoleDrawerPlaceholder() {
  return (
    <div
      style={{
        borderTop: '1px solid var(--border-default)',
        background: 'var(--surface-sunken)',
        padding: '12px 16px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        color: 'var(--text-tertiary)',
      }}
    >
      console drawer placeholder
    </div>
  );
}
