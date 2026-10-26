import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import useSocket from '../hooks/useSocket';
import RealtimeChart from '../components/RealtimeChart';
import ConnectionStatus from '../components/ConnectionStatus';
import ThemeToggle from '../components/ThemeToggle';
import NotificationToast, { useToast } from '../components/NotificationToast';
import { formatValue } from '../utils/chartOptions';
import { useTheme } from '../context/ThemeContext';
import { colors, radius, header, brand, brandMark, button, dot, chartPalettes } from '../styles/theme';

const MAX_POINTS = 18000;
const HISTORY_WINDOW_MS = 30 * 60 * 1000;
const DEFAULT_CHART = { id: 'default', title: '实时数据', timeWindow: 30, axes: [] };

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  divider: { width: '1px', height: '20px', backgroundColor: colors.border },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  socketBadge: {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '12px', color: colors.textSecondary, marginRight: '4px',
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    width: '272px',
    backgroundColor: colors.surface,
    borderRight: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
  },
  sidebarHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 16px 10px', fontSize: '11px', fontWeight: 600,
    letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.textMuted,
  },
  plcCard: {
    margin: '0 12px 8px', padding: '10px 12px',
    border: `1px solid ${colors.border}`, borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  plcCardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  plcName: {
    fontSize: '13px', fontWeight: 600, color: colors.text,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  statusText: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: colors.textSecondary },
  plcCardBottom: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' },
  plcAddress: {
    fontSize: '11px', color: colors.textMuted,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  listHint: {
    padding: '2px 16px 8px', fontSize: '11px', color: colors.textMuted,
  },
  variableList: { flex: 1, overflowY: 'auto', padding: '2px 8px 12px' },
  variableRow: {
    display: 'flex', alignItems: 'center', gap: '8px', height: '36px',
    padding: '0 8px', borderRadius: radius.sm, cursor: 'grab',
    fontSize: '13px', color: colors.textSecondary, userSelect: 'none',
  },
  variableRowActive: { color: colors.text },
  variableRowDragging: { opacity: 0.45 },
  checkbox: { width: '14px', height: '14px', cursor: 'pointer', accentColor: colors.text, flexShrink: 0 },
  variableValue: {
    marginLeft: 'auto', fontSize: '12px', fontWeight: 500, color: colors.text,
    fontVariantNumeric: 'tabular-nums',
  },
  grip: { color: colors.textMuted, flexShrink: 0, display: 'flex' },
  sidebarEmpty: { padding: '20px 16px', color: colors.textMuted, fontSize: '12px', textAlign: 'center', lineHeight: 1.7 },
  content: { flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '20px 24px 28px' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  segmented: {
    display: 'inline-flex', alignItems: 'center', padding: '2px',
    border: `1px solid ${colors.border}`, borderRadius: radius.md, backgroundColor: colors.surface,
  },
  segBtn: {
    height: '26px', padding: '0 12px', border: 'none', borderRadius: radius.sm,
    backgroundColor: 'transparent', color: colors.textSecondary, cursor: 'pointer',
    fontSize: '12px', fontWeight: 500,
  },
  segBtnActive: { backgroundColor: colors.text, color: colors.bg },
  chartGroup: { marginBottom: '4px' },
  chartGroupTitle: {
    fontSize: '11px', fontWeight: 600, color: colors.textMuted,
    letterSpacing: '0.05em', textTransform: 'uppercase', margin: '4px 2px 8px',
  },
  dropZone: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '56px', marginBottom: '12px',
    border: `1px dashed ${colors.borderStrong}`, borderRadius: radius.md,
    color: colors.textMuted, fontSize: '12px', cursor: 'default',
  },
  dropZoneActive: {
    borderColor: 'var(--accent)', color: colors.accent, backgroundColor: colors.accentSoft,
  },
  emptyState: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: colors.textMuted, fontSize: '13px',
    border: `1px dashed ${colors.borderStrong}`, borderRadius: radius.lg, minHeight: '240px',
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

export function normalizeAxes(chart) {
  if (Array.isArray(chart.axes)) {
    return chart.axes
      .map((axis, idx) => ({
        id: axis.id || `axis-${idx + 1}`,
        name: axis.name || `坐标轴 ${idx + 1}`,
        min: axis.min ?? '',
        max: axis.max ?? '',
        variableIds: Array.isArray(axis.variableIds) ? axis.variableIds : [],
      }))
      // 空坐标轴不保留，避免拖走变量后残留占位
      .filter((axis) => axis.variableIds.length > 0);
  }
  const variableIds = chart.variableIds || [];
  if (variableIds.length === 0) return [];
  return [{
    id: `${chart.id || 'chart'}-axis-1`,
    name: '坐标轴 1',
    min: chart.yAxisMin ?? '',
    max: chart.yAxisMax ?? '',
    variableIds,
  }];
}

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="3" r="1" /><circle cx="7" cy="3" r="1" />
      <circle cx="3" cy="7" r="1" /><circle cx="7" cy="7" r="1" />
      <circle cx="3" cy="11" r="1" /><circle cx="7" cy="11" r="1" />
    </svg>
  );
}

