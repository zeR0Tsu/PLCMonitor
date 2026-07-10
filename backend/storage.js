const path = require('path');
const fs = require('fs');

/**
 * SQLite 存储层（支持 sql.js 和 better-sqlite3 双引擎）
 * 保存降采样数据（如 1 秒聚合），最多保留 30 分钟
 */
class Storage {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'data', 'plc_data.db');
    this._db = null;
    this._engine = null; // 'sqljs' or 'better'
  }

  /**
   * 初始化数据库连接并建表
   */
  async initialize() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 优先尝试 better-sqlite3（性能更好），回退到 sql.js
    try {
      const Database = require('better-sqlite3');
      this._db = new Database(this.dbPath);
      this._db.pragma('journal_mode = WAL');
      this._engine = 'better';
      console.log('[Storage] 使用 better-sqlite3 引擎');
    } catch (_) {
      // 回退到 sql.js
      try {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();
        if (fs.existsSync(this.dbPath)) {
          const buffer = fs.readFileSync(this.dbPath);
          this._db = new SQL.Database(buffer);
        } else {
          this._db = new SQL.Database();
        }
        this._engine = 'sqljs';
        console.log('[Storage] 使用 sql.js 引擎');
      } catch (err2) {
        console.error('[Storage] 无法初始化数据库引擎:', err2.message);
        return;
      }
    }

    this._db.run(`
      CREATE TABLE IF NOT EXISTS plc_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plc_id TEXT NOT NULL,
        variable_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        value_real REAL,
        value_int INTEGER,
        value_bool INTEGER,
        quality TEXT DEFAULT 'good'
      )
    `);

    this._db.run(`
      CREATE INDEX IF NOT EXISTS idx_data_time
        ON plc_data(plc_id, variable_id, timestamp)
    `);

    // 启动定期清理任务（每 60 秒清理一次过期数据）
    this._startCleanup();

    console.log(`[Storage] 数据库已初始化: ${this.dbPath}`);
  }

  /**
   * 插入一条数据
   */
  insert(data) {
    if (!this._db) return;
    const sql = `INSERT INTO plc_data (plc_id, variable_id, timestamp, value_real, value_int, value_bool, quality)
      VALUES (?, ?, ?, ?, ?, ?, ?)`;

    const valueReal = typeof data.value === 'number' ? data.value : null;
    const valueInt = Number.isInteger(data.value) ? data.value : null;
    const valueBool = typeof data.value === 'number' && (data.value === 0 || data.value === 1) ? data.value : null;

    try {
      this._db.run(sql, [
        data.plcId,
        data.variableId,
        data.timestamp,
        valueReal,
        valueInt,
        valueBool,
        data.quality || 'good',
      ]);
      this._saveIfSqljs();
    } catch (err) {
      console.error('[Storage] 插入失败:', err.message);
    }
  }

  /**
   * 批量插入数据（事务）
   */
  insertBatch(dataArray) {
    if (!this._db || dataArray.length === 0) return;

    try {
      if (this._engine === 'better') {
        const insert = this._db.transaction((items) => {
          const stmt = this._db.prepare(
            `INSERT INTO plc_data (plc_id, variable_id, timestamp, value_real, value_int, value_bool, quality)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          );
          for (const data of items) {
            stmt.run(
              data.plcId,
              data.variableId,
              data.timestamp,
              typeof data.value === 'number' ? data.value : null,
              Number.isInteger(data.value) ? data.value : null,
              typeof data.value === 'number' && (data.value === 0 || data.value === 1) ? data.value : null,
              data.quality || 'good'
            );
          }
        });
        insert(dataArray);
      } else {
        // sql.js: 使用手动事务
        this._db.run('BEGIN TRANSACTION');
        const sql = `INSERT INTO plc_data (plc_id, variable_id, timestamp, value_real, value_int, value_bool, quality)
          VALUES (?, ?, ?, ?, ?, ?, ?)`;
        for (const data of dataArray) {
          this._db.run(sql, [
            data.plcId,
            data.variableId,
            data.timestamp,
            typeof data.value === 'number' ? data.value : null,
            Number.isInteger(data.value) ? data.value : null,
            typeof data.value === 'number' && (data.value === 0 || data.value === 1) ? data.value : null,
            data.quality || 'good',
          ]);
        }
        this._db.run('COMMIT');
        this._saveIfSqljs();
      }
    } catch (err) {
      console.error('[Storage] 批量插入失败:', err.message);
    }
  }

  /**
   * 查询历史数据
   */
  query(variableId, startTime, endTime) {
    if (!this._db) return [];
    try {
      const sql = `SELECT timestamp, value_real, value_int, value_bool, quality
        FROM plc_data
        WHERE variable_id = ? AND timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC`;

      let rows;
      if (this._engine === 'better') {
        const stmt = this._db.prepare(sql);
        rows = stmt.all(variableId, startTime, endTime);
      } else {
        const stmt = this._db.prepare(sql);
        stmt.bind([variableId, startTime, endTime]);
        rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
      }

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

  /**
   * 删除指定时间之前的数据
   */
  _deleteOlderThan(beforeTimestamp) {
    if (!this._db) return;
    try {
      this._db.run('DELETE FROM plc_data WHERE timestamp < ?', [beforeTimestamp]);
      this._saveIfSqljs();
    } catch (_) { /* ignore */ }
  }

  /**
   * 启动定期清理（保留最近 30 分钟数据）
   */
  _startCleanup() {
    const CLEANUP_INTERVAL = 60000;
    const RETENTION_MS = 30 * 60 * 1000;

    this._cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - RETENTION_MS;
      this._deleteOlderThan(cutoff);
    }, CLEANUP_INTERVAL);
  }

  /**
   * sql.js 需要手动保存到文件
   */
  _saveIfSqljs() {
    if (this._engine === 'sqljs' && this._db) {
      try {
        const data = this._db.export();
        fs.writeFileSync(this.dbPath, Buffer.from(data));
      } catch (_) { /* ignore */ }
    }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    if (this._db) {
      this._saveIfSqljs();
      if (this._engine === 'better') {
        this._db.close();
      } else {
        this._db.close();
      }
      this._db = null;
      console.log('[Storage] 数据库已关闭');
    }
  }
}

module.exports = Storage;
