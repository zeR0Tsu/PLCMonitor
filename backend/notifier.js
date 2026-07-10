/**
 * 连接状态通知管理
 * 管理各 PLC 的连接状态，并在状态变化时通知回调
 */
class Notifier {
  constructor() {
    this._plcStatuses = new Map(); // Map<plcId, { connected, lastUpdate, error? }>
    this._listeners = new Map();   // Map<event, Function[]>
  }

  /**
   * 更新 PLC 连接状态
   * @param {string} plcId
   * @param {boolean} connected
   * @param {string} [error]
   */
  updateStatus(plcId, connected, error) {
    const prev = this._plcStatuses.get(plcId);
    const changed = !prev || prev.connected !== connected;

    this._plcStatuses.set(plcId, {
      connected,
      lastUpdate: Date.now(),
      error: error || null,
    });

    if (changed) {
      if (connected) {
        console.log(`[Notifier] PLC ${plcId} 连接已恢复`);
        this._emit('connected', plcId);
      } else {
        console.log(`[Notifier] PLC ${plcId} 连接已断开: ${error || ''}`);
        this._emit('disconnected', plcId, error || '');
      }
    }
  }

  /**
   * 获取所有 PLC 的连接状态
   * @returns {Array<{ plcId, connected, lastUpdate, error }>}
   */
  getAllStatuses() {
    const result = [];
    for (const [plcId, status] of this._plcStatuses) {
      result.push({ plcId, ...status });
    }
    return result;
  }

  /**
   * 获取指定 PLC 的状态
   */
  getStatus(plcId) {
    return this._plcStatuses.get(plcId) || null;
  }

  /**
   * 获取所有断连的 PLC
   */
  getDisconnectedPlcs() {
    const result = [];
    for (const [plcId, status] of this._plcStatuses) {
      if (!status.connected) {
        result.push({ plcId, ...status });
      }
    }
    return result;
  }

  /**
   * 注册事件监听
   * @param {'connected'|'disconnected'} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
  }

  _emit(event, ...args) {
    const handlers = this._listeners.get(event) || [];
    for (const fn of handlers) {
      try { fn(...args); } catch (_) { /* ignore */ }
    }
  }

  /**
   * 重置所有状态
   */
  reset() {
    this._plcStatuses.clear();
  }
}

module.exports = Notifier;
