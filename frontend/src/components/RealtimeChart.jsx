import React, { useEffect, useRef, useMemo } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { createChartOptions, prepareChartData } from '../utils/chartOptions';

const styles = {
  container: {
    background: '#fff',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '16px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#333',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    marginTop: '8px',
    padding: '8px 0',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  legendColor: {
    width: '12px',
    height: '12px',
    borderRadius: '2px',
    flexShrink: 0,
  },
  overlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#999',
    fontSize: '14px',
    textAlign: 'center',
  },
};

export default function RealtimeChart({ chartDef, variables, bufferData, timeWindow, connected }) {
  const chartRef = useRef(null);
  const uplotRef = useRef(null);
  const containerRef = useRef(null);

  const varMap = useMemo(() => {
    const m = {};
    (variables || []).forEach((v) => { m[v.id] = v; });
    return m;
  }, [variables]);

  const options = useMemo(
    () => createChartOptions(chartDef, variables, timeWindow),
    [chartDef, variables, timeWindow]
  );

  // 初始化 uPlot
  useEffect(() => {
    if (!chartRef.current) return;

    const cols = prepareChartData(bufferData, chartDef.variableIds || [], timeWindow);
    const uplot = new uPlot(options, cols, chartRef.current);
    uplotRef.current = uplot;

    return () => {
      uplot.destroy();
      uplotRef.current = null;
    };
  }, []); // 仅初始化一次

  // 更新数据
  useEffect(() => {
    if (!uplotRef.current) return;
    const cols = prepareChartData(bufferData, chartDef.variableIds || [], timeWindow);

    // 更新 uPlot 数据
    uplotRef.current.setData(cols);
  }, [bufferData, chartDef.variableIds, timeWindow]);

  // 更新尺寸
  useEffect(() => {
    if (!uplotRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0) {
      uplotRef.current.setSize({ width: rect.width - 32, height: 300 });
    }
  }, []);

  const variableIds = chartDef.variableIds || [];
  const hasData = variableIds.some((vid) => {
    const data = bufferData.get(vid);
    return data && data.length > 0;
  });

  return (
    <div style={styles.container} ref={containerRef}>
      <div style={styles.title}>{chartDef.title || '图表'}</div>
      <div style={{ position: 'relative' }}>
        <div ref={chartRef} />
        {!connected && (
          <div style={styles.overlay}>连接断开</div>
        )}
        {connected && !hasData && (
          <div style={styles.overlay}>等待数据...</div>
        )}
      </div>
      <div style={styles.legend}>
        {variableIds.map((vid, idx) => {
          const v = varMap[vid];
          const color = (chartDef.curveColors && chartDef.curveColors[vid])
            || ['#2196F3', '#F44336', '#4CAF50', '#FF9800', '#9C27B0'][idx % 5];
          const latestData = bufferData.get(vid);
          const latest = latestData && latestData.length > 0
            ? latestData[latestData.length - 1]
            : null;
          return (
            <div key={vid} style={styles.legendItem}>
              <div style={{ ...styles.legendColor, backgroundColor: color }} />
              <span>{v ? v.name : vid}</span>
              <span style={{ fontWeight: 600, color }}>
                {latest ? (typeof latest.value === 'number' ? latest.value.toFixed(2) : latest.value) : '--'}
              </span>
              {v?.unit && <span style={{ color: '#999' }}>{v.unit}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
