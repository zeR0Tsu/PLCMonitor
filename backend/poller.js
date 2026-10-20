const PlcClient = require('./plc-client');
const RingBuffer = require('./ring-buffer');
const Storage = require('./storage');
const Notifier = require('./notifier');

const MAX_CONSECUTIVE_FAILURES = 10;
const STORAGE_SAMPLE_MS = 1000;
const RECONNECT_DELAY_MS = 2000;

/**
 * 轮询引擎
 * 负责多台 PLC 的按需连接、非重叠定时轮询与数据分发
 */
class Poller {
  constructor(options = {}) {
    this._plcClients = new Map();
    this._plcVariables = new Map();
    this._plcSignatures = new Map();
    this._timers = new Map();
    this._failures = new Map();
    this._lastStoredAt = new Map();
    this._intervalMs = 100;
    this._simulation = false;

    this.ringBuffer = new RingBuffer(18000);
    this.storage = new Storage(options.dbPath || process.env.PLC_DB_PATH);
    this.notifier = new Notifier();

    this._dataCallbacks = [];
  }

  /** 初始化引擎：注册配置并等待存储就绪，不自动连接 */
  async initialize(config) {
    this._applyServerOptions(config);
    await this.storage.initialize();
    this.syncConfig(config);
    console.log(`[Poller] 初始化完成: ${this._plcClients.size} 台 PLC, 共 ${config.variables?.length || 0} 个变量`);
  }

  /** 配置热更新：增删改 PLC 后无需重启后端 */
  syncConfig(config) {
    this._applyServerOptions(config);

    const plcs = config.plcs || [];
    const variables = config.variables || [];
    const keepIds = new Set(plcs.map((p) => p.id));

    for (const [plcId, client] of this._plcClients) {
      if (keepIds.has(plcId)) continue;
      this._stopPolling(plcId);
      client.disconnect();
      this._plcClients.delete(plcId);
      this._plcVariables.delete(plcId);
      this._plcSignatures.delete(plcId);
      this._failures.delete(plcId);
      this._lastStoredAt.delete(plcId);
      this.notifier.removeStatus(plcId);
    }

    const varMap = new Map();
    for (const v of variables) {
      if (!varMap.has(v.plcId)) varMap.set(v.plcId, []);
      varMap.get(v.plcId).push(v);
    }

    for (const plc of plcs) {
      const signature = `${plc.ip}|${plc.rack ?? 0}|${plc.slot ?? 1}|${plc.simulate === true}`;
      const existing = this._plcClients.get(plc.id);

      if (existing && this._plcSignatures.get(plc.id) === signature) {
        existing.name = plc.name;
      } else {
        if (existing) {
          this._stopPolling(plc.id);
          existing.disconnect();
        }
        const client = this._createClient(plc);
        this._plcClients.set(plc.id, client);
        this._plcSignatures.set(plc.id, signature);
        client.on('connect', () => this.notifier.updateStatus(plc.id, true));
        client.on('disconnect', () => this.notifier.updateStatus(plc.id, false, '已断开'));
      }

      this._plcVariables.set(plc.id, varMap.get(plc.id) || []);
      if (!this.notifier.getStatus(plc.id)) {
        this.notifier.ensureStatus(plc.id);
      }
    }
  }

  _applyServerOptions(config) {
    const interval = Number(config.server?.pollIntervalMs);
    if (Number.isFinite(interval) && interval >= 50) {
      this._intervalMs = interval;
    }
    this._simulation = config.server?.simulation === true;
  }

  _createClient(plc) {
    return new PlcClient({
      ...plc,
      simulate: this._simulation || plc.simulate === true,
    });
  }

  /** 手动连接指定 PLC */
  async connectPlc(plcId) {
    const client = this._plcClients.get(plcId);
    if (!client) return { success: false, error: 'PLC 不存在' };
    if (client.connected) return { success: true };

    const ok = await client.connect();
    if (!ok) {
      const error = client.lastError || '连接失败';
      this.notifier.updateStatus(plcId, false, error);
      return { success: false, error };
    }

    this._failures.set(plcId, 0);
    this.notifier.updateStatus(plcId, true);
    this._startPolling(plcId);
    return { success: true, simulated: client.simulation };
  }

  /** 手动断开指定 PLC */
  disconnectPlc(plcId) {
    const client = this._plcClients.get(plcId);
    if (!client) return;
    this._stopPolling(plcId);
    client.disconnect();
    this._failures.delete(plcId);
    this.notifier.updateStatus(plcId, false, '已手动断开');
  }

