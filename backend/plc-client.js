const DATA_TYPE_SIZES = {
  Bool: 1, Byte: 1, Int: 2, Word: 2, DWord: 4, DInt: 4, Real: 4,
};

const AREA_CODES = { DB: 0x84, I: 0x81, Q: 0x82, M: 0x83 };

// 单次读取的最大字节数，避免跨越远端变量时超出 PDU 限制
const MAX_READ_SPAN = 180;

const ERROR_HINTS = {
  10060: '连接超时，请检查 PLC 是否通电、IP 是否正确、防火墙是否放行 TCP 102 端口',
  10061: '连接被拒绝，PLC 可能未开放 S7 连接资源',
  10065: 'PLC 拒绝连接：常见原因是连接资源已被占用（TIA Portal、其他上位机或上一次连接尚未释放）。请关闭其他客户端，或等待 5-10 秒后重试；若持续失败请核对 IP、机架和槽号',
  10051: '网络不可达，请检查网络连接和路由设置',
  10049: '本地地址不可用',
};

const SIMULATION_ENABLED = String(process.env.PLC_SIMULATE || '') === '1';

/** 显式开启时才使用的调试用 S7 后端，不参与真实采集 */
class SimulatedS7 {
  constructor(seed = 0) {
    this._connected = false;
    this._phase = (seed % 360) * 0.05;
    this.PDULength = () => 240;
    this.CONNTYPE_OP = 2;
  }

  SetConnectionType() {}

  ConnectTo(ip, rack, slot, callback) {
    this._timer = setTimeout(() => {
      this._connected = true;
      callback(null);
    }, 200);
  }

  Disconnect() {
    clearTimeout(this._timer);
    this._connected = false;
  }

  ReadArea(area, dbNumber, start, size, wordLen, callback) {
    if (!this._connected) {
      callback(0x0b);
      return;
    }
    const buffer = Buffer.alloc(size);
    const t = Date.now() / 1000 + this._phase;
    for (let i = 0; i < size; i += 4) {
      const base = start + i + dbNumber * 7;
      const value =
        Math.sin(t * 0.7 + base * 0.05) * 60 +
        Math.sin(t * 0.13 + base * 0.02) * 15 +
        dbNumber;
      const chunk = Buffer.alloc(4);
      chunk.writeFloatBE(value, 0);
      chunk.copy(buffer, i, 0, Math.min(4, size - i));
    }
    setTimeout(() => callback(null, buffer), 2);
  }

  ErrorText(err) {
    return err === 0 ? '成功' : `模拟错误 ${err}`;
  }
}

let snap7 = null;
try {
  snap7 = require('node-snap7');
  console.log('[PLC-Client] node-snap7 已加载');
} catch (_) {
  console.warn('[PLC-Client] node-snap7 不可用，仅能使用模拟模式（PLC_SIMULATE=1）');
}

function hashSeed(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 100000;
  }
  return hash;
}

