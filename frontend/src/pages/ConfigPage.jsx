import React, { useEffect, useState, useCallback } from 'react';
import { colors, radius, header, brand, brandMark, button } from '../styles/theme';
import ThemeToggle from '../components/ThemeToggle';

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
  headerSection: {
    fontSize: '13px',
    color: colors.textSecondary,
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '28px 24px 40px',
  },
  contentWrap: {
    width: '100%',
    maxWidth: '1080px',
    margin: '0 auto',
  },
  tabBar: {
    display: 'flex',
    gap: '24px',
    borderBottom: `1px solid ${colors.border}`,
    marginBottom: '20px',
  },
  tab: {
    padding: '0 0 10px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    color: colors.textMuted,
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
  },
  tabActive: {
    color: colors.text,
    borderBottomColor: colors.text,
    fontWeight: 600,
  },
  section: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: '18px 20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.textMuted,
    fontWeight: 600,
    fontSize: '11px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #f2f4f7',
    color: colors.textSecondary,
  },
  actionBtn: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    marginRight: '14px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    color: colors.accent,
  },
  actionBtnDanger: {
    color: colors.danger,
  },
  addBtn: {
    marginTop: '14px',
    height: '32px',
    padding: '0 14px',
    border: `1px dashed ${colors.borderStrong}`,
    borderRadius: radius.sm,
    background: 'transparent',
    color: colors.textSecondary,
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(16, 24, 40, 0.4)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: '22px',
    width: '480px',
    maxWidth: '90vw',
    maxHeight: '88vh',
    overflow: 'auto',
    boxShadow: '0 12px 32px rgba(16, 24, 40, 0.12)',
  },
  modalTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: colors.text,
    marginBottom: '18px',
  },
  formGroup: {
    marginBottom: '14px',
  },
  formLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: colors.textSecondary,
    marginBottom: '6px',
  },
  formInput: {
    width: '100%',
    height: '32px',
    padding: '0 10px',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    fontSize: '13px',
    color: colors.text,
    outline: 'none',
    boxSizing: 'border-box',
    background: colors.surface,
  },
  formSelect: {
    width: '100%',
    boxSizing: 'border-box',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
  },
  formRowItem: {
    flex: 1,
    minWidth: 0,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '18px',
    paddingTop: '14px',
    borderTop: `1px solid ${colors.border}`,
    position: 'sticky',
    bottom: '-22px',
    backgroundColor: colors.surface,
  },
  modalBtn: {
    ...button.ghost,
  },
  modalBtnPrimary: {
    ...button.primary,
  },
  chartCard: {
    background: colors.surfaceMuted,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: '14px 16px',
    marginBottom: '10px',
  },
  chartCardTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: colors.text,
    marginBottom: '8px',
  },
  tag: {
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: radius.sm,
    fontSize: '11px',
    marginRight: '4px',
    marginBottom: '4px',
    backgroundColor: colors.accentSoft,
    color: colors.accent,
  },
};
const TABS = [
  { key: 'plcs', label: 'PLC 管理' },
  { key: 'variables', label: '变量管理' },
  { key: 'charts', label: '图表布局' },
];

const ADDRESS_TYPES = ['DB', 'I', 'Q', 'M'];
const DATA_TYPES = ['Real', 'Int', 'Bool', 'Word', 'DWord', 'DInt'];

