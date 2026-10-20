const path = require('path');
const fs = require('fs');

const RETENTION_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const SQLJS_SAVE_INTERVAL_MS = 5000;

/**
 * SQLite 存储层
 * 引擎优先级：better-sqlite3 -> node:sqlite -> sql.js
 * 保存最近 30 分钟的降采样数据
 */
class Storage {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'data', 'plc_data.db');
    this._db = null;
    this._engine = null;
    this._ready = false;
    this._cleanupTimer = null;
    this._saveTimer = null;
    this._dirty = false;
  }

  get ready() {
    return this._ready;
  }

  get engine() {
    return this._engine;
  }

  async initialize() {
    if (this._ready) return true;

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this._db = await this._openDatabase();
    if (!this._db) return false;

    this._db.exec(`
      CREATE TABLE IF NOT EXISTS plc_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plc_id TEXT NOT NULL,
        variable_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        value_real REAL,
        value_int INTEGER,
        value_bool INTEGER,
        quality TEXT DEFAULT 'good'
      );
      CREATE INDEX IF NOT EXISTS idx_data_time
        ON plc_data(plc_id, variable_id, timestamp);
    `);

    this._ready = true;
    this._startCleanup();

    if (this._engine === 'sqljs') {
      this._saveTimer = setInterval(() => this._flushSqljs(), SQLJS_SAVE_INTERVAL_MS);
      this._saveTimer.unref?.();
    }

    console.log(`[Storage] 使用 ${this._engine} 引擎，数据库: ${this.dbPath}`);
    return true;
  }

  async _openDatabase() {
    const adapters = [
      ['better-sqlite3', () => this._openBetterSqlite()],
      ['node:sqlite', () => this._openNodeSqlite()],
      ['sql.js', () => this._openSqljs()],
    ];

    for (const [name, open] of adapters) {
      try {
        const db = await open();
        if (db) {
          this._engine = name;
          return db;
        }
      } catch (err) {
        console.warn(`[Storage] ${name} 不可用: ${err.message}`);
      }
    }

    console.error('[Storage] 没有可用的 SQLite 引擎，历史数据将不会保存');
    return null;
  }

  _openBetterSqlite() {
    const Database = require('better-sqlite3');
    const db = new Database(this.dbPath);
    db.pragma('journal_mode = WAL');
    return {
      exec: (sql) => db.exec(sql),
      prepare: (sql) => {
        const stmt = db.prepare(sql);
        return {
          all: (...params) => stmt.all(...params),
          run: (...params) => stmt.run(...params),
        };
      },
      transaction: (fn) => db.transaction(fn)(),
      close: () => db.close(),
    };
  }

  _openNodeSqlite() {
    // Node.js >= 22.5 提供内置 SQLite；Electron 自带的 Node 版本较低时不具备该模块
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(this.dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    return {
      exec: (sql) => db.exec(sql),
      prepare: (sql) => {
        const stmt = db.prepare(sql);
        return {
          all: (...params) => stmt.all(...params),
          run: (...params) => stmt.run(...params),
        };
      },
      transaction: (fn) => {
        db.exec('BEGIN');
        try {
          fn();
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      },
      close: () => db.close(),
    };
  }

  async _openSqljs() {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const data = fs.existsSync(this.dbPath) ? fs.readFileSync(this.dbPath) : null;
    const db = data ? new SQL.Database(data) : new SQL.Database();
    return {
      exec: (sql) => db.exec(sql),
      prepare: (sql) => ({
        all: (...params) => {
          const stmt = db.prepare(sql);
          try {
            stmt.bind(params);
            const rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
          } finally {
            stmt.free();
          }
        },
        run: (...params) => db.run(sql, params),
      }),
      transaction: (fn) => {
        db.run('BEGIN TRANSACTION');
        try {
          fn();
          db.run('COMMIT');
          this._dirty = true;
        } catch (err) {
          db.run('ROLLBACK');
          throw err;
        }
      },
      close: () => db.close(),
    };
  }

  insert(data) {
    this.insertBatch([data]);
  }

  insertBatch(dataArray) {
    if (!this._ready || !this._db || !dataArray || dataArray.length === 0) return;

    const rows = dataArray.filter((d) => d && d.variableId != null);
    if (rows.length === 0) return;

    try {
      const stmt = this._db.prepare(`INSERT INTO plc_data
        (plc_id, variable_id, timestamp, value_real, value_int, value_bool, quality)
        VALUES (?, ?, ?, ?, ?, ?, ?)`);

      this._db.transaction(() => {
        for (const data of rows) {
          const isNumber = typeof data.value === 'number' && Number.isFinite(data.value);
          stmt.run(
            data.plcId,
            data.variableId,
            data.timestamp,
            isNumber ? data.value : null,
            isNumber && Number.isInteger(data.value) ? data.value : null,
            isNumber && (data.value === 0 || data.value === 1) ? data.value : null,
            data.quality || 'good'
          );
        }
      });
    } catch (err) {
      console.error('[Storage] 批量插入失败:', err.message);
    }
  }

  query(variableId, startTime = 0, endTime = Date.now()) {
    if (!this._ready || !this._db) return [];
    try {
      const stmt = this._db.prepare(`
        SELECT timestamp, value_real, value_int, value_bool, quality
        FROM plc_data
        WHERE variable_id = ? AND timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC
      `);
      const rows = stmt.all(variableId, startTime, endTime);
      return rows.map((row) => ({
        timestamp: row.timestamp,
        value: row.value_real ?? row.value_int ?? row.value_bool,
        quality: row.quality,
      }));
    } catch (err) {
      console.error('[Storage] 查询失败:', err.message);
      return [];
    }
  }

  deleteOlderThan(beforeTimestamp) {
    if (!this._ready || !this._db) return;
    try {
      this._db.prepare('DELETE FROM plc_data WHERE timestamp < ?').run(beforeTimestamp);
    } catch (err) {
      console.error('[Storage] 清理过期数据失败:', err.message);
    }
  }

  _startCleanup() {
    if (this._cleanupTimer) return;
    this._cleanupTimer = setInterval(() => {
      this.deleteOlderThan(Date.now() - RETENTION_MS);
    }, CLEANUP_INTERVAL_MS);
    this._cleanupTimer.unref?.();
  }

  _flushSqljs() {
    if (this._engine !== 'sqljs' || !this._db || !this._dirty) return;
    try {
      // sql.js 没有文件句柄，必须整库导出，因此只在有变更时低频落盘
      const data = this._db.export();
      const tmpPath = `${this.dbPath}.tmp`;
      fs.writeFileSync(tmpPath, Buffer.from(data));
      fs.renameSync(tmpPath, this.dbPath);
      this._dirty = false;
    } catch (err) {
      console.error('[Storage] 写入数据库文件失败:', err.message);
    }
  }

  close() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    if (this._saveTimer) {
      clearInterval(this._saveTimer);
      this._saveTimer = null;
    }
    if (this._db) {
      this._flushSqljs();
      try { this._db.close(); } catch (_) { /* ignore */ }
      this._db = null;
      console.log('[Storage] 数据库已关闭');
    }
    this._ready = false;
  }
}

module.exports = Storage;
