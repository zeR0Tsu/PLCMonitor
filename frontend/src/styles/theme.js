export const colors = {
  bg: '#f4f5f7',
  surface: '#ffffff',
  surfaceMuted: '#f9fafb',
  border: '#e4e7ec',
  borderStrong: '#d0d5dd',
  text: '#101828',
  textSecondary: '#475467',
  textMuted: '#98a2b3',
  accent: '#2563eb',
  accentSoft: '#eff4ff',
  accentBorder: '#b2ccff',
  success: '#12b76a',
  successSoft: '#ecfdf3',
  danger: '#d92d20',
  dangerSoft: '#fef3f2',
  warning: '#dc6803',
  warningSoft: '#fffaeb',
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
  color: '#fff',
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
    color: '#ffffff',
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
  link: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    color: colors.accent,
  },
  linkDanger: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    color: colors.danger,
  },
};

export const select = {
  height: '32px',
  padding: '0 28px 0 10px',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  background: colors.surface,
  color: colors.text,
  fontSize: '13px',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage:
    'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath d=\'M3 4.5L6 7.5L9 4.5\' stroke=\'%23667085\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 9px center',
};

export const dot = (color) => ({
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  backgroundColor: color,
  flexShrink: 0,
});


