// db/index.js — єдиний модуль для роботи з базою даних
const initSqlJs = require('sql.js');
const fs        = require('fs');

const { applyInitialSchema } = require('../schema/initial');
const { applyMigrations }    = require('../schema/migrations');

const DB_PATH = '../Drawn Stories Parser/comicsdb.db';

// Внутрішній стан — db живе тут і більше ніде
let db = null;

// ── Запис ──────────────────────────────────────────────────────────────────

function saveDatabase() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// ── Хелпери запитів ────────────────────────────────────────────────────────

function runQuery(sql, params = []) {
  try {
    db.run(sql, params);
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('runQuery error:', sql, error.message);
    throw error;
  }
}

function getAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const result = [];
    while (stmt.step()) result.push(stmt.getAsObject());
    stmt.free();
    return result;
  } catch (error) {
    console.error('getAll error:', sql, error.message);
    return [];
  }
}

function getOne(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  } catch (error) {
    console.error('getOne error:', sql, error.message);
    return null;
  }
}

// Пряме виконання без збереження (для транзакційних операцій)
function rawRun(sql, params = []) {
  db.run(sql, params);
}

// ── Ініціалізація ──────────────────────────────────────────────────────────

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    console.log('Завантаження існуючої бази даних...');
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    applyMigrations(db, saveDatabase);
    console.log('✅ База даних завантажена');
  } else {
    console.log('Створення нової бази даних...');
    db = new SQL.Database();
    applyInitialSchema(db);
    saveDatabase();
    console.log('✅ Нову базу даних створено');
  }

  db.run('PRAGMA foreign_keys = ON');
}

module.exports = {
  initDatabase,
  saveDatabase,
  runQuery,
  getAll,
  getOne,
  rawRun,
};