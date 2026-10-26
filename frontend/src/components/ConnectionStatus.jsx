import React from 'react';
import { colors, radius } from '../styles/theme';

const styles = {
  stack: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 20px',
    backgroundColor: colors.warningSoft,
    borderBottom: `1px solid ${colors.border}`,
    color: colors.warning,
    fontSize: '12px',
  },
  errorBar: {
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '20px',
    padding: '0 7px',
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    fontSize: '11px',
    fontWeight: 500,
    flexShrink: 0,
  },
};

export default function ConnectionStatus({ connectionStatuses, socketConnected, plcs = [] }) {
  const plcName = (id) => plcs.find((p) => p.id === id)?.name || id;
  const disconnected = connectionStatuses.filter(
    (s) => !s.connected && s.error && s.error !== '已手动断开'
  );

  if (socketConnected !== false && disconnected.length === 0) return null;

  return (
    <div style={styles.stack}>
      {socketConnected === false && (
        <div style={styles.bar}>
          <span>实时服务连接已断开，正在自动重连...</span>
        </div>
      )}
      {disconnected.length > 0 && (
        <div style={{ ...styles.bar, ...styles.errorBar }}>
          <span style={styles.badge}>{disconnected.map((d) => plcName(d.plcId)).join('、')}</span>
          <span>{disconnected[0]?.error || '连接已断开'}</span>
        </div>
      )}
    </div>
  );
}
