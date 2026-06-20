/**
 * Modal — shared glass dialog with backdrop. Used by the kit screens
 * (ReposScreen's add-repo dialog, etc).
 *
 * Ported from ui_kits/desktop-app/Modal.jsx (window.Modal global) — markup
 * and behavior unchanged, switched to a typed default export.
 *
 * Note: the mockup's call sites (e.g. ReposScreen.jsx) pass a `ds` prop
 * (the design-system namespace object) for parity with other screen
 * components, but Modal's own body never reads it. Kept as an optional prop
 * here for interface compatibility with ported call sites in later tasks.
 */
import type { ReactNode } from 'react';

export interface ModalProps {
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  /** Design-system namespace object, unused by Modal itself; kept for call-site parity. */
  ds?: unknown;
  width?: number;
}

export default function Modal({ title, children, footer, onClose, width = 480 }: ModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(2,6,12,0.55)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        animation: 'rt-fade var(--dur-base) var(--ease-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: '92vw',
          borderRadius: 20,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-default)',
          backdropFilter: 'var(--blur-strong)',
          WebkitBackdropFilter: 'var(--blur-strong)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          animation: 'rt-modal var(--dur-base) var(--ease-out)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{title}</span>
          <button
            onClick={onClose}
            aria-label="关闭"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
            {footer}
          </div>
        )}
      </div>
      <style>{'@keyframes rt-fade{from{opacity:0}to{opacity:1}}@keyframes rt-modal{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}'}</style>
    </div>
  );
}