function DropZone({ onDropVariable, label }) {
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const start = () => setDragging(true);
    const end = () => setDragging(false);
    window.addEventListener('plcm-drag-start', start);
    window.addEventListener('plcm-drag-end', end);
    return () => {
      window.removeEventListener('plcm-drag-start', start);
      window.removeEventListener('plcm-drag-end', end);
    };
  }, []);

  return (
    <div
      style={{
        ...styles.dropZone,
        ...(over ? styles.dropZoneActive : {}),
        ...(dragging && !over ? { borderColor: colors.accent } : {}),
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/plain')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const vid = e.dataTransfer.getData('text/plain');
        if (vid) onDropVariable(vid);
      }}
    >
      {label}
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const socket = useSocket();
  const { theme } = useTheme();
  const palette = chartPalettes[theme] || chartPalettes.light;
  const { toasts, addToast, removeToast } = useToast();

  const [config, setConfig] = useState(null);
  const [activePlcId, setActivePlcId] = useState(null);
  const [visibleVariables, setVisibleVariables] = useState(() => new Set());
  const [connectingPlcs, setConnectingPlcs] = useState(() => new Set());
  const [timeWindow, setTimeWindow] = useState(30);
  const [bufferData, setBufferData] = useState(() => new Map());
  const [paused, setPaused] = useState(false);
  const [draggingVariable, setDraggingVariable] = useState(null);
  const [savingLayout, setSavingLayout] = useState(false);

  const pausedRef = useRef(false);
  const pausedQueueRef = useRef([]);
  const prevConnectedRef = useRef(new Map());
  const configRef = useRef(null);
  const saveTimersRef = useRef(new Map());

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

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
        next.set(vid, Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_POINTS));
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
        configRef.current = cfg;
        setConfig(cfg);
        const firstPlc = cfg.plcs?.[0];
        if (firstPlc) {
          setActivePlcId(firstPlc.id);
          const ids = (cfg.variables || []).filter((v) => v.plcId === firstPlc.id).map((v) => v.id);
          setVisibleVariables(new Set(ids));
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
    setVisibleVariables(new Set(plcVars.map((v) => v.id)));
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

  const plcCharts = useMemo(() => {
    const charts = (config?.charts || []).filter((chart) => chart.plcId === activePlcId);
    return charts.length > 0 ? charts : [{ ...DEFAULT_CHART, plcId: activePlcId }];
  }, [config, activePlcId]);

  const chartGroups = useMemo(
    () => plcCharts.map((chart) => ({ chart, axes: normalizeAxes(chart) })),
    [plcCharts]
  );

  const renderedGroups = useMemo(
    () => chartGroups.map(({ chart, axes }) => ({
      chart,
      axes: axes.map((axis) => ({
        ...axis,
        allVariableIds: axis.variableIds,
        variableIds: axis.variableIds.filter((vid) => visibleVariables.has(vid)),
      })),
    })),
    [chartGroups, visibleVariables]
  );

  const getChartGroup = useCallback((chartId) => {
    const cfg = configRef.current;
    const chart = cfg?.charts?.find((c) => c.id === chartId);
    if (chart) return { chart, axes: normalizeAxes(chart) };
    if (chartId === 'default') return { chart: { ...DEFAULT_CHART, plcId: activePlcId }, axes: [] };
    return null;
  }, [activePlcId]);

  const applyAxesLocally = useCallback((chartId, axes) => {
    const prev = configRef.current;
    if (!prev) return;
    const variableIds = [...new Set(axes.flatMap((axis) => axis.variableIds))];
    const next = {
      ...prev,
      charts: prev.charts.map((c) => (
        c.id === chartId ? { ...c, axes, variableIds } : c
      )),
    };
    configRef.current = next;
    setConfig(next);
  }, []);

  const persistChart = useCallback((chart, axes) => {
    if (chart.id !== 'default') applyAxesLocally(chart.id, axes);

    const pending = saveTimersRef.current.get(chart.id);
    if (pending) clearTimeout(pending);

    const run = async () => {
      saveTimersRef.current.delete(chart.id);
      setSavingLayout(true);
      try {
        const payload = {
          axes,
          variableIds: axes.flatMap((axis) => axis.variableIds),
          timeWindow: chart.timeWindow ?? timeWindow,
        };
        if (chart.id === 'default') {
          payload.plcId = activePlcId;
          payload.title = chart.title || '实时数据';
        }
        const res = await fetch(
          chart.id === 'default' ? '/api/charts' : `/api/charts/${chart.id}`,
          {
            method: chart.id === 'default' ? 'POST' : 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const saved = await res.json();
        const prev = configRef.current;
        if (prev) {
          const exists = prev.charts.some((c) => c.id === saved.id);
          const next = {
            ...prev,
            charts: exists
              ? prev.charts.map((c) => (c.id === saved.id ? { ...c, ...saved, axes } : c))
              : [...prev.charts, { ...saved, axes }],
          };
          configRef.current = next;
          setConfig(next);
        }
      } catch (err) {
        console.error('保存图表布局失败:', err);
        addToast(`保存布局失败：${err.message}`, 'error', 5000);
      } finally {
        setSavingLayout(false);
      }
    };

    const timer = setTimeout(run, chart.id === 'default' ? 0 : 250);
    saveTimersRef.current.set(chart.id, timer);
  }, [activePlcId, timeWindow, addToast, applyAxesLocally]);

  useEffect(() => () => {
    for (const timer of saveTimersRef.current.values()) clearTimeout(timer);
    saveTimersRef.current.clear();
  }, []);

  const pruneAxes = useCallback(
    (axes) => axes.filter((axis) => (axis.variableIds || []).length > 0),
    []
  );

  const removeVariableFromOtherCharts = useCallback((variableId, exceptChartId) => {
    const charts = configRef.current?.charts || [];
    for (const chart of charts) {
      if (chart.id === exceptChartId) continue;
      const axes = normalizeAxes(chart);
      if (!axes.some((axis) => axis.variableIds.includes(variableId))) continue;
      persistChart(chart, pruneAxes(axes.map((axis) => ({
        ...axis,
        variableIds: axis.variableIds.filter((vid) => vid !== variableId),
      }))));
    }
  }, [persistChart, pruneAxes]);

  const assignVariable = useCallback((variableId, targetChartId, targetAxisId) => {
    const target = getChartGroup(targetChartId);
    if (!target) return;

    const targetAxes = target.axes.map((axis) => {
      if (axis.id === targetAxisId) {
        return { ...axis, variableIds: [...new Set([...axis.variableIds, variableId])] };
      }
      return { ...axis, variableIds: axis.variableIds.filter((vid) => vid !== variableId) };
    });

    persistChart(target.chart, pruneAxes(targetAxes));
    setVisibleVariables((prev) => new Set(prev).add(variableId));
    removeVariableFromOtherCharts(variableId, targetChartId);
  }, [getChartGroup, persistChart, removeVariableFromOtherCharts, pruneAxes]);

  const createAxisWithVariable = useCallback((chartId, variableId) => {
    const target = getChartGroup(chartId);
    if (!target) return;
    const axis = {
      id: `axis-${Date.now()}`,
      name: `坐标轴 ${target.axes.length + 1}`,
      min: '',
      max: '',
      variableIds: [variableId],
    };
    const remainingAxes = target.axes.map((item) => ({
      ...item,
      variableIds: item.variableIds.filter((vid) => vid !== variableId),
    }));
    persistChart(target.chart, pruneAxes([...remainingAxes, axis]));
    setVisibleVariables((prev) => new Set(prev).add(variableId));
    removeVariableFromOtherCharts(variableId, chartId);
  }, [getChartGroup, persistChart, removeVariableFromOtherCharts, pruneAxes]);

  const updateAxis = useCallback((chartId, axisId, patch) => {
    const target = getChartGroup(chartId);
    if (!target) return;
    const axes = target.axes.map((axis) => (axis.id === axisId ? { ...axis, ...patch } : axis));
    persistChart(target.chart, axes);
  }, [getChartGroup, persistChart]);

  const removeAxis = useCallback((chartId, axisId) => {
    const target = getChartGroup(chartId);
    if (!target) return;
    persistChart(target.chart, target.axes.filter((axis) => axis.id !== axisId));
  }, [getChartGroup, persistChart]);

  const removeVariable = useCallback((chartId, axisId, variableId) => {
    const target = getChartGroup(chartId);
    if (!target) return;
    const axes = target.axes.map((axis) =>
      axis.id === axisId
        ? { ...axis, variableIds: axis.variableIds.filter((vid) => vid !== variableId) }
        : axis
    );
    persistChart(target.chart, pruneAxes(axes));
  }, [getChartGroup, persistChart, pruneAxes]);

  const toggleVariable = useCallback((variableId) => {
    setVisibleVariables((prev) => {
      const next = new Set(prev);
      if (next.has(variableId)) {
        next.delete(variableId);
      } else {
        next.add(variableId);
      }
      return next;
    });
  }, []);

  const handleDragStart = useCallback((event, variableId) => {
    event.dataTransfer.setData('text/plain', variableId);
    event.dataTransfer.effectAllowed = 'copy';
    setDraggingVariable(variableId);
    window.dispatchEvent(new Event('plcm-drag-start'));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingVariable(null);
    window.dispatchEvent(new Event('plcm-drag-end'));
  }, []);

  if (!config) {
    return <div style={{ ...styles.emptyState, height: '100vh', border: 'none' }}>正在加载配置...</div>;
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
            className="ui-select"
            style={{ minWidth: '160px' }}
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
            <span style={dot(socket.connected === null ? colors.warning : socket.connected ? colors.success : colors.danger)} />
            {socket.connected === null ? '连接中' : socket.connected ? '服务在线' : '服务离线'}
          </span>
          <ThemeToggle />
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
            <span style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 500 }}>{activePlcVars.length}</span>
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
                  <button style={{ ...button.subtle, color: colors.danger, padding: '0 4px' }} onClick={() => handleDisconnect(activePlcId)}>
                    断开
                  </button>
                ) : (
                  <button style={{ ...button.subtle, color: colors.accent, padding: '0 4px' }} onClick={() => handleConnect(activePlcId)} disabled={isConnecting}>
                    {isConnecting ? '连接中...' : '连接'}
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={styles.listHint}>拖到右侧图表可分配坐标轴</div>

          <div style={styles.variableList}>
            {activePlcVars.map((v) => {
              const data = bufferData.get(v.id);
              const latest = data && data.length > 0 ? data[data.length - 1] : null;
              const active = visibleVariables.has(v.id);
              return (
                <div
                  key={v.id}
                  draggable
                  style={{
                    ...styles.variableRow,
                    ...(active ? styles.variableRowActive : {}),
                    ...(draggingVariable === v.id ? styles.variableRowDragging : {}),
                  }}
                  onDragStart={(e) => handleDragStart(e, v.id)}
                  onDragEnd={handleDragEnd}
                  title="拖到右侧图表"
                >
                  <input
                    type="checkbox"
                    style={styles.checkbox}
                    checked={active}
                    onChange={() => toggleVariable(v.id)}
                    aria-label={`显示 ${v.name}`}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                  <span style={styles.variableValue}>{formatValue(latest?.value)}</span>
                  <span style={styles.grip}><GripIcon /></span>
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
            {savingLayout && <span style={{ fontSize: '11px', color: colors.textMuted }}>保存布局中...</span>}
            <button style={button.ghost} onClick={togglePause}>{paused ? '继续采集' : '暂停'}</button>
          </div>

          {renderedGroups.map(({ chart, axes }) => (
            <div key={chart.id} style={styles.chartGroup}>
              {renderedGroups.length > 1 && <div style={styles.chartGroupTitle}>{chart.title || '图表'}</div>}

              {axes.map((axis, idx) => (
                <RealtimeChart
                  key={axis.id}
                  chartDef={chart}
                  axis={axis}
                  axisIndex={idx}
                  variables={activePlcVars}
                  bufferData={bufferData}
                  timeWindow={timeWindow}
                  connected={isConnected || !statusKnown}
                  palette={palette}
                  onUpdateAxis={(axisId, patch) => updateAxis(chart.id, axisId, patch)}
                  onRemoveAxis={(axisId) => removeAxis(chart.id, axisId)}
                  onRemoveVariable={(axisId, vid) => removeVariable(chart.id, axisId, vid)}
                  onDropVariable={(vid, axisId) => assignVariable(vid, chart.id, axisId)}
                />
              ))}

              <DropZone
                label={axes.length === 0 ? '拖动左侧变量到此处创建坐标轴' : '拖动变量到此处新建坐标轴'}
                onDropVariable={(vid) => createAxisWithVariable(chart.id, vid)}
              />
            </div>
          ))}
        </main>
      </div>

      <NotificationToast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
