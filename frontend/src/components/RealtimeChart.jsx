import React, { useEffect, useRef, useMemo } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { createChartOptions, prepareChartData, getCurveColor, formatValue } from '../utils/chartOptions';

const CHART_HEIGHT = 300;

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
    pointerEvents: 'none',
  },
};

export default function RealtimeChart({ chartDef, variables, bufferData, timeWindow, connected }) {
  const chartRef = useRef(null);
  const uplotRef = useRef(null);
  const containerRef = useRef(null);

  const variableIds = useMemo(() => chartDef.variableIds || [], [chartDef]);
  const varMap = useMemo(
    () => new Map((variables || []).map((v) => [v.id, v])),
    [variables]
  );

  const options = useMemo(
    () => createChartOptions(chartDef, variables, timeWindow),
    [chartDef, variables, timeWindow]
  );

  // 选项或曲线变化时重建图表，避免 uPlot 保留旧的 series 定义
  useEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;

    const initialData = prepareChartData(bufferData, variableIds, timeWindow);
    const uplot = new uPlot(options, initialData, element);
    uplotRef.current = uplot;

    const resize = () => {
      const container = containerRef.current;
      if (!container || !uplotRef.current) return;
      const width = Math.max(container.clientWidth - 32, 240);
      uplotRef.current.setSize({ width, height: CHART_HEIGHT });
    };

    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(containerRef.current);
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      observer?.disconnect();
      uplot.destroy();
      uplotRef.current = null;
    };
    // bufferData 只在初始化时使用，后续由下面的数据 effect 更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, variableIds, timeWindow]);

  useEffect(() => {
    if (!uplotRef.current) return;
    const data = prepareChartData(bufferData, variableIds, timeWindow);
    const width = Math.max((containerRef.current?.clientWidth || 832) - 32, 240);
    uplotRef.current.setSize({ width, height: CHART_HEIGHT });
    uplotRef.current.setData(data);
  }, [bufferData, variableIds, timeWindow]);

  return (
    <div style={styles.container} ref={containerRef}>
      <div style={styles.title}>{chartDef.title || '图表'}</div>
      <div style={{ position: 'relative' }}>
        <div ref={chartRef} />
        {!connected && <div style={styles.overlay}>数据连接已断开</div>}
      </div>
      <div style={styles.legend}>
        {variableIds.map((vid, idx) => {
          const variable = varMap.get(vid);
          const color = getCurveColor(chartDef, vid, idx);
          const series = bufferData.get(vid);
          const latest = series && series.length > 0 ? series[series.length - 1] : null;
          return (
            <div key={vid} style={styles.legendItem}>
              <div style={{ ...styles.legendColor, backgroundColor: color }} />
              <span>{variable ? variable.name : vid}</span>
              <span style={{ fontWeight: 600, color }}>
                {formatValue(latest?.value)}
              </span>
              {variable?.unit && <span style={{ color: '#999' }}>{variable.unit}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
