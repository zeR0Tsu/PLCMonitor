import React, { useEffect, useState, useRef, useCallback } from 'react';
import useSocket from '../hooks/useSocket';
import RealtimeChart from '../components/RealtimeChart';
import ConnectionStatus from '../components/ConnectionStatus';
import NotificationToast, { useToast } from '../components/NotificationToast';

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
    transition: 'background 0.2s',
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
  treeGroup: {
    borderBottom: '1px solid #f0f0f0',
  },
  treeGroupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    color: '#333',
    userSelect: 'none',
  },
  treeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px 6px 28px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'background 0.15s',
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
  valueCardsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
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

export default function Dashboard({ onNavigate }) {
  const socket = useSocket();
  const { toasts, addToast, removeToast } = useToast();
  const [config, setConfig] = useState(null);
  const [activePlcId, setActivePlcId] = useState(null);
  const [selectedVariables, setSelectedVariables] = useState(new Set());
  const [connectingPlcs, setConnectingPlcs] = useState(new Set());
  const [timeWindow, setTimeWindow] = useState(30);
  const [bufferData, setBufferData] = useState(new Map());
  const [paused, setPaused] = useState(false);
  const pausedDataRef = useRef(null);

  // 加载配置
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => {
        setConfig(cfg);
        if (cfg.plcs && cfg.plcs.length > 0) {
          setActivePlcId(cfg.plcs[0].id);
          const plcVars = cfg.variables.filter((v) => v.plcId === cfg.plcs[0].id);
          setSelectedVariables(new Set(plcVars.map((v) => v.id)));
        }
        socket.joinDashboard();
      })
      .catch((err) => {
        console.error('加载配置失败:', err);
        addToast('无法连接后端服务', 'error', 0);
      });
  }, []);

  // 接收实时数据
  useEffect(() => {
    const unsub = socket.on('data-update', (data) => {
      if (paused) {
        if (!pausedDataRef.current) pausedDataRef.current = [];
        pausedDataRef.current.push(data);
        return;
      }

      setBufferData((prev) => {
        const next = new Map(prev);
        for (const item of data.values) {
          const vid = item.variableId;
          if (!next.has(vid)) next.set(vid, []);
          const arr = next.get(vid);
          arr.push({ timestamp: data.timestamp, value: item.value, quality: item.quality });
          if (arr.length > 1800) arr.splice(0, arr.length - 1800);
        }
        return next;
      });
    });
    return () => unsub();
  }, [socket, paused]);

  // 连接状态变化通知
  useEffect(() => {
    const unsub = socket.on('connection-status', (statuses) => {
      const disconnected = statuses.filter((s) => !s.connected);
      disconnected.forEach((d) => {
        addToast(`PLC ${d.plcId} ${d.error || '连接断开'}`, 'error', 5000);
      });
    });
    return () => unsub();
  }, [socket, addToast]);

  // 切换 PLC
  const handlePlcChange = useCallback((plcId) => {
    setActivePlcId(plcId);
    // 选中新 PLC 的所有变量
    const plcVars = (config?.variables || []).filter((v) => v.plcId === plcId);
    setSelectedVariables(new Set(plcVars.map((v) => v.id)));
    // 清空缓冲区数据
    setBufferData(new Map());
  }, [config]);

  // 手动连接 PLC
  const handleConnect = useCallback(async (plcId) => {
    setConnectingPlcs((prev) => new Set(prev).add(plcId));
    const result = await socket.connectPlc(plcId);
    setConnectingPlcs((prev) => {
      const next = new Set(prev);
      next.delete(plcId);
      return next;
    });
    if (result.success) {
      addToast(`PLC ${plcId} 连接成功`, 'success', 3000);
    } else {
      addToast(`PLC ${plcId} 连接失败: ${result.error}`, 'error', 5000);
    }
  }, [socket, addToast]);

  // 手动断开 PLC
  const handleDisconnect = useCallback(async (plcId) => {
    await socket.disconnectPlc(plcId);
    addToast(`PLC ${plcId} 已断开`, 'info', 3000);
  }, [socket, addToast]);

  const toggleVariable = useCallback((varId) => {
    setSelectedVariables((prev) => {
      const next = new Set(prev);
      if (next.has(varId)) next.delete(varId);
      else next.add(varId);
      return next;
    });
  }, []);

  const togglePause = () => {
    setPaused((prev) => {
      if (prev) {
        const cached = pausedDataRef.current || [];
        pausedDataRef.current = null;
        if (cached.length > 0) {
          setBufferData((prevBuf) => {
            const next = new Map(prevBuf);
            for (const data of cached) {
              for (const item of data.values) {
                const vid = item.variableId;
                if (!next.has(vid)) next.set(vid, []);
                const arr = next.get(vid);
                arr.push({ timestamp: data.timestamp, value: item.value, quality: item.quality });
                if (arr.length > 1800) arr.splice(0, arr.length - 1800);
              }
            }
            return next;
          });
        }
      }
      return !prev;
    });
  };

  // 当前 PLC 的变量
  const activePlcVars = (config?.variables || []).filter((v) => v.plcId === activePlcId);

  // 当前 PLC 的图表
  const activePlcCharts = (config?.charts || []).filter(
    (chart) => chart.plcId === activePlcId
  );

  // 按选中变量过滤图表
  const visibleCharts = activePlcCharts.filter(
    (chart) => (chart.variableIds || []).some((vid) => selectedVariables.has(vid))
  );

  // 如果没有图表定义，创建一个默认图表
  const chartsToRender = visibleCharts.length > 0 ? visibleCharts : (activePlcId ? [{
    id: 'default',
    title: '实时数据',
    variableIds: Array.from(selectedVariables),
    curveColors: {},
    timeWindow,
  }] : []);

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={styles.topBarTitle}>PLCMonitor</div>
          {config?.plcs?.length > 0 && (
            <select
              style={styles.plcSelector}
              value={activePlcId || ''}
              onChange={(e) => handlePlcChange(e.target.value)}
            >
              {config.plcs.map((p) => (
                <option key={p.id} value={p.id} style={{ color: '#333', background: '#fff' }}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
        <div style={styles.topBarActions}>
          <button style={styles.btn} onClick={() => onNavigate('config')}>
            配置
          </button>
        </div>
      </div>

      <ConnectionStatus
        connectionStatuses={socket.connectionStatuses}
        socketConnected={socket.connected}
      />

      <div style={styles.body}>
        {/* 侧边栏 */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarToolbar}>
            监视变量
            {activePlcId && (
              <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px' }}>
                - {config?.plcs.find((p) => p.id === activePlcId)?.name || activePlcId}
              </span>
            )}
          </div>

          {/* 当前 PLC 的连接控制 */}
          {activePlcId && (() => {
            const plcStatus = socket.connectionStatuses.find((s) => s.plcId === activePlcId);
            const isConnected = plcStatus?.connected || false;
            const isConnecting = connectingPlcs.has(activePlcId);
            return (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>
                  状态：
                  <span style={{ color: isConnected ? '#4CAF50' : '#F44336', fontWeight: 600 }}>
                    {isConnected ? '已连接' : isConnecting ? '连接中...' : '未连接'}
                  </span>
                </span>
                {isConnected ? (
                  <button style={styles.disconnectBtn} onClick={() => handleDisconnect(activePlcId)}>
                    断开
                  </button>
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
            );
          })()}

          {/* 变量列表 */}
          {activePlcVars.map((v) => (
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
                onChange={() => {}}
              />
              <span>{v.name}</span>
              <span style={{ marginLeft: 'auto', color: '#666', fontSize: '12px' }}>
                {(() => {
                  const data = bufferData.get(v.id);
                  if (data && data.length > 0) {
                    const latest = data[data.length - 1];
                    return typeof latest.value === 'number'
                      ? latest.value.toFixed(2)
                      : latest.value ?? '--';
                  }
                  return '--';
                })()}
              </span>
            </div>
          ))}
          {activePlcId && activePlcVars.length === 0 && (
            <div style={{ padding: '16px', color: '#999', fontSize: '13px', textAlign: 'center' }}>
              该 PLC 暂无变量
            </div>
          )}
          {!activePlcId && (
            <div style={{ padding: '16px', color: '#999', fontSize: '13px', textAlign: 'center' }}>
              请先配置 PLC
            </div>
          )}
        </div>

        {/* 图表区域 */}
        <div style={styles.contentArea}>
          <div style={styles.chartToolbar}>
            {TIME_WINDOWS.map((tw) => (
              <button
                key={tw.value}
                style={{
                  ...styles.timeBtn,
                  ...(timeWindow === tw.value ? styles.timeBtnActive : {}),
                }}
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

          {selectedVariables.size === 0 ? (
            <div style={styles.emptyState}>
              请在左侧选择要监视的变量
            </div>
          ) : (
            chartsToRender.map((chart) => (
              <RealtimeChart
                key={chart.id}
                chartDef={chart}
                variables={activePlcVars}
                bufferData={bufferData}
                timeWindow={timeWindow}
                connected={socket.connected}
              />
            ))
          )}
        </div>
      </div>

      <NotificationToast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
