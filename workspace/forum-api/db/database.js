'use strict';
/* 数据库层：node:sqlite（DatabaseSync）直连 SQLite
 * - WAL 模式（拍板指令第三节）
 * - schema 幂等初始化（IF NOT EXISTS）
 * - 单例连接；进程内串行写入，配 busy_timeout 兜底
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

let db = null;

function init() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  db = new DatabaseSync(config.DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');   // 必须：拍板要求
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA synchronous = NORMAL;'); // WAL 下安全且更快
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

function get() {
  if (!db) throw new Error('db_not_initialized');
  return db;
}

/* 单值便捷查询 */
function getRow(sql, ...params) {
  return db.prepare(sql).get(...params);
}
function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}
function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

module.exports = { init, get, getRow, all, run };
