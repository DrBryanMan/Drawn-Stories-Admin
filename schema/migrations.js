// schema/migrations.js — виконується при ЗАВАНТАЖЕННІ існуючої бази.
// Кожна міграція ідемпотентна: повторний запуск не зламає нічого.
// Нові міграції додавати в кінець масиву MIGRATIONS.

const MIGRATIONS = [

  // ── M001: поле lang у volumes ────────────────────────────────────────────
  {
    id: 'M001_volumes_lang',
    up(db) {
      db.run(`ALTER TABLE volumes ADD COLUMN lang TEXT`);
    },
  },

  // ── M002: таблиця personnel ──────────────────────────────────────────────
  {
    id: 'M002_personnel',
    up(db) {
      db.run(`CREATE TABLE IF NOT EXISTS personnel (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        bio        TEXT,
        cv_img     TEXT,
        cv_id      INTEGER UNIQUE,
        cv_slug    TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_personnel_name ON personnel(name COLLATE NOCASE)`);
    },
  },

  // ── M003: таблиці events та event_items ──────────────────────────────────
  {
    id: 'M003_events',
    up(db) {
      db.run(`CREATE TABLE IF NOT EXISTS events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        description TEXT,
        cv_img      TEXT,
        start_year  INTEGER,
        end_year    INTEGER,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_events_name ON events(name COLLATE NOCASE)`);

      db.run(`CREATE TABLE IF NOT EXISTS event_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id   INTEGER NOT NULL,
        item_id    INTEGER NOT NULL,
        item_type  TEXT    NOT NULL CHECK(item_type IN ('issue','collection')),
        order_num  INTEGER NOT NULL DEFAULT 0,
        importance TEXT    DEFAULT 'main' CHECK(importance IN ('main','tie-in','prologue','epilogue')),
        UNIQUE(event_id, item_id, item_type),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_event_items_event ON event_items(event_id)`);
    },
  },

  // ── M004: поле name_uk у volumes (українська назва) ─────────────────────
  {
    id: 'M004_volumes_name_uk',
    up(db) {
      db.run(`ALTER TABLE volumes ADD COLUMN name_uk TEXT`);
    },
  },

  // ── Наступні міграції додавати тут у форматі: ────────────────────────────
  // {
  //   id: 'M005_...',
  //   up(db) { db.run(`...`); },
  // },

];

// ── Таблиця міграцій ────────────────────────────────────────────────────────

function ensureMigrationsTable(db) {
  db.run(`CREATE TABLE IF NOT EXISTS _migrations (
    id         TEXT PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}

function isApplied(db, migrationId) {
  const stmt = db.prepare('SELECT id FROM _migrations WHERE id = ?');
  stmt.bind([migrationId]);
  const found = stmt.step();
  stmt.free();
  return found;
}

function markApplied(db, migrationId) {
  db.run('INSERT INTO _migrations (id) VALUES (?)', [migrationId]);
}

// ── Головна функція ─────────────────────────────────────────────────────────

function applyMigrations(db, saveDatabase) {
  ensureMigrationsTable(db);

  let applied = 0;

  for (const migration of MIGRATIONS) {
    if (isApplied(db, migration.id)) continue;

    try {
      migration.up(db);
      markApplied(db, migration.id);
      applied++;
      console.log(`  ✅ Міграція ${migration.id} застосована`);
    } catch (error) {
      // Ігноруємо помилки типу "column already exists" (вже застосована вручну)
      if (error.message && (
        error.message.includes('duplicate column') ||
        error.message.includes('already exists')
      )) {
        markApplied(db, migration.id);
        console.log(`  ⚠️  Міграція ${migration.id} пропущена (вже існує)`);
      } else {
        console.error(`  ❌ Помилка міграції ${migration.id}:`, error.message);
        throw error;
      }
    }
  }

  if (applied > 0) {
    saveDatabase();
    console.log(`✅ Застосовано міграцій: ${applied}`);
  } else {
    console.log('✅ Міграції актуальні');
  }
}

module.exports = { applyMigrations };