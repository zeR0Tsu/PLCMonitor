import React, { useEffect, useRef, useMemo, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { createChartOptions, prepareChartData, getCurveColor, formatValue } from '../utils/chartOptions';
import { colors, radius, panel } from '../styles/theme';

const CHART_HEIGHT = 240;

const styles = {
  container: {
    ...panel,
    padding: '12px 14px 12px',
    marginBottom: '12px',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  },
  containerDragOver: {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 0 3px var(--accent-soft)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '6px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    minWidth: 0,
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: colors.text,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  meta: {
    fontSize: '11px',
    color: colors.textMuted,
    whiteSpace: 'nowrap',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  rangeGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: colors.textMuted,
  },
  rangeInput: {
    width: '62px',
    height: '26px',
    padding: '0 7px',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    background: colors.surface,
    color: colors.text,
    fontSize: '11px',
    outline: 'none',
  },
  chartWrap: {
    position: 'relative',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: `1px solid ${colors.border}`,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    height: '24px',
    padding: '0 8px',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    fontSize: '11px',
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
  legendRemove: {
    border: 'none',
    background: 'transparent',
    color: colors.textMuted,
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: 1,
    padding: '0 0 0 2px',
  },
  empty: {
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px dashed ${colors.borderStrong}`,
    borderRadius: radius.md,
    color: colors.textMuted,
    fontSize: '12px',
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

function RangeField({ value, placeholder, onCommit }) {
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const commit = (raw) => {
    if (String(raw) === String(value ?? '')) return;
    onCommit(raw);
  };

  return (
    <input
      style={styles.rangeInput}
      inputMode="decimal"
      value={draft}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit(e.currentTarget.value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export default function RealtimeChart({
  chartDef,
  axis,
  variables,
  bufferData,
  timeWindow,
  connected,
  palette,
  axisIndex,
  onUpdateAxis,
  onRemoveAxis,
  onRemoveVariable,
  onDropVariable,
}) {
  const chartRef = useRef(null);
  const uplotRef = useRef(null);
  const containerRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const variableIds = useMemo(() => axis.variableIds || [], [axis.variableIds]);
  const hiddenCount = Math.max((axis.allVariableIds || variableIds).length - variableIds.length, 0);

  const varMap = useMemo(
    () => new Map((variables || []).map((v) => [v.id, v])),
    [variables]
  );

  const options = useMemo(
    () => createChartOptions(chartDef, variables, { ...axis, variableIds }, palette),
    [chartDef, variables, axis, variableIds, palette]
  );

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;

    const uplot = new uPlot(options, prepareChartData(bufferData, variableIds, timeWindow), element);
    uplotRef.current = uplot;

    const resize = () => {
      const container = containerRef.current;
      if (!container || !uplotRef.current) return;
      const width = Math.max(container.clientWidth - 28, 240);
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
  }, [options]);

  useEffect(() => {
    if (!uplotRef.current) return;
    uplotRef.current.setData(prepareChartData(bufferData, variableIds, timeWindow));
  }, [bufferData, variableIds, timeWindow]);

  const lastTimestamp = useMemo(() => {
    let latest = 0;
    for (const vid of variableIds) {
      const rows = bufferData.get(vid);
      if (rows?.length) latest = Math.max(latest, rows[rows.length - 1].timestamp);
    }
    return latest;
  }, [bufferData, variableIds]);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    const vid = event.dataTransfer.getData('text/plain');
    if (vid) onDropVariable(vid, axis.id);
  };

  return (
    <section
      style={{ ...styles.container, ...(dragOver ? styles.containerDragOver : {}) }}
      ref={containerRef}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/plain')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
      }}
      onDrop={handleDrop}
    >
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>{axis.name || `坐标轴 ${axisIndex + 1}`}</span>
          {lastTimestamp > 0 && (
            <span style={styles.meta}>
              更新于 {new Date(lastTimestamp).toLocaleTimeString('zh-CN', { hour12: false })}
            </span>
          )}
        </div>
        <div style={styles.headerRight}>
          <div style={styles.rangeGroup}>
            <span>Y</span>
            <RangeField
              value={axis.min}
              placeholder="最小"
              onCommit={(min) => onUpdateAxis(axis.id, { min })}
            />
            <span>~</span>
            <RangeField
              value={axis.max}
              placeholder="最大"
              onCommit={(max) => onUpdateAxis(axis.id, { max })}
            />
          </div>
          <button
            type="button"
            style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', fontSize: '12px' }}
            onClick={() => onRemoveAxis(axis.id)}
            title="移除坐标轴"
          >
            移除
          </button>
        </div>
      </div>

      {variableIds.length === 0 ? (
        <div style={styles.empty}>
          {hiddenCount > 0 ? '该坐标轴下的变量已隐藏，勾选左侧变量即可显示' : '将左侧变量拖到此处'}
        </div>
      ) : (
        <div style={styles.chartWrap}>
          <div ref={chartRef} />
          {!connected && <div style={styles.overlay}>未连接</div>}
        </div>
      )}

      <div style={styles.legend}>
        {variableIds.map((vid, idx) => {
          const variable = varMap.get(vid);
          const color = getCurveColor(chartDef, vid, idx, palette);
          const rows = bufferData.get(vid);
          const latest = rows && rows.length > 0 ? rows[rows.length - 1] : null;
          return (
            <div key={vid} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: color }} />
              <span>{variable ? variable.name : vid}</span>
              <span style={styles.legendValue}>{formatValue(latest?.value)}</span>
              {variable?.unit && <span style={styles.legendUnit}>{variable.unit}</span>}
              <button
                type="button"
                style={styles.legendRemove}
                onClick={() => onRemoveVariable(axis.id, vid)}
                title="从坐标轴移除"
                aria-label={`从坐标轴移除 ${variable?.name || vid}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
