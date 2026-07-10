import React, { useEffect, useState } from 'react';

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

  const addToast = (message, type = 'info', duration = 5000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

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
