const PlcClient = require('./plc-client');
const RingBuffer = require('./ring-buffer');
const Storage = require('./storage');
const Notifier = require('./notifier');

/**
 * 轮询引擎
 * 管理多台 PLC 的按需连接、定时轮询、数据分发
 */
class Poller {
  constructor() {
    this._plcClients = new Map();
    this._plcVariables = new Map();
    this._timers = new Map();
    this._intervalMs = 100;
    this._running = false;

    this.ringBuffer = new RingBuffer(1800);
    this.storage = new Storage();
    this.notifier = new Notifier();

    this._dataCallbacks = [];
  }

  /**
   * 初始化引擎（仅注册配置，不自动连接）
   */
  initialize(config) {
    this.storage.initialize();

    const plcVarMap = new Map();
    for (const v of config.variables || []) {
      if (!plcVarMap.has(v.plcId)) plcVarMap.set(v.plcId, []);
      plcVarMap.get(v.plcId).push(v);
    }

    for (const plc of config.plcs || []) {
      const client = new PlcClient(plc);
      const vars = plcVarMap.get(plc.id) || [];
      this._plcClients.set(plc.id, client);
      this._plcVariables.set(plc.id, vars);

      client.on('connect', () => {
        this.notifier.updateStatus(plc.id, true);
      });
      client.on('disconnect', () => {
        this.notifier.updateStatus(plc.id, false, '已断开');
      });
    }

    // 初始全部为断开状态
    for (const plc of config.plcs || []) {
      this.notifier.updateStatus(plc.id, false, '未连接');
    }

    console.log(`[Poller] 初始化完成: ${this._plcClients.size} 台 PLC, 共 ${config.variables?.length || 0} 个变量`);
  }

  /**
   * 手动连接指定 PLC
   */
  async connectPlc(plcId) {
    const client = this._plcClients.get(plcId);
    if (!client) return { success: false, error: 'PLC 不存在' };
    if (client.connected) return { success: true };

    const ok = await client.connect();
    if (ok) {
      this._startPlcPolling(plcId);
      return { success: true };
    } else {
      return { success: false, error: client._lastError || '连接失败' };
    }
  }

  /**
   * 手动断开指定 PLC
   */
  disconnectPlc(plcId) {
    const client = this._plcClients.get(plcId);
    if (!client) return;
    this._stopPlcPolling(plcId);
    client.disconnect();
  }

  /** 启动指定 PLC 的轮询 */
  _startPlcPolling(plcId) {
    if (this._timers.has(plcId)) return;
    const client = this._plcClients.get(plcId);
    const variables = this._plcVariables.get(plcId) || [];
    if (variables.length === 0) return;

    const timer = setInterval(async () => {
      await this._pollOnce(plcId, client, variables);
    }, this._intervalMs);

    this._timers.set(plcId, timer);
    console.log(`[Poller] PLC ${plcId} 轮询已启动 (${this._intervalMs}ms)`);
  }

  /** 停止指定 PLC 的轮询 */
  _stopPlcPolling(plcId) {
    const timer = this._timers.get(plcId);
    if (timer) {
      clearInterval(timer);
      this._timers.delete(plcId);
      console.log(`[Poller] PLC ${plcId} 轮询已停止`);
    }
  }

  /** 单次轮询 */
  async _pollOnce(plcId, client, variables) {
    if (!client.connected) {
      this._stopPlcPolling(plcId);
      return;
    }

    const now = Date.now();
    try {
      const results = await client.batchRead(variables);

      for (const r of results) {
        this.ringBuffer.push(r.variableId, now, r.value, r.quality);
      }

      const storageData = results.map((r) => ({
        plcId, variableId: r.variableId, timestamp: now,
        value: r.value, quality: r.quality,
      }));
      if (this._storageCounter === undefined) this._storageCounter = 0;
      this._storageCounter++;
      if (this._storageCounter >= 10) {
        this._storageCounter = 0;
        this.storage.insertBatch(storageData);
      }

      this._emitData({
        timestamp: now,
        values: results.map((r) => ({
          variableId: r.variableId, value: r.value, quality: r.quality,
        })),
      });
    } catch (err) {
      console.error(`[Poller] PLC ${plcId} 轮询异常:`, err.message);
    }
  }

  /** 注册数据分发回调 */
  onData(callback) {
    this._dataCallbacks.push(callback);
  }

  _emitData(data) {
    for (const cb of this._dataCallbacks) {
      try { cb(data); } catch (_) { /* ignore */ }
    }
  }

  getClient(plcId) { return this._plcClients.get(plcId) || null; }
  getClients() { return this._plcClients; }
  getVariables(plcId) { return this._plcVariables.get(plcId) || []; }

  /** 关闭引擎 */
  shutdown() {
    for (const [plcId] of this._timers) this._stopPlcPolling(plcId);
    for (const [, client] of this._plcClients) client.disconnect();
    this.storage.close();
    this.ringBuffer.clearAll();
    this.notifier.reset();
    console.log('[Poller] 引擎已关闭');
  }
}

module.exports = Poller;
