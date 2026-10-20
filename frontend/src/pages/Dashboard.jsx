import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import useSocket from '../hooks/useSocket';
import RealtimeChart from '../components/RealtimeChart';
import ConnectionStatus from '../components/ConnectionStatus';
import NotificationToast, { useToast } from '../components/NotificationToast';
import { formatValue } from '../utils/chartOptions';
import { colors, radius, header, brand, brandMark, button, select, dot } from '../styles/theme';

// 30 分钟 @ 10Hz
const MAX_POINTS = 18000;
const HISTORY_WINDOW_MS = 30 * 60 * 1000;

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  divider: {
    width: '1px',
    height: '20px',
    backgroundColor: colors.border,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  socketBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: colors.textSecondary,
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '264px',
    backgroundColor: colors.surface,
    borderRight: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 10px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  plcCard: {
    margin: '0 12px 8px',
    padding: '10px 12px',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  plcCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  plcName: {
    fontSize: '13px',
    fontWeight: 600,
    color: colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusText: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    color: colors.textSecondary,
  },
  plcCardBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '8px',
  },
  plcAddress: {
    fontSize: '11px',
    color: colors.textMuted,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  variableList: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 8px 12px',
  },
  variableRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    height: '36px',
    padding: '0 8px',
    borderRadius: radius.sm,
    cursor: 'pointer',
    fontSize: '13px',
    color: colors.textSecondary,
  },
  variableRowActive: {
    color: colors.text,
  },
  checkbox: {
    width: '14px',
    height: '14px',
    cursor: 'pointer',
    accentColor: colors.text,
    flexShrink: 0,
  },
  variableValue: {
    marginLeft: 'auto',
    fontSize: '12px',
    fontWeight: 500,
    color: colors.text,
    fontVariantNumeric: 'tabular-nums',
  },
  sidebarEmpty: {
    padding: '20px 16px',
    color: colors.textMuted,
    fontSize: '12px',
    textAlign: 'center',
    lineHeight: 1.7,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    padding: '20px 24px 28px',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  segmented: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  segBtn: {
    height: '26px',
    padding: '0 12px',
    border: 'none',
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  segBtnActive: {
    backgroundColor: colors.text,
    color: '#ffffff',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textMuted,
    fontSize: '13px',
    border: `1px dashed ${colors.borderStrong}`,
    borderRadius: radius.lg,
    minHeight: '240px',
  },
};

const TIME_WINDOWS = [
  { label: '30 秒', value: 30 },
  { label: '1 分钟', value: 60 },
  { label: '5 分钟', value: 300 },
  { label: '30 分钟', value: 1800 },
];

function appendData(buffer, rows, timestamp) {
  for (const item of rows) {
    const vid = item.variableId;
    if (!buffer.has(vid)) buffer.set(vid, []);
    const arr = buffer.get(vid);
    arr.push({ timestamp, value: item.value, quality: item.quality });
    if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
  }
}

export default function Dashboard({ onNavigate }) {
  const socket = useSocket();
  const { toasts, addToast, removeToast } = useToast();
  const [config, setConfig] = useState(null);
  const [activePlcId, setActivePlcId] = useState(null);
  const [selectedVariables, setSelectedVariables] = useState(() => new Set());
  const [connectingPlcs, setConnectingPlcs] = useState(() => new Set());
  const [timeWindow, setTimeWindow] = useState(30);
  const [bufferData, setBufferData] = useState(() => new Map());
  const [paused, setPaused] = useState(false);

  const pausedRef = useRef(false);
  const pausedQueueRef = useRef([]);
  const prevConnectedRef = useRef(new Map());

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const mergeHistory = useCallback((entries) => {
    setBufferData((prev) => {
      const next = new Map(prev);
      const grouped = new Map();
      for (const item of entries) {
        if (!grouped.has(item.variableId)) grouped.set(item.variableId, new Map());
        grouped.get(item.variableId).set(item.timestamp, item);
      }
      for (const [vid, incoming] of grouped) {
        const merged = new Map();
        for (const row of next.get(vid) || []) merged.set(row.timestamp, row);
        for (const row of incoming.values()) merged.set(row.timestamp, row);
        next.set(
          vid,
          Array.from(merged.values())
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-MAX_POINTS)
        );
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/config')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((cfg) => {
        if (cancelled) return;
        setConfig(cfg);
        const firstPlc = cfg.plcs?.[0];
        if (firstPlc) {
          setActivePlcId(firstPlc.id);
          const ids = (cfg.variables || []).filter((v) => v.plcId === firstPlc.id).map((v) => v.id);
          setSelectedVariables(new Set(ids));
        }
      })
      .catch((err) => {
        console.error('加载配置失败:', err);
        addToast('无法读取配置，请检查后端服务', 'error', 0);
      });
    return () => { cancelled = true; };
  }, [addToast]);

  useEffect(() => {
    if (!activePlcId || !socket.connected) return undefined;
    let cancelled = false;
    const variables = (config?.variables || []).filter((v) => v.plcId === activePlcId);
    const end = Date.now();
    const start = end - HISTORY_WINDOW_MS;

    Promise.all(variables.map((v) => socket.requestHistory(v.id, start, end)))
      .then((responses) => {
        if (cancelled) return;
        const entries = [];
        for (const result of responses) {
          for (const row of result?.data || []) {
            entries.push({ variableId: result.variableId, ...row });
          }
        }
        if (entries.length > 0) mergeHistory(entries);
      })
      .catch((err) => console.error('加载历史数据失败:', err));

    return () => { cancelled = true; };
  }, [activePlcId, config, socket.connected, socket.requestHistory, mergeHistory]);

  useEffect(() => {
    const unsub = socket.on('data-update', (data) => {
      if (!data?.values) return;
      if (pausedRef.current) {
        pausedQueueRef.current.push(data);
        if (pausedQueueRef.current.length > MAX_POINTS) pausedQueueRef.current.shift();
        return;
      }
      setBufferData((prev) => {
        const next = new Map(prev);
        appendData(next, data.values, data.timestamp);
        return next;
      });
    });
    return unsub;
  }, [socket.on]);

  useEffect(() => {
    const unsub = socket.on('connection-status', (statuses) => {
      if (!Array.isArray(statuses)) return;
      for (const status of statuses) {
        const wasConnected = prevConnectedRef.current.get(status.plcId);
        if (wasConnected && !status.connected && status.error !== '已手动断开') {
          const plc = config?.plcs?.find((p) => p.id === status.plcId);
          addToast(`${plc?.name || status.plcId} 连接已断开${status.error ? `：${status.error}` : ''}`, 'error', 6000);
        }
        prevConnectedRef.current.set(status.plcId, status.connected);
      }
    });
    return unsub;
  }, [socket.on, config, addToast]);

  const handlePlcChange = useCallback((plcId) => {
    setActivePlcId(plcId);
    const plcVars = (config?.variables || []).filter((v) => v.plcId === plcId);
    setSelectedVariables(new Set(plcVars.map((v) => v.id)));
    setBufferData(new Map());
    pausedQueueRef.current = [];
  }, [config]);

  const plcName = useCallback(
    (id) => config?.plcs?.find((p) => p.id === id)?.name || id,
    [config]
  );

  const handleConnect = useCallback(async (plcId) => {
    setConnectingPlcs((prev) => new Set(prev).add(plcId));
    try {
      const result = await socket.connectPlc(plcId);
      if (result.success) addToast(`${plcName(plcId)} 连接成功`, 'success', 3000);
      else addToast(`${plcName(plcId)} 连接失败：${result.error}`, 'error', 8000);
    } finally {
      setConnectingPlcs((prev) => {
        const next = new Set(prev);
        next.delete(plcId);
        return next;
      });
    }
  }, [socket, addToast, plcName]);

  const handleDisconnect = useCallback(async (plcId) => {
    await socket.disconnectPlc(plcId);
    prevConnectedRef.current.set(plcId, false);
    addToast(`${plcName(plcId)} 已断开`, 'info', 3000);
  }, [socket, addToast, plcName]);

  const toggleVariable = useCallback((varId) => {
    setSelectedVariables((prev) => {
      const next = new Set(prev);
      if (next.has(varId)) next.delete(varId);
      else next.add(varId);
      return next;
    });
  }, []);

  const togglePause = () => {
    if (paused) {
      const queue = pausedQueueRef.current;
      pausedQueueRef.current = [];
      if (queue.length > 0) {
        setBufferData((prev) => {
          const next = new Map(prev);
          for (const data of queue) appendData(next, data.values, data.timestamp);
          return next;
        });
      }
    }
    setPaused((prev) => !prev);
  };

  const activePlcVars = useMemo(
    () => (config?.variables || []).filter((v) => v.plcId === activePlcId),
    [config, activePlcId]
  );

  const activePlcCharts = useMemo(
    () => (config?.charts || []).filter((chart) => chart.plcId === activePlcId),
    [config, activePlcId]
  );

  const chartsToRender = useMemo(() => {
    const withSelected = activePlcCharts.filter((chart) =>
      (chart.variableIds || []).some((vid) => selectedVariables.has(vid))
    );
    if (withSelected.length > 0) return withSelected;

    const selected = activePlcVars.filter((v) => selectedVariables.has(v.id)).map((v) => v.id);
    if (selected.length === 0) return [];
    return [{
      id: 'default',
      title: '实时数据',
      variableIds: selected,
      curveColors: {},
      timeWindow,
    }];
  }, [activePlcCharts, activePlcVars, selectedVariables, timeWindow]);

  if (!config) {
    return (
      <div style={{ ...styles.emptyState, height: '100vh', border: 'none' }}>
        正在加载配置...
      </div>
    );
  }

  const activePlc = config.plcs?.find((p) => p.id === activePlcId);
  const statusKnown = socket.connectionStatuses.some((s) => s.plcId === activePlcId);
  const activeStatus = socket.connectionStatuses.find((s) => s.plcId === activePlcId);
  const isConnected = activeStatus?.connected || false;
  const isConnecting = connectingPlcs.has(activePlcId);
  const statusLabel = !statusKnown ? '获取中' : isConnected ? '已连接' : isConnecting ? '连接中' : '未连接';

  return (
    <div style={styles.container}>
      <header style={header}>
        <div style={styles.headerLeft}>
          <div style={brand}>
            <span style={brandMark}>PL</span>
            PLCMonitor
          </div>
          <span style={styles.divider} />
          <select
            style={{ ...select, minWidth: '150px' }}
            value={activePlcId || ''}
            onChange={(e) => handlePlcChange(e.target.value)}
            aria-label="选择 PLC"
          >
            {config.plcs?.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.socketBadge}>
            <span style={dot(
              socket.connected === null
                ? colors.warning
                : socket.connected ? colors.success : colors.danger
            )} />
            {socket.connected === null ? '连接中' : socket.connected ? '服务在线' : '服务离线'}
          </span>
          <button style={button.ghost} onClick={() => onNavigate('config')}>配置</button>
        </div>
      </header>

      <ConnectionStatus
        connectionStatuses={socket.connectionStatuses}
        socketConnected={socket.connected}
        plcs={config.plcs}
      />

      <div style={styles.body}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <span>监视变量</span>
            <span style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 500 }}>
              {activePlcVars.length}
            </span>
          </div>

          {activePlc && (
            <div style={styles.plcCard}>
              <div style={styles.plcCardTop}>
                <span style={styles.plcName}>{activePlc.name}</span>
                <span style={{ ...styles.statusText, color: isConnected ? colors.success : colors.textMuted }}>
                  <span style={dot(isConnected ? colors.success : colors.textMuted)} />
                  {statusLabel}
                </span>
              </div>
              <div style={styles.plcCardBottom}>
                <span style={styles.plcAddress}>{activePlc.ip}</span>
                {isConnected ? (
                  <button
                    style={{ ...button.subtle, color: colors.danger, padding: '0 4px' }}
                    onClick={() => handleDisconnect(activePlcId)}
                  >
                    断开
                  </button>
                ) : (
                  <button
                    style={{ ...button.subtle, color: colors.accent, padding: '0 4px' }}
                    onClick={() => handleConnect(activePlcId)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? '连接中...' : '连接'}
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={styles.variableList}>
            {activePlcVars.map((v) => {
              const data = bufferData.get(v.id);
              const latest = data && data.length > 0 ? data[data.length - 1] : null;
              const active = selectedVariables.has(v.id);
              return (
                <div
                  key={v.id}
                  style={{ ...styles.variableRow, ...(active ? styles.variableRowActive : {}) }}
                  onClick={() => toggleVariable(v.id)}
                >
                  <input
                    type="checkbox"
                    style={styles.checkbox}
                    checked={active}
                    onChange={() => toggleVariable(v.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`监视 ${v.name}`}
                  />
                  <span>{v.name}</span>
                  <span style={styles.variableValue}>{formatValue(latest?.value)}</span>
                </div>
              );
            })}

            {activePlcId && activePlcVars.length === 0 && (
              <div style={styles.sidebarEmpty}>该 PLC 暂无变量，请先在配置中添加</div>
            )}
            {!activePlcId && (
              <div style={styles.sidebarEmpty}>请先在配置页面添加 PLC</div>
            )}
          </div>
        </aside>

        <main style={styles.content}>
          <div style={styles.toolbar}>
            <div style={styles.segmented}>
              {TIME_WINDOWS.map((tw) => (
                <button
                  key={tw.value}
                  style={{ ...styles.segBtn, ...(timeWindow === tw.value ? styles.segBtnActive : {}) }}
                  onClick={() => setTimeWindow(tw.value)}
                >
                  {tw.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <button style={button.ghost} onClick={togglePause}>
              {paused ? '继续采集' : '暂停'}
            </button>
          </div>

          {selectedVariables.size === 0 || chartsToRender.length === 0 ? (
            <div style={styles.emptyState}>请在左侧选择要监视的变量</div>
          ) : (
            chartsToRender.map((chart) => (
              <RealtimeChart
                key={chart.id}
                chartDef={chart}
                variables={activePlcVars}
                bufferData={bufferData}
                timeWindow={timeWindow}
                connected={isConnected || !statusKnown}
              />
            ))
          )}
        </main>
      </div>

      <NotificationToast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
