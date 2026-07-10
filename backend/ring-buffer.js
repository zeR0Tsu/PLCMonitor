/**
 * 内存环形缓冲区
 * 保存最近 N 条原始 10Hz 数据，供前端实时图表使用
 */
class RingBuffer {
  /**
   * @param {number} capacity - 每个变量的最大缓存条数
   */
  constructor(capacity = 1800) {
    this._capacity = capacity;
    this._buffers = new Map(); // Map<variableId, CircularArray>
  }

  /**
   * 追加一条数据
   * @param {string} variableId
   * @param {number} timestamp - Unix 毫秒时间戳
   * @param {number|null} value
   * @param {string} quality
   */
  push(variableId, timestamp, value, quality = 'good') {
    if (!this._buffers.has(variableId)) {
      this._buffers.set(variableId, new CircularArray(this._capacity));
    }
    this._buffers.get(variableId).push({ timestamp, value, quality });
  }

  /**
   * 批量追加多条数据
   * @param {Array} entries - [{ variableId, timestamp, value, quality }]
   */
  pushBatch(entries) {
    for (const entry of entries) {
      this.push(entry.variableId, entry.timestamp, entry.value, entry.quality);
    }
  }

  /**
   * 获取某个变量的所有缓存数据
   * @param {string} variableId
   * @returns {Array<{ timestamp, value, quality }>}
   */
  get(variableId) {
    const buf = this._buffers.get(variableId);
    return buf ? buf.toArray() : [];
  }

  /**
   * 获取多个变量的缓存数据
   * @param {string[]} variableIds
   * @returns {Map<string, Array>}
   */
  getMultiple(variableIds) {
    const result = new Map();
    for (const vid of variableIds) {
      result.set(vid, this.get(vid));
    }
    return result;
  }

  /**
   * 获取某个变量在时间范围内的数据
   * @param {string} variableId
   * @param {number} sinceTimestamp - 起始时间戳（含）
   * @returns {Array}
   */
  getSince(variableId, sinceTimestamp) {
    const buf = this._buffers.get(variableId);
    if (!buf) return [];
    return buf.toArray().filter((item) => item.timestamp >= sinceTimestamp);
  }

  /**
   * 获取所有变量的最新值
   * @returns {Map<string, { timestamp, value, quality }|null>}
   */
  getLatestValues() {
    const result = new Map();
    for (const [vid, buf] of this._buffers) {
      const arr = buf.toArray();
      result.set(vid, arr.length > 0 ? arr[arr.length - 1] : null);
    }
    return result;
  }

  /**
   * 清空某个变量的缓存
   */
  clear(variableId) {
    this._buffers.delete(variableId);
  }

  /**
   * 清空所有缓存
   */
  clearAll() {
    this._buffers.clear();
  }

  /**
   * 获取当前缓存统计
   */
  stats() {
    const stats = {};
    for (const [vid, buf] of this._buffers) {
      stats[vid] = buf.size();
    }
    return stats;
  }
}

/**
 * 环形数组（内部实现）
 */
class CircularArray {
  constructor(capacity) {
    this._capacity = capacity;
    this._buffer = new Array(capacity);
    this._size = 0;
    this._head = 0; // 写入位置
  }

  push(item) {
    this._buffer[this._head] = item;
    this._head = (this._head + 1) % this._capacity;
    if (this._size < this._capacity) {
      this._size++;
    }
  }

  toArray() {
    if (this._size === 0) return [];
    const result = new Array(this._size);
    const start = this._size < this._capacity
      ? 0
      : this._head;
    for (let i = 0; i < this._size; i++) {
      result[i] = this._buffer[(start + i) % this._capacity];
    }
    return result;
  }

  size() {
    return this._size;
  }
}

module.exports = RingBuffer;