function errHint(err) {
  return ERROR_HINTS[err] || '';
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
    this.lastError = null;
    this._listeners = new Map();

    this.simulation = config.simulate === true || SIMULATION_ENABLED;

    if (this.simulation) {
      this._s7client = new SimulatedS7(hashSeed(`${config.id}:${config.ip}`));
      this._wordLen = 0;
      console.log(`[PLC ${this.name}] 模拟模式已启用（仅用于调试）`);
    } else if (snap7) {
      this._s7client = new snap7.S7Client();
      this._wordLen = this._s7client.S7WLByte;
      try { this._s7client.SetConnectionType(this._s7client.CONNTYPE_OP); } catch (_) { /* ignore */ }
    } else {
      this._s7client = null;
      this._wordLen = 0;
    }
  }

  get lastError() {
    return this._lastError;
  }

  set lastError(message) {
    this._lastError = message;
  }

  /** 连接 PLC */
  async connect() {
    if (this.connected) return true;
    if (this.connecting) return false;

    if (!this._s7client) {
      this._lastError = 'node-snap7 未安装，无法连接真实 PLC（调试可用 PLC_SIMULATE=1 启动）';
      return false;
    }

    this.connecting = true;
    this._lastError = null;
    console.log(`[PLC ${this.name}] 正在连接 ${this.ip} rack=${this.rack} slot=${this.slot}${this.simulation ? ' (simulate)' : ''}`);

    return new Promise((resolve) => {
      try {
        this._s7client.ConnectTo(this.ip, this.rack, this.slot, (err) => {
          this.connecting = false;
          if (err) {
            this.connected = false;
            // 失败后释放本地半开连接，避免下次重试继续报错
            try { this._s7client.Disconnect(); } catch (_) { /* ignore */ }
            const errText = this._s7client.ErrorText(err);
            const hint = errHint(err);
            this._lastError = `连接失败 (${err}) ${errText}${hint ? '\n' + hint : ''}`;
            console.error(`[PLC ${this.name}] ${this._lastError}`);
            resolve(false);
            return;
          }
          this.connected = true;
          this._lastError = null;
          console.log(`[PLC ${this.name}] 连接成功 (${this.ip})`);
          this._emit('connect');
          resolve(true);
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
    try { this._s7client?.Disconnect(); } catch (_) { /* ignore */ }
    const wasConnected = this.connected;
    this.connected = false;
    this.connecting = false;
    if (wasConnected) this._emit('disconnect');
    console.log(`[PLC ${this.name}] 已断开`);
  }

  /** 读取连续字节区域 */
  readArea(area, dbNumber, startOffset, size) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this._s7client) {
        reject(new Error('PLC 未连接'));
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('读取超时'));
      }, 3000);

      try {
        this._s7client.ReadArea(area, dbNumber, startOffset, size, this._wordLen, (err, data) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (err) reject(new Error(`读取失败: ${this._s7client.ErrorText(err)}`));
          else resolve(Buffer.from(data));
        });
      } catch (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`读取异常: ${err.message}`));
      }
    });
  }

  /** 批量读取变量（按区域/DB 分组并分块，避免 PDU 超限） */
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
      const area = AREA_CODES[group[0].addressType] ?? AREA_CODES.DB;
      const dbNumber = group[0].addressType === 'DB' ? (group[0].dbNumber || 1) : 0;
      const sorted = [...group].sort((a, b) => a.offset - b.offset);

      for (const chunk of this._splitIntoChunks(sorted)) {
        const first = chunk[0];
        const last = chunk[chunk.length - 1];
        const lastSize = DATA_TYPE_SIZES[last.dataType] || 4;
        const readSize = last.offset + lastSize - first.offset;

        try {
          const buffer = await this.readArea(area, dbNumber, first.offset, readSize);
          for (const v of chunk) {
            const relOffset = v.offset - first.offset;
            try {
              results.push({
                variableId: v.id,
                value: this._parseValue(buffer, relOffset, v),
                quality: 'good',
              });
            } catch (err) {
              results.push({ variableId: v.id, value: null, quality: 'bad', error: err.message });
            }
          }
        } catch (err) {
          for (const v of chunk) {
            results.push({ variableId: v.id, value: null, quality: 'bad', error: err.message });
          }
        }
      }
    }
    return results;
  }

  _splitIntoChunks(sorted) {
    const chunks = [];
    let current = [];
    let chunkStart = 0;
    let chunkEnd = 0;

    for (const v of sorted) {
      const size = DATA_TYPE_SIZES[v.dataType] || 4;
      const end = v.offset + size;
      if (current.length > 0 && end - chunkStart > MAX_READ_SPAN) {
        chunks.push(current);
        current = [];
      }
      if (current.length === 0) {
        chunkStart = v.offset;
        chunkEnd = end;
      } else {
        chunkEnd = Math.max(chunkEnd, end);
      }
      current.push(v);
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  _parseValue(buffer, offset, variable) {
    switch (variable.dataType) {
      case 'Real': return buffer.readFloatBE(offset);
      case 'Int': return buffer.readInt16BE(offset);
      case 'DInt': return buffer.readInt32BE(offset);
      case 'Word': return buffer.readUInt16BE(offset);
      case 'DWord': return buffer.readUInt32BE(offset);
      case 'Byte': return buffer.readUInt8(offset);
      case 'Bool': return (buffer[offset] >> (variable.bitIndex ?? 0)) & 1;
      default: throw new Error(`不支持的数据类型: ${variable.dataType}`);
    }
  }

  /** 销毁并重建客户端（用于从卡死状态恢复） */
  recreateClient() {
    try { this._s7client?.Disconnect(); } catch (_) { /* ignore */ }
    if (this.simulation) {
      this._s7client = new SimulatedS7(hashSeed(`${this.id}:${this.ip}`));
      this._wordLen = 0;
    } else if (snap7) {
      this._s7client = new snap7.S7Client();
      this._wordLen = this._s7client.S7WLByte;
      try { this._s7client.SetConnectionType(this._s7client.CONNTYPE_OP); } catch (_) { /* ignore */ }
    }
    this.connected = false;
    this.connecting = false;
    this._lastError = null;
  }

  on(event, callback) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(callback);
  }

  _emit(event, ...args) {
    for (const fn of this._listeners.get(event) || []) {
      try { fn(...args); } catch (_) { /* ignore */ }
    }
  }
}

module.exports = PlcClient;