export default function ConfigPage({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('plcs');
  const [config, setConfig] = useState(null);
  const [selectedPlcId, setSelectedPlcId] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({});

  const refreshConfig = useCallback(async () => {
    try {
      const resp = await fetch('/api/config');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const cfg = await resp.json();
      setConfig(cfg);
      setSelectedPlcId((prev) => {
        if (prev && cfg.plcs?.some((p) => p.id === prev)) return prev;
        return cfg.plcs?.[0]?.id || null;
      });
      return cfg;
    } catch (err) {
      console.error('加载配置失败:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  // ============ PLC CRUD ============
  const openPlcForm = (plc = null) => {
    setEditingItem(plc);
    setForm(plc || { name: '', ip: '', rack: 0, slot: 1, description: '' });
    setShowModal('plc');
  };

  const savePlc = async () => {
    const isEdit = Boolean(editingItem);
    const resp = await fetch(isEdit ? `/api/plcs/${editingItem.id}` : '/api/plcs', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      window.alert(`保存 PLC 失败：${err.error || resp.status}`);
      return;
    }
    setShowModal(null);
    setEditingItem(null);
    await refreshConfig();
  };

  const deletePlc = async (id) => {
    if (!window.confirm('删除 PLC 会同时删除其变量和图表，确定继续？')) return;
    await fetch(`/api/plcs/${id}`, { method: 'DELETE' });
    await refreshConfig();
  };

  // ============ Variable CRUD ============
  const openVariableForm = (variable = null) => {
    setEditingItem(variable);
    setForm(variable || {
      plcId: selectedPlcId || config?.plcs?.[0]?.id || '',
      name: '',
      addressType: 'DB',
      dbNumber: 1,
      offset: 0,
      dataType: 'Real',
      bitIndex: null,
      unit: '',
      description: '',
    });
    setShowModal('variable');
  };

  const saveVariable = async () => {
    const isEdit = Boolean(editingItem);
    const payload = {
      ...form,
      plcId: form.plcId || selectedPlcId,
      dbNumber: Number(form.dbNumber ?? 1),
      offset: Number(form.offset ?? 0),
      bitIndex: form.bitIndex === '' || form.bitIndex == null ? null : Number(form.bitIndex),
    };
    const resp = await fetch(isEdit ? `/api/variables/${editingItem.id}` : '/api/variables', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      window.alert(`保存变量失败：${err.error || resp.status}`);
      return;
    }
    setShowModal(null);
    setEditingItem(null);
    await refreshConfig();
  };

  const deleteVariable = async (id) => {
    if (!window.confirm('确定删除该变量？图表中的引用也会一并移除。')) return;
    await fetch(`/api/variables/${id}`, { method: 'DELETE' });
    await refreshConfig();
  };

  // ============ Chart CRUD ============
  const openChartForm = (chart = null) => {
    setEditingItem(chart);
    setForm(chart || {
      plcId: selectedPlcId || '',
      title: '',
      variableIds: [],
      curveColors: {},
      timeWindow: 30,
      yAxisMin: '',
      yAxisMax: '',
    });
    setShowModal('chart');
  };

  const saveChart = async () => {
    const isEdit = Boolean(editingItem);
    const chartData = {
      title: form.title || '实时数据',
      plcId: form.plcId || selectedPlcId,
      timeWindow: Number(form.timeWindow ?? 30),
    };
    if (!isEdit) chartData.axes = [];
    const resp = await fetch(isEdit ? `/api/charts/${editingItem.id}` : '/api/charts', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chartData),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      window.alert(`保存图表失败：${err.error || resp.status}`);
      return;
    }
    setShowModal(null);
    setEditingItem(null);
    await refreshConfig();
  };

  const deleteChart = async (id) => {
    if (!window.confirm('确定删除该图表布局？')) return;
    await fetch(`/api/charts/${id}`, { method: 'DELETE' });
    await refreshConfig();
  };

  if (!config) {
    return <div style={{ padding: '40px', textAlign: 'center', color: colors.textMuted }}>加载中...</div>;
  }

  const varMap = {};
  config.variables.forEach((v) => { varMap[v.id] = v; });

  return (
    <div style={styles.container}>
      <header style={header}>
        <div style={styles.headerLeft}>
          <div style={brand}>
            <span style={brandMark}>PL</span>
            PLCMonitor
          </div>
          <span style={styles.divider} />
          <span style={styles.headerSection}>配置</span>
        </div>
        <button style={button.ghost} onClick={() => onNavigate('dashboard')}>
          返回仪表板
        </button>
      </header>

      <div style={styles.body}>
        <div style={styles.contentWrap}>
          <div style={styles.tabBar}>
          {TABS.map((tab) => (
            <div
              key={tab.key}
              style={{
                ...styles.tab,
                ...(activeTab === tab.key ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </div>
          ))}
        </div>

        {/* PLC 管理 */}
        {activeTab === 'plcs' && (
          <div style={styles.section}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>名称</th>
                  <th style={styles.th}>IP</th>
                  <th style={styles.th}>机架</th>
                  <th style={styles.th}>槽号</th>
                  <th style={styles.th}>描述</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {config.plcs.map((plc) => (
                  <tr key={plc.id}>
                    <td style={styles.td}>{plc.name}</td>
                    <td style={styles.td}>{plc.ip}</td>
                    <td style={styles.td}>{plc.rack}</td>
                    <td style={styles.td}>{plc.slot}</td>
                    <td style={styles.td}>{plc.description || '-'}</td>
                    <td style={styles.td}>
                      <button style={styles.actionBtn} onClick={() => openPlcForm(plc)}>编辑</button>
                      <button style={{ ...styles.actionBtn, ...styles.actionBtnDanger }} onClick={() => deletePlc(plc.id)}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {config.plcs.length === 0 && (
              <div style={{ textAlign: 'center', color: colors.textMuted, padding: '20px' }}>
                暂无 PLC 配置
              </div>
            )}
            <button style={styles.addBtn} onClick={() => openPlcForm()}>+ 添加 PLC</button>
          </div>
        )}

        {/* 变量管理 */}
        {activeTab === 'variables' && (
          <div style={styles.section}>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary }}>选择 PLC：</label>
              <select
                className="ui-select"
                style={{ ...styles.formSelect, width: '240px' }}
                value={selectedPlcId || ''}
                onChange={(e) => setSelectedPlcId(e.target.value || null)}
              >
                <option value="">-- 请选择 PLC --</option>
                {config.plcs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.ip})</option>
                ))}
              </select>
            </div>

            {selectedPlcId ? (
              <>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>变量名</th>
                      <th style={styles.th}>地址类型</th>
                      <th style={styles.th}>DB/偏移</th>
                      <th style={styles.th}>数据类型</th>
                      <th style={styles.th}>单位</th>
                      <th style={styles.th}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.variables.filter((v) => v.plcId === selectedPlcId).map((v) => (
                      <tr key={v.id}>
                        <td style={styles.td}>{v.name}</td>
                        <td style={styles.td}>{v.addressType}</td>
                        <td style={styles.td}>
                          {v.addressType === 'DB' ? `DB${v.dbNumber}.${v.offset}` : v.offset}
                          {v.dataType === 'Bool' && v.bitIndex != null ? `.${v.bitIndex}` : ''}
                        </td>
                        <td style={styles.td}>{v.dataType}</td>
                        <td style={styles.td}>{v.unit || '-'}</td>
                        <td style={styles.td}>
                          <button style={styles.actionBtn} onClick={() => openVariableForm(v)}>编辑</button>
                          <button style={{ ...styles.actionBtn, ...styles.actionBtnDanger }} onClick={() => deleteVariable(v.id)}>删除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {config.variables.filter((v) => v.plcId === selectedPlcId).length === 0 && (
                  <div style={{ textAlign: 'center', color: colors.textMuted, padding: '20px' }}>
                    该 PLC 暂无变量定义
                  </div>
                )}
                <button style={styles.addBtn} onClick={() => openVariableForm()}>+ 添加变量</button>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: colors.textMuted, padding: '20px' }}>
                请先选择 PLC
              </div>
            )}
          </div>
        )}

        {/* 图表布局 */}
        {activeTab === 'charts' && (
          <div style={styles.section}>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary }}>选择 PLC：</label>
              <select
                className="ui-select"
                style={{ ...styles.formSelect, width: '240px' }}
                value={selectedPlcId || ''}
                onChange={(e) => setSelectedPlcId(e.target.value || null)}
              >
                <option value="">-- 请选择 PLC --</option>
                {config.plcs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.ip})</option>
                ))}
              </select>
            </div>

            {selectedPlcId ? (
              <>
                {config.charts.filter((c) => c.plcId === selectedPlcId).map((chart) => (
                  <div key={chart.id} style={styles.chartCard}>
                    <div style={styles.chartCardTitle}>{chart.title}</div>
                    <div style={{ marginBottom: '8px' }}>
                      {(chart.variableIds || []).map((vid) => (
                        <span key={vid} style={styles.tag}>
                          {varMap[vid]?.name || vid}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '8px' }}>
                      时间窗口: {chart.timeWindow}s
                    </div>
                    <div>
                      <button style={styles.actionBtn} onClick={() => openChartForm(chart)}>编辑</button>
                      <button style={{ ...styles.actionBtn, ...styles.actionBtnDanger }} onClick={() => deleteChart(chart.id)}>删除</button>
                    </div>
                  </div>
                ))}
                {config.charts.filter((c) => c.plcId === selectedPlcId).length === 0 && (
                  <div style={{ textAlign: 'center', color: colors.textMuted, padding: '20px' }}>
                    该 PLC 暂无图表布局
                  </div>
                )}
                <button style={styles.addBtn} onClick={() => openChartForm()}>+ 添加图表</button>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: colors.textMuted, padding: '20px' }}>
                请先选择 PLC
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* ============ Modal ============ */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => { setShowModal(null); setEditingItem(null); }}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

            {/* PLC 表单 */}
            {showModal === 'plc' && (
              <>
                <div style={styles.modalTitle}>{editingItem ? '编辑 PLC' : '添加 PLC'}</div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>名称</label>
                  <input style={styles.formInput} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>IP 地址</label>
                  <input style={styles.formInput} value={form.ip || ''} onChange={(e) => setForm({ ...form, ip: e.target.value })} />
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formRowItem}>
                    <label style={styles.formLabel}>机架号 (Rack)</label>
                    <input style={styles.formInput} type="number" value={form.rack ?? 0} onChange={(e) => setForm({ ...form, rack: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div style={styles.formRowItem}>
                    <label style={styles.formLabel}>槽号 (Slot)</label>
                    <input style={styles.formInput} type="number" value={form.slot ?? 1} onChange={(e) => setForm({ ...form, slot: parseInt(e.target.value) || 1 })} />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>描述</label>
                  <input style={styles.formInput} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div style={styles.modalActions}>
                  <button style={styles.modalBtn} onClick={() => { setShowModal(null); setEditingItem(null); }}>取消</button>
                  <button style={{ ...styles.modalBtn, ...styles.modalBtnPrimary }} onClick={savePlc}>保存</button>
                </div>
              </>
            )}

            {/* 变量表单 */}
            {showModal === 'variable' && (
              <>
                <div style={styles.modalTitle}>{editingItem ? '编辑变量' : '添加变量'}</div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>所属 PLC</label>
                  <select className="ui-select" style={styles.formSelect} value={form.plcId || ''} onChange={(e) => setForm({ ...form, plcId: e.target.value })}>
                    <option value="">选择 PLC</option>
                    {config.plcs.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.ip})</option>
                    ))}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>变量名</label>
                  <input style={styles.formInput} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formRowItem}>
                    <label style={styles.formLabel}>地址类型</label>
                    <select className="ui-select" style={styles.formSelect} value={form.addressType || 'DB'} onChange={(e) => setForm({ ...form, addressType: e.target.value })}>
                      {ADDRESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={styles.formRowItem}>
                    <label style={styles.formLabel}>数据类型</label>
                    <select className="ui-select" style={styles.formSelect} value={form.dataType || 'Real'} onChange={(e) => setForm({ ...form, dataType: e.target.value })}>
                      {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                {form.addressType === 'DB' && (
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>DB 块号</label>
                    <input style={styles.formInput} type="number" value={form.dbNumber ?? 1} onChange={(e) => setForm({ ...form, dbNumber: parseInt(e.target.value) || 1 })} />
                  </div>
                )}
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>起始偏移（字节）</label>
                  <input style={styles.formInput} type="number" value={form.offset ?? 0} onChange={(e) => setForm({ ...form, offset: parseInt(e.target.value) || 0 })} />
                </div>
                {form.dataType === 'Bool' && (
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>位索引 (0-7)</label>
                    <input style={styles.formInput} type="number" min="0" max="7" value={form.bitIndex ?? 0} onChange={(e) => setForm({ ...form, bitIndex: parseInt(e.target.value) || 0 })} />
                  </div>
                )}
                <div style={styles.formRow}>
                  <div style={styles.formRowItem}>
                    <label style={styles.formLabel}>单位</label>
                    <input style={styles.formInput} value={form.unit || ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                  </div>
                  <div style={styles.formRowItem}>
                    <label style={styles.formLabel}>描述</label>
                    <input style={styles.formInput} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                </div>
                <div style={styles.modalActions}>
                  <button style={styles.modalBtn} onClick={() => { setShowModal(null); setEditingItem(null); }}>取消</button>
                  <button style={{ ...styles.modalBtn, ...styles.modalBtnPrimary }} onClick={saveVariable}>保存</button>
                </div>
              </>
            )}

            {/* 图表表单 */}
            {showModal === 'chart' && (
              <>
                <div style={styles.modalTitle}>{editingItem ? '编辑图表' : '添加图表'}</div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>图表标题</label>
                  <input style={styles.formInput} value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>时间窗口</label>
                  <select className="ui-select" style={styles.formSelect} value={form.timeWindow ?? 30} onChange={(e) => setForm({ ...form, timeWindow: parseInt(e.target.value) })}>
                    <option value={30}>30 秒</option>
                    <option value={60}>1 分钟</option>
                    <option value={300}>5 分钟</option>
                    <option value={1800}>30 分钟</option>
                  </select>
                </div>
                <div style={{
                  padding: '10px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.sm,
                  backgroundColor: colors.surfaceMuted,
                  fontSize: '12px',
                  color: colors.textSecondary,
                  lineHeight: 1.7,
                }}>
                  坐标轴与变量分配请在仪表盘中通过拖拽配置：拖动左侧变量到图表区域可加入同一坐标轴或新建坐标轴，每个坐标轴可单独设置 Y 范围。
                </div>
                <div style={styles.modalActions}>
                  <button style={styles.modalBtn} onClick={() => { setShowModal(null); setEditingItem(null); }}>取消</button>
                  <button style={{ ...styles.modalBtn, ...styles.modalBtnPrimary }} onClick={saveChart}>保存</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
