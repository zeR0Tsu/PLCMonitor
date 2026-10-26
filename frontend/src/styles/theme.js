// 主题色统一走 CSS 变量，切换 light/dark 时无需重渲染组件树
export const colors = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surfaceMuted: 'var(--surface-muted)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  text: 'var(--text)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  accent: 'var(--accent)',
  accentSoft: 'var(--accent-soft)',
  success: 'var(--success)',
  successSoft: 'var(--success-soft)',
  danger: 'var(--danger)',
  dangerSoft: 'var(--danger-soft)',
  warning: 'var(--warning)',
  warningSoft: 'var(--warning-soft)',
  overlay: 'var(--overlay)',
  shadow: 'var(--shadow)',
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
};

export const font = {
  family: '"Inter", "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif',
};

export const panel = {
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
};

export const header = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '56px',
  padding: '0 20px',
  backgroundColor: colors.surface,
  borderBottom: `1px solid ${colors.border}`,
  flexShrink: 0,
};

export const brand = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '15px',
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: colors.text,
};

export const brandMark = {
  width: '22px',
  height: '22px',
  borderRadius: '6px',
  backgroundColor: colors.text,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.bg,
  fontSize: '11px',
  fontWeight: 700,
};

export const button = {
  ghost: {
    height: '32px',
    padding: '0 12px',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    background: colors.surface,
    color: colors.textSecondary,
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  primary: {
    height: '32px',
    padding: '0 14px',
    border: '1px solid transparent',
    borderRadius: radius.sm,
    background: colors.text,
    color: colors.bg,
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  subtle: {
    height: '28px',
    padding: '0 10px',
    border: 'none',
    borderRadius: radius.sm,
    background: 'transparent',
    color: colors.textSecondary,
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  icon: {
    width: '32px',
    height: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    background: colors.surface,
    color: colors.textSecondary,
    cursor: 'pointer',
    padding: 0,
  },
};

export const select = {
  height: '32px',
  padding: '0 10px',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  background: colors.surface,
  color: colors.text,
  fontSize: '13px',
  cursor: 'pointer',
};

export const dot = (color) => ({
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  backgroundColor: color,
  flexShrink: 0,
});

// canvas 绘制需要具体色值，不能使用 var()
export const chartPalettes = {
  light: {
    colors: ['#2563eb', '#12b76a', '#f79009', '#7a5af8', '#0ea5e9', '#e11d48', '#14b8a6', '#f97316'],
    axis: '#98a2b3',
    grid: '#f2f4f7',
    tick: '#e4e7ec',
    cursor: '#98a2b3',
    selection: 'rgba(37, 99, 235, 0.12)',
  },
  dark: {
    colors: ['#6aa5ff', '#3ddc97', '#f5a524', '#b692f6', '#38bdf8', '#fb7185', '#2dd4bf', '#fdba74'],
    axis: '#6f7b8a',
    grid: '#1c232c',
    tick: '#2a323d',
    cursor: '#6f7b8a',
    selection: 'rgba(106, 165, 255, 0.14)',
  },
};
