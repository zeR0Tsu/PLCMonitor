import React, { useEffect, useState, useCallback } from 'react';

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
  btnPrimary: {
    backgroundColor: '#fff',
    color: '#1a237e',
    border: 'none',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  },
  tabBar: {
    display: 'flex',
    gap: '0',
    borderBottom: '2px solid #1a237e',
    marginBottom: '24px',
  },
  tab: {
    padding: '10px 24px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    color: '#666',
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#1a237e',
    borderBottomColor: '#1a237e',
    fontWeight: 600,
  },
  section: {
    background: '#fff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '2px solid #e0e0e0',
    color: '#666',
    fontWeight: 600,
    fontSize: '12px',
    textTransform: 'none',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #f0f0f0',
  },
  actionBtn: {
    padding: '4px 10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    marginRight: '6px',
  },
  actionBtnDanger: {
    color: '#F44336',
    borderColor: '#F44336',
  },
  addBtn: {
    marginTop: '12px',
    padding: '8px 20px',
    border: '1px dashed #1a237e',
    borderRadius: '4px',
    background: 'transparent',
    color: '#1a237e',
    cursor: 'pointer',
    fontSize: '13px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: '12px',
    padding: '24px',
    width: '520px',
    maxWidth: '90vw',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '20px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  formLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#666',
    marginBottom: '6px',
  },
  formInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  formSelect: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    background: '#fff',
    boxSizing: 'border-box',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
  },
  formRowItem: {
    flex: 1,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '24px',
  },
  modalBtn: {
    padding: '8px 24px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    border: '1px solid #ddd',
    background: '#fff',
  },
  modalBtnPrimary: {
    backgroundColor: '#1a237e',
    color: '#fff',
    border: 'none',
  },
  chartCard: {
    background: '#fafafa',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid #e0e0e0',
  },
  chartCardTitle: {
    fontSize: '15px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  tag: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    marginRight: '4px',
    marginBottom: '4px',
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
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

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(console.error);
  }, []);

  const saveConfig = useCallback(async (newConfig) => {
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      setConfig(newConfig);
    } catch (err) {
      console.error('保存配置失败:', err);
    }
  }, []);

  // ============ PLC CRUD ============
  const openPlcForm = (plc = null) => {
    setEditingItem(plc);
    setForm(plc || { name: '', ip: '', rack: 0, slot: 1, description: '' });
    setShowModal('plc');
  };

  const savePlc = async () => {
    const updated = { ...config };
    if (editingItem) {
      const resp = await fetch(`/api/plcs/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await resp.json();
      updated.plcs = config.plcs.map((p) => p.id === result.id ? result : p);
    } else {
      const resp = await fetch('/api/plcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await resp.json();
      updated.plcs = [...config.plcs, result];
    }
    setConfig(updated);
    setShowModal(null);
    setEditingItem(null);
  };

  const deletePlc = async (id) => {
    await fetch(`/api/plcs/${id}`, { method: 'DELETE' });
    const updated = { ...config };
    updated.plcs = config.plcs.filter((p) => p.id !== id);
    updated.variables = config.variables.filter((v) => v.plcId !== id);
    updated.charts = config.charts.filter((c) =>
      c.variableIds.some((vid) => updated.variables.some((v) => v.id === vid))
    );
    setConfig(updated);
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
    const updated = { ...config };
    if (editingItem) {
      const resp = await fetch(`/api/variables/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await resp.json();
      updated.variables = config.variables.map((v) => v.id === result.id ? result : v);
    } else {
      const resp = await fetch('/api/variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, plcId: selectedPlcId }),
      });
      const result = await resp.json();
      updated.variables = [...config.variables, result];
    }
    setConfig(updated);
    setShowModal(null);
    setEditingItem(null);
  };

  const deleteVariable = async (id) => {
    await fetch(`/api/variables/${id}`, { method: 'DELETE' });
    const updated = { ...config };
    updated.variables = config.variables.filter((v) => v.id !== id);
    updated.charts = updated.charts.map((c) => ({
      ...c,
      variableIds: c.variableIds.filter((vid) => vid !== id),
    }));
    setConfig(updated);
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
    });
    setShowModal('chart');
  };

  const saveChart = async () => {
    const updated = { ...config };
    const chartData = { ...form, plcId: selectedPlcId };
    if (editingItem) {
      const resp = await fetch(`/api/charts/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chartData),
      });
      const result = await resp.json();
      updated.charts = config.charts.map((c) => c.id === result.id ? result : c);
    } else {
      const resp = await fetch('/api/charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chartData),
      });
      const result = await resp.json();
      updated.charts = [...config.charts, result];
    }
    setConfig(updated);
    setShowModal(null);
    setEditingItem(null);
  };

  const deleteChart = async (id) => {
    await fetch(`/api/charts/${id}`, { method: 'DELETE' });
    const updated = { ...config };
    updated.charts = config.charts.filter((c) => c.id !== id);
    setConfig(updated);
  };

  const toggleChartVariable = (vid) => {
    setForm((prev) => {
      const ids = prev.variableIds || [];
      const newIds = ids.includes(vid)
        ? ids.filter((id) => id !== vid)
        : [...ids, vid];
      return { ...prev, variableIds: newIds };
    });
  };

  if (!config) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>加载中...</div>;
  }

  const plcMap = {};
  config.plcs.forEach((p) => { plcMap[p.id] = p; });

  const varMap = {};
  config.variables.forEach((v) => { varMap[v.id] = v; });

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <div style={styles.topBarTitle}>PLCMonitor - 配置</div>
        <div style={styles.topBarActions}>
          <button
            style={{ ...styles.btn, ...styles.btnPrimary }}
            onClick={() => onNavigate('dashboard')}
          >
            返回仪表板
          </button>
        </div>
      </div>

      <div style={styles.body}>
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
              <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
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
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#666' }}>选择 PLC：</label>
              <select
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
                  <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                    该 PLC 暂无变量定义
                  </div>
                )}
                <button style={styles.addBtn} onClick={() => openVariableForm()}>+ 添加变量</button>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                请先选择 PLC
              </div>
            )}
          </div>
        )}

        {/* 图表布局 */}
        {activeTab === 'charts' && (
          <div style={styles.section}>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#666' }}>选择 PLC：</label>
              <select
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
                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
                      时间窗口: {chart.timeWindow}s
                    </div>
                    <div>
                      <button style={styles.actionBtn} onClick={() => openChartForm(chart)}>编辑</button>
                      <button style={{ ...styles.actionBtn, ...styles.actionBtnDanger }} onClick={() => deleteChart(chart.id)}>删除</button>
                    </div>
                  </div>
                ))}
                {config.charts.filter((c) => c.plcId === selectedPlcId).length === 0 && (
                  <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                    该 PLC 暂无图表布局
                  </div>
                )}
                <button style={styles.addBtn} onClick={() => openChartForm()}>+ 添加图表</button>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                请先选择 PLC
              </div>
            )}
          </div>
        )}
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
                  <select style={styles.formSelect} value={form.plcId || ''} onChange={(e) => setForm({ ...form, plcId: e.target.value })}>
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
                    <select style={styles.formSelect} value={form.addressType || 'DB'} onChange={(e) => setForm({ ...form, addressType: e.target.value })}>
                      {ADDRESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={styles.formRowItem}>
                    <label style={styles.formLabel}>数据类型</label>
                    <select style={styles.formSelect} value={form.dataType || 'Real'} onChange={(e) => setForm({ ...form, dataType: e.target.value })}>
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
                  <select style={styles.formSelect} value={form.timeWindow ?? 30} onChange={(e) => setForm({ ...form, timeWindow: parseInt(e.target.value) })}>
                    <option value={30}>30 秒</option>
                    <option value={60}>1 分钟</option>
                    <option value={300}>5 分钟</option>
                    <option value={1800}>30 分钟</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>包含的变量</label>
                  <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #eee', borderRadius: '6px', padding: '8px' }}>
                    {config.variables.filter((v) => v.plcId === (selectedPlcId || form.plcId)).map((v) => (
                      <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={(form.variableIds || []).includes(v.id)}
                          onChange={() => toggleChartVariable(v.id)}
                        />
                        <span>{v.name}</span>
                        <span style={{ color: '#999', fontSize: '12px' }}>
                          ({v.addressType}{v.addressType === 'DB' ? ` DB${v.dbNumber}` : ''} +{v.offset})
                        </span>
                      </label>
                    ))}
                    {config.variables.filter((v) => v.plcId === (selectedPlcId || form.plcId)).length === 0 && (
                      <div style={{ color: '#999', fontSize: '13px', textAlign: 'center', padding: '12px' }}>
                        该 PLC 暂无可用变量，请先在变量管理中添加
                      </div>
                    )}
                  </div>
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
