// db/index.js — єдиний модуль для роботи з базою даних
const Database = require('better-sqlite3');
const fs       = require('fs');
const path     = require('path');

const { applyInitialSchema } = require('../schema/initial');
const { applyMigrations }    = require('../schema/migrations');

const DB_PATH = path.resolve(__dirname, '../..', 'Drawn Stories Parser', 'comicsdb.db');

let db = null;

// ── Заглушка saveDatabase — більше не потрібна ──────────────────────────────
// better-sqlite3 пише у файл при кожній операції автоматично.
// Лишаємо для зворотної сумісності з кодом що її імпортує.
function saveDatabase() {
  // no-op
}

// ── Обгортка для sql.js-сумісності (тільки для schema/*.js) ────────────────
// schema/initial.js та schema/migrations.js викликають db.run() і db.prepare()
// в стилі sql.js. Ця обгортка транслює їх у better-sqlite3 API.
function createCompatWrapper(betterDb) {
  return {
    run(sql, params = []) {
      if (params && params.length > 0) {
        betterDb.prepare(sql).run(params);
      } else {
        betterDb.exec(sql);
      }
    },
    prepare(sql) {
      let boundParams = [];
      let rows = [];
      let rowIndex = 0;
      let executed = false;

      return {
        bind(params) {
          boundParams = params;
        },
        step() {
          if (!executed) {
            rows = betterDb.prepare(sql).all(boundParams);
            executed = true;
          }
          if (rowIndex < rows.length) {
            rowIndex++;
            return true;
          }
          return false;
        },
        getAsObject() {
          return rows[rowIndex - 1] || null;
        },
        free() {
          rows = [];
          rowIndex = 0;
          executed = false;
        },
      };
    },
  };
}

// ── Хелпери запитів ────────────────────────────────────────────────────────

function runQuery(sql, params = []) {
  try {
    db.prepare(sql).run(params);
    return { success: true };
  } catch (error) {
    console.error('runQuery error:', sql, error.message);
    throw error;
  }
}

function getAll(sql, params = []) {
  try {
    return db.prepare(sql).all(params);
  } catch (error) {
    console.error('getAll error:', sql, error.message);
    return [];
  }
}

function getOne(sql, params = []) {
  try {
    return db.prepare(sql).get(params) ?? null;
  } catch (error) {
    console.error('getOne error:', sql, error.message);
    return null;
  }
}

function rawRun(sql, params = []) {
  db.prepare(sql).run(params);
}

// ── Ініціалізація ──────────────────────────────────────────────────────────

async function initDatabase() {
  const dbExists = fs.existsSync(DB_PATH);

  db = new Database(DB_PATH);

  // WAL: парсер може писати у файл поки сервер читає — без блокувань
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const compat = createCompatWrapper(db);

  if (dbExists) {
    console.log('Завантаження існуючої бази даних...');
    applyMigrations(compat, saveDatabase);
    console.log('✅ База даних завантажена');
  } else {
    console.log('Створення нової бази даних...');
    applyInitialSchema(compat);
    console.log('✅ Нову базу даних створено');
  }
}

module.exports = {
  initDatabase,
  saveDatabase,
  runQuery,
  getAll,
  getOne,
  rawRun,
};