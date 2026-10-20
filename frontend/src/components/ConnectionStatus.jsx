import React from 'react';

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '6px 16px',
    fontSize: '12px',
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #e0e0e0',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '4px',
  },
  plcItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  alertBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#fff3e0',
    color: '#e65100',
    fontSize: '13px',
    borderBottom: '1px solid #ffe0b2',
  },
  alertIcon: {
    fontSize: '16px',
  },
  reconnectBtn: {
    marginLeft: 'auto',
    padding: '4px 12px',
    fontSize: '12px',
    border: '1px solid #e65100',
    borderRadius: '4px',
    background: '#fff',
    color: '#e65100',
    cursor: 'pointer',
  },
};

export default function ConnectionStatus({ connectionStatuses, socketConnected, plcs = [] }) {
  const plcName = (id) => plcs.find((p) => p.id === id)?.name || id;
  const disconnected = connectionStatuses.filter(
    (s) => !s.connected && s.error && s.error !== '已手动断开'
  );

  return (
    <>
      <div style={styles.bar}>
        <span>Socket: </span>
        <span style={{
          ...styles.dot,
          backgroundColor: socketConnected ? '#4CAF50' : '#F44336',
        }} />
        <span>{socketConnected ? '已连接' : '断开'}</span>

        {connectionStatuses.map((status) => (
          <div key={status.plcId} style={styles.plcItem}>
            <span style={{
              ...styles.dot,
              backgroundColor: status.connected ? '#4CAF50' : '#F44336',
            }} />
            <span>{plcName(status.plcId)}</span>
          </div>
        ))}
      </div>

      {disconnected.length > 0 && (
        <div style={styles.alertBar}>
          <span style={styles.alertIcon}>!</span>
          <span>
            {disconnected.map((d) => plcName(d.plcId)).join(', ')} 连接已断开
            {disconnected[0]?.error && disconnected[0].error !== '已手动断开' && (
              <span style={{ marginLeft: '8px', color: '#bf360c' }}>- {disconnected[0].error}</span>
            )}
          </span>
        </div>
      )}
    </>
  );
}
