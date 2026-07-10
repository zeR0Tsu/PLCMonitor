import React from 'react';

const styles = {
  card: {
    background: '#fff',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    textAlign: 'center',
    minWidth: '120px',
    transition: 'box-shadow 0.2s',
  },
  name: {
    fontSize: '12px',
    color: '#999',
    marginBottom: '8px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  value: {
    fontSize: '28px',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  unit: {
    fontSize: '14px',
    color: '#999',
    marginLeft: '4px',
  },
  disconnected: {
    color: '#ccc',
  },
};

export default function ValueCard({ variable, value, connected }) {
  const displayValue = connected && value !== null && value !== undefined
    ? (typeof value === 'number' ? value.toFixed(2) : value)
    : '--';

  return (
    <div style={styles.card}>
      <div style={styles.name}>
        {variable?.name || '未知变量'}
      </div>
      <div style={{
        ...styles.value,
        color: connected ? '#333' : '#ccc',
      }}>
        {displayValue}
        {variable?.unit && connected && value !== null && (
          <span style={styles.unit}>{variable.unit}</span>
        )}
      </div>
    </div>
  );
}
