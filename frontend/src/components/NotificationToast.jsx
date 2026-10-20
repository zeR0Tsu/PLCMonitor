import React, { useCallback, useEffect, useRef, useState } from 'react';
import { colors, radius } from '../styles/theme';

const styles = {
  container: {
    position: 'fixed',
    top: '68px',
    right: '20px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '380px',
  },
  toast: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 12px 10px 14px',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    boxShadow: '0 4px 16px rgba(16, 24, 40, 0.08)',
    fontSize: '12px',
    lineHeight: 1.5,
    color: colors.text,
    animation: 'toast-in 0.18s ease',
  },
  accent: {
    width: '3px',
    alignSelf: 'stretch',
    borderRadius: '2px',
    flexShrink: 0,
  },
  message: {
    flex: 1,
    paddingTop: '1px',
    wordBreak: 'break-word',
  },
  close: {
    border: 'none',
    background: 'transparent',
    color: colors.textMuted,
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    padding: '2px 4px',
    flexShrink: 0,
  },
};

const typeColor = {
  error: colors.danger,
  success: colors.success,
  info: colors.accent,
};

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    if (duration > 0) {
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
      timersRef.current.set(id, timer);
    }
  }, []);

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) clearTimeout(timer);
    timersRef.current.clear();
  }, []);

  return { toasts, addToast, removeToast };
}

export default function NotificationToast({ toasts, removeToast }) {
  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <div key={toast.id} style={styles.toast} role="status">
          <span style={{ ...styles.accent, backgroundColor: typeColor[toast.type] || colors.accent }} />
          <span style={styles.message}>{toast.message}</span>
          <button style={styles.close} onClick={() => removeToast(toast.id)} aria-label="关闭">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
