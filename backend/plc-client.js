const DATA_TYPE_SIZES = {
  Real: 4, Int: 2, Bool: 1, Word: 2, DWord: 4, DInt: 4,
};

const AREA_CODES = { DB: 0x84, I: 0x81, Q: 0x82, M: 0x83 };

// 尝试加载 node-snap7
let snap7 = null;
let hasSnap7 = false;
try {
  snap7 = require('node-snap7');
  hasSnap7 = true;
  console.log('[PLC-Client] 使用 node-snap7 原生驱动');
} catch (_) {
  console.log('[PLC-Client] node-snap7 不可用，无法连接真实 PLC');
}

class PlcClient {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.ip = config.ip;
    this.rack = config.rack ?? 0;
    this.slot = config.slot ?? 1;
    this.connected = false;
    this.connecting = false;
    this._lastError = null;
    this._listeners = new Map();

    if (hasSnap7) {
      this._s7client = new snap7.S7Client();
    }
  }

  /** 连接 PLC */
  async connect() {
    if (this.connected) return true;
    if (this.connecting) return false;
    if (!hasSnap7) {
      this._lastError = 'node-snap7 未安装';
      return false;
    }

    this.connecting = true;
    this._lastError = null;

    return new Promise((resolve) => {
      try {
        this._s7client.ConnectTo(this.ip, this.rack, this.slot, (err) => {
          this.connecting = false;
          if (err) {
            this.connected = false;
            this._lastError = `连接失败 (${err})`;
            console.error(`[PLC ${this.name}] ${this._lastError}`);
            resolve(false);
          } else {
            this.connected = true;
            this._lastError = null;
            console.log(`[PLC ${this.name}] 连接成功 (${this.ip})`);
            this._emit('connect');
            resolve(true);
          }
        });
      } catch (err) {
        this.connecting = false;
        this._lastError = `连接异常: ${err.message}`;
        console.error(`[PLC ${this.name}] ${this._lastError}`);
        resolve(false);
      }
    });
  }

  /** 断开连接 */
  disconnect() {
    if (hasSnap7 && this._s7client) {
      try { this._s7client.Disconnect(); } catch (_) { /* ignore */ }
    }
    this.connected = false;
    this.connecting = false;
    this._emit('disconnect');
    console.log(`[PLC ${this.name}] 已断开`);
  }

  /** 读取连续字节区域 */
  readArea(area, dbNumber, startOffset, size) {
    return new Promise((resolve, reject) => {
      if (!this.connected) return reject(new Error('PLC 未连接'));
      try {
        this._s7client.ReadArea(area, dbNumber, startOffset, size, snap7.S7WLByte, (err, data) => {
          if (err) reject(new Error(`读取失败: ${err}`));
          else resolve(Buffer.from(data));
        });
      } catch (err) {
        reject(new Error(`读取异常: ${err.message}`));
      }
    });
  }

  /** 批量读取变量（按 DB 块分区读取） */
  async batchRead(variables) {
    if (!this.connected || variables.length === 0) {
      return variables.map((v) => ({ variableId: v.id, value: null, quality: 'bad' }));
    }

    const results = [];
    const groups = new Map();
    for (const v of variables) {
      const key = `${v.addressType}:${v.addressType === 'DB' ? v.dbNumber : 0}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(v);
    }

    for (const [, group] of groups) {
      const area = AREA_CODES[group[0].addressType];
      const dbNumber = group[0].addressType === 'DB' ? (group[0].dbNumber || 1) : 0;
      const sorted = [...group].sort((a, b) => a.offset - b.offset);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const lastSize = DATA_TYPE_SIZES[last.dataType] || 4;
      const readSize = (last.offset + lastSize) - first.offset;

      try {
        const buffer = await this.readArea(area, dbNumber, first.offset, readSize);
        for (const v of group) {
          try {
            const relOffset = v.offset - first.offset;
            const value = this._parseValue(buffer.slice(relOffset), v);
            results.push({ variableId: v.id, value, quality: 'good' });
          } catch (err) {
            results.push({ variableId: v.id, value: null, quality: 'bad', error: err.message });
          }
        }
      } catch (err) {
        for (const v of group) {
          results.push({ variableId: v.id, value: null, quality: 'bad', error: err.message });
        }
      }
    }
    return results;
  }

  _parseValue(buffer, variable) {
    switch (variable.dataType) {
      case 'Real': return buffer.readFloatBE(0);
      case 'Int': return buffer.readInt16BE(0);
      case 'DInt': return buffer.readInt32BE(0);
      case 'Word': return buffer.readUInt16BE(0);
      case 'DWord': return buffer.readUInt32BE(0);
      case 'Bool': return (buffer[0] >> (variable.bitIndex ?? 0)) & 1;
      default: return buffer.readFloatBE(0);
    }
  }

  /** 事件监听 */
  on(event, callback) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(callback);
  }

  _emit(event, ...args) {
    const handlers = this._listeners.get(event) || [];
    for (const fn of handlers) {
      try { fn(...args); } catch (_) { /* ignore */ }
    }
  }
}

module.exports = PlcClient;
