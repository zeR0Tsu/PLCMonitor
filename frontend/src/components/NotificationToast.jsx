import React, { useCallback, useEffect, useRef, useState } from 'react';

const styles = {
  container: {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '360px',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontSize: '13px',
    animation: 'slideIn 0.3s ease',
    color: '#fff',
  },
  error: {
    backgroundColor: '#F44336',
  },
  success: {
    backgroundColor: '#4CAF50',
  },
  info: {
    backgroundColor: '#2196F3',
  },
  close: {
    marginLeft: 'auto',
    cursor: 'pointer',
    opacity: 0.8,
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '16px',
  },
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
        <div
          key={toast.id}
          style={{
            ...styles.toast,
            ...styles[toast.type] || styles.info,
          }}
        >
          <span>{toast.message}</span>
          <button style={styles.close} onClick={() => removeToast(toast.id)}>
            x
          </button>
        </div>
      ))}
    </div>
  );
}