  disconnectAll() {
    for (const plcId of this._plcClients.keys()) {
      this.disconnectPlc(plcId);
    }
    console.log('[Poller] 所有 PLC 已断开');
  }

  _startPolling(plcId) {
    if (this._timers.has(plcId)) return;
    const variables = this._plcVariables.get(plcId) || [];
    if (variables.length === 0) {
      console.warn(`[Poller] PLC ${plcId} 没有变量，跳过轮询`);
      return;
    }

    const tick = async () => {
      this._timers.delete(plcId);
      await this._pollOnce(plcId);
      // 轮询结束再排下一次，保证请求不会重叠堆积
      if (this._plcClients.get(plcId)?.connected) {
        this._timers.set(plcId, setTimeout(tick, this._intervalMs));
      }
    };

    this._timers.set(plcId, setTimeout(tick, 0));
    console.log(`[Poller] PLC ${plcId} 轮询已启动 (${this._intervalMs}ms)`);
  }

  _stopPolling(plcId) {
    const timer = this._timers.get(plcId);
    if (timer) {
      clearTimeout(timer);
      this._timers.delete(plcId);
      console.log(`[Poller] PLC ${plcId} 轮询已停止`);
    }
  }

  async _pollOnce(plcId) {
    const client = this._plcClients.get(plcId);
    const variables = this._plcVariables.get(plcId) || [];
    if (!client || !client.connected) {
      this._stopPolling(plcId);
      return;
    }

    const now = Date.now();
    let results;
    try {
      results = await client.batchRead(variables);
    } catch (err) {
      console.error(`[Poller] PLC ${plcId} 轮询异常:`, err.message);
      results = [];
    }

    const goodCount = results.filter((r) => r.quality === 'good').length;

    if (results.length === 0 || goodCount === 0) {
      await this._handleCollectionFailure(plcId, client, results[0]?.error);
      return;
    }

    this._failures.set(plcId, 0);

    for (const r of results) {
      if (r.quality === 'good') {
        this.ringBuffer.push(r.variableId, now, r.value, r.quality);
      }
    }

    const lastStored = this._lastStoredAt.get(plcId) || 0;
    if (now - lastStored >= STORAGE_SAMPLE_MS) {
      this._lastStoredAt.set(plcId, now);
      this.storage.insertBatch(
        results
          .filter((r) => r.quality === 'good')
          .map((r) => ({
            plcId,
            variableId: r.variableId,
            timestamp: now,
            value: r.value,
            quality: r.quality,
          }))
      );
    }

    this._emitData({
      timestamp: now,
      plcId,
      values: results.map((r) => ({
        variableId: r.variableId,
        value: r.value,
        quality: r.quality,
      })),
    });
  }

  async _handleCollectionFailure(plcId, client, error) {
    const failures = (this._failures.get(plcId) || 0) + 1;
    this._failures.set(plcId, failures);
    console.warn(`[Poller] PLC ${plcId} 连续采集失败 ${failures} 次`);

    if (failures < MAX_CONSECUTIVE_FAILURES) return;

    this._stopPolling(plcId);
    this._failures.set(plcId, 0);
    this.notifier.updateStatus(plcId, false, error || '采集连续失败');
    console.warn(`[Poller] PLC ${plcId} 重建连接...`);
    client.recreateClient();

    setTimeout(async () => {
      if (this._plcClients.get(plcId) !== client) return;
      const ok = await client.connect();
      if (ok) {
        this.notifier.updateStatus(plcId, true);
        this._startPolling(plcId);
        console.log(`[Poller] PLC ${plcId} 重连成功`);
      } else {
        this.notifier.updateStatus(plcId, false, client.lastError || '重连失败，请手动连接');
      }
    }, RECONNECT_DELAY_MS);
  }

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
  get intervalMs() { return this._intervalMs; }

  getLatestValues() {
    const result = {};
    for (const [variableId, entry] of this.ringBuffer.getLatestValues()) {
      result[variableId] = entry;
    }
    return result;
  }

  shutdown() {
    for (const plcId of [...this._timers.keys()]) this._stopPolling(plcId);
    for (const [, client] of this._plcClients) client.disconnect();
    this.storage.close();
    this.ringBuffer.clearAll();
    this.notifier.reset();
    console.log('[Poller] 引擎已关闭');
  }
}

module.exports = Poller;
