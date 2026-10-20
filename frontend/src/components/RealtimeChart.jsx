import React, { useEffect, useRef, useMemo } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { createChartOptions, prepareChartData, getCurveColor, formatValue } from '../utils/chartOptions';
import { colors, radius, panel } from '../styles/theme';

const CHART_HEIGHT = 300;

const styles = {
  container: {
    ...panel,
    padding: '16px 18px 14px',
    marginBottom: '14px',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: colors.text,
    letterSpacing: '-0.01em',
  },
  meta: {
    fontSize: '11px',
    color: colors.textMuted,
  },
  chartWrap: {
    position: 'relative',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '18px',
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: `1px solid ${colors.border}`,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    fontSize: '12px',
    color: colors.textSecondary,
  },
  legendDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendValue: {
    fontWeight: 600,
    color: colors.text,
    fontVariantNumeric: 'tabular-nums',
  },
  legendUnit: {
    color: colors.textMuted,
  },
  overlay: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '3px 8px',
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    color: colors.textMuted,
    fontSize: '11px',
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

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;

    const initialData = prepareChartData(bufferData, variableIds, timeWindow);
    const uplot = new uPlot(options, initialData, element);
    uplotRef.current = uplot;

    const resize = () => {
      const container = containerRef.current;
      if (!container || !uplotRef.current) return;
      const width = Math.max(container.clientWidth - 36, 240);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, variableIds, timeWindow]);

  useEffect(() => {
    if (!uplotRef.current) return;
    const data = prepareChartData(bufferData, variableIds, timeWindow);
    uplotRef.current.setData(data);
  }, [bufferData, variableIds, timeWindow]);

  const lastTimestamp = useMemo(() => {
    let latest = 0;
    for (const vid of variableIds) {
      const rows = bufferData.get(vid);
      if (rows?.length) latest = Math.max(latest, rows[rows.length - 1].timestamp);
    }
    return latest;
  }, [bufferData, variableIds]);

  return (
    <section style={styles.container} ref={containerRef}>
      <div style={styles.header}>
        <div style={styles.title}>{chartDef.title || '图表'}</div>
        {lastTimestamp > 0 && (
          <div style={styles.meta}>
            更新于 {new Date(lastTimestamp).toLocaleTimeString('zh-CN', { hour12: false })}
          </div>
        )}
      </div>

      <div style={styles.chartWrap}>
        <div ref={chartRef} />
        {!connected && <div style={styles.overlay}>未连接</div>}
      </div>

      <div style={styles.legend}>
        {variableIds.map((vid, idx) => {
          const variable = varMap.get(vid);
          const color = getCurveColor(chartDef, vid, idx);
          const series = bufferData.get(vid);
          const latest = series && series.length > 0 ? series[series.length - 1] : null;
          return (
            <div key={vid} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: color }} />
              <span>{variable ? variable.name : vid}</span>
              <span style={styles.legendValue}>{formatValue(latest?.value)}</span>
              {variable?.unit && <span style={styles.legendUnit}>{variable.unit}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
