import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import useSocket from '../hooks/useSocket';
import RealtimeChart from '../components/RealtimeChart';
import ConnectionStatus from '../components/ConnectionStatus';
import NotificationToast, { useToast } from '../components/NotificationToast';
import { formatValue } from '../utils/chartOptions';

// 30 分钟 @ 10Hz
const MAX_POINTS = 18000;
const HISTORY_WINDOW_MS = 30 * 60 * 1000;

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    backgroundColor: '#1a237e',
    color: '#fff',
    fontSize: '14px',
  },
  topBarTitle: {
    fontSize: '16px',
    fontWeight: 600,
  },
  topBarActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  btn: {
    padding: '6px 16px',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '4px',
    background: 'transparent',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '240px',
    backgroundColor: '#fff',
    borderRight: '1px solid #e0e0e0',
    overflow: 'auto',
    flexShrink: 0,
  },
  sidebarToolbar: {
    padding: '12px',
    borderBottom: '1px solid #e0e0e0',
    fontSize: '13px',
    fontWeight: 600,
    color: '#666',
  },
  treeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px 6px 28px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  treeItemSelected: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
    accentColor: '#1a237e',
  },
  contentArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    padding: '16px',
  },
  chartToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  timeBtn: {
    padding: '4px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s',
  },
  timeBtnActive: {
    backgroundColor: '#1a237e',
    color: '#fff',
    borderColor: '#1a237e',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: '#999',
    fontSize: '16px',
  },
  plcSelector: {
    padding: '4px 12px',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '4px',
    background: '#1a237e',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  statusRow: {
    padding: '8px 12px',
    borderBottom: '1px solid #f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectBtn: {
    padding: '2px 8px',
    fontSize: '11px',
    border: '1px solid #4CAF50',
    borderRadius: '3px',
    background: '#fff',
    cursor: 'pointer',
    color: '#4CAF50',
  },
  disconnectBtn: {
    padding: '2px 8px',
    fontSize: '11px',
    border: '1px solid #ddd',
    borderRadius: '3px',
    background: '#fff',
    cursor: 'pointer',
    color: '#F44336',
  },
};

const TIME_WINDOWS = [
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
  { label: '30m', value: 1800 },
];

function appendData(buffer, rows, timestamp) {
  for (const item of rows) {
    const vid = item.variableId;
    if (!buffer.has(vid)) buffer.set(vid, []);
    const arr = buffer.get(vid);
    arr.push({
      timestamp,
      value: item.value,
      quality: item.quality,
    });
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

  // 加载配置
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

  // 拉取当前 PLC 的历史数据，填充较长时间窗口
  useEffect(() => {
    if (!activePlcId || !socket.connected) return;
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

  // 接收实时数据
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

  // 连接状态变化：只在"已连接 -> 断开"时提示，避免启动时刷屏
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
    return <div style={{ ...styles.emptyState, height: '100vh' }}>正在加载配置...</div>;
  }

  const activePlc = config.plcs?.find((p) => p.id === activePlcId);
  const statusKnown = socket.connectionStatuses.some((s) => s.plcId === activePlcId);
  const activeStatus = socket.connectionStatuses.find((s) => s.plcId === activePlcId);
  const isConnected = activeStatus?.connected || false;
  const isConnecting = connectingPlcs.has(activePlcId);

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={styles.topBarTitle}>PLCMonitor</div>
          {config.plcs?.length > 0 && (
            <select
              style={styles.plcSelector}
              value={activePlcId || ''}
              onChange={(e) => handlePlcChange(e.target.value)}
            >
              {config.plcs.map((p) => (
                <option key={p.id} value={p.id} style={{ color: '#333', background: '#fff' }}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div style={styles.topBarActions}>
          <button style={styles.btn} onClick={() => onNavigate('config')}>配置</button>
        </div>
      </div>

      <ConnectionStatus
        connectionStatuses={socket.connectionStatuses}
        socketConnected={socket.connected}
        plcs={config.plcs}
      />

      <div style={styles.body}>
        <div style={styles.sidebar}>
          <div style={styles.sidebarToolbar}>
            监视变量
            {activePlc && (
              <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px' }}>- {activePlc.name}</span>
            )}
          </div>

          {activePlcId && (
            <div style={styles.statusRow}>
              <span style={{ fontSize: '12px', color: '#666' }}>
                状态：
                <span style={{ color: !statusKnown ? '#999' : isConnected ? '#4CAF50' : '#F44336', fontWeight: 600 }}>
                  {!statusKnown ? '获取中...' : isConnected ? '已连接' : isConnecting ? '连接中...' : '未连接'}
                </span>
              </span>
              {isConnected ? (
                <button style={styles.disconnectBtn} onClick={() => handleDisconnect(activePlcId)}>断开</button>
              ) : (
                <button
                  style={{ ...styles.connectBtn, background: isConnecting ? '#e8f5e9' : '#fff' }}
                  onClick={() => handleConnect(activePlcId)}
                  disabled={isConnecting}
                >
                  {isConnecting ? '连接中...' : '连接'}
                </button>
              )}
            </div>
          )}

          {activePlcVars.map((v) => {
            const data = bufferData.get(v.id);
            const latest = data && data.length > 0 ? data[data.length - 1] : null;
            return (
              <div
                key={v.id}
                style={{
                  ...styles.treeItem,
                  ...(selectedVariables.has(v.id) ? styles.treeItemSelected : {}),
                }}
                onClick={() => toggleVariable(v.id)}
              >
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={selectedVariables.has(v.id)}
                  onChange={() => toggleVariable(v.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span>{v.name}</span>
                <span style={{ marginLeft: 'auto', color: '#666', fontSize: '12px' }}>
                  {formatValue(latest?.value)}
                </span>
              </div>
            );
          })}

          {activePlcId && activePlcVars.length === 0 && (
            <div style={{ padding: '16px', color: '#999', fontSize: '13px', textAlign: 'center' }}>
              该 PLC 暂无变量
            </div>
          )}
          {!activePlcId && (
            <div style={{ padding: '16px', color: '#999', fontSize: '13px', textAlign: 'center' }}>
              请先在配置页面添加 PLC
            </div>
          )}
        </div>

        <div style={styles.contentArea}>
          <div style={styles.chartToolbar}>
            {TIME_WINDOWS.map((tw) => (
              <button
                key={tw.value}
                style={{ ...styles.timeBtn, ...(timeWindow === tw.value ? styles.timeBtnActive : {}) }}
                onClick={() => setTimeWindow(tw.value)}
              >
                {tw.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              style={{
                ...styles.timeBtn,
                backgroundColor: paused ? '#ff9800' : '#fff',
                color: paused ? '#fff' : '#333',
                borderColor: paused ? '#ff9800' : '#ddd',
              }}
              onClick={togglePause}
            >
              {paused ? '继续' : '暂停'}
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
        </div>
      </div>

      <NotificationToast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
