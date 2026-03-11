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

  // ── M005: volumes — прибираємо зайвий стовпець themes, ──────────────────
  {
    id: 'M005_volumes_publisher_cleanup',
    up(db) {
      // Видаляємо зайвий стовпець themes (дані зберігаються у volume_themes)
      db.run(`ALTER TABLE volumes DROP COLUMN themes`);

      // Індекс на publisher_id
      db.run(`CREATE INDEX IF NOT EXISTS idx_volumes_publisher ON volumes(publisher)`);
    },
  },

  // ── M006: collections — перейменовуємо publisher → publisher_id, ─────────
  //         додаємо поля issue_number, isbn, cover_date, release_date        
  {
    id: 'M006_collections_improvements',
    up(db) {
      db.run(`ALTER TABLE collections ADD COLUMN issue_number TEXT`);
      db.run(`ALTER TABLE collections ADD COLUMN isbn         TEXT`);
      db.run(`ALTER TABLE collections ADD COLUMN cover_date   TEXT`);
      db.run(`ALTER TABLE collections ADD COLUMN release_date TEXT`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_collections_publisher ON collections(publisher)`);
    },
  },

  // ── M007: issues — додаємо поле description ──────────────────────────────
  {
    id: 'M007_issues_description',
    up(db) {
      db.run(`ALTER TABLE issues ADD COLUMN description TEXT`);
    },
  },

  // ── M008: нові таблиці ───────────────────────────────────────────────────
  //   • character_aliases        — альтернативні імена персонажа             
  //   • issue_characters         — персонажі у випуску                       
  //   • issue_personnel          — творці випуску (автор, художник тощо)     
  //   • reading_order_collections — колекції у порядку читання               
  {
    id: 'M008_new_tables',
    up(db) {

      // Альтернативні імена персонажа (Бетмен / Брюс Вейн / Dark Knight)
      db.run(`CREATE TABLE IF NOT EXISTS character_aliases (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        alias        TEXT    NOT NULL
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_character_aliases_character_id ON character_aliases(character_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_character_aliases_alias        ON character_aliases(alias COLLATE NOCASE)`);

      // Які персонажі є у випуску та їхня роль
      db.run(`CREATE TABLE IF NOT EXISTS issue_characters (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id     INTEGER NOT NULL REFERENCES issues(id)     ON DELETE CASCADE,
        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        role         TEXT    DEFAULT 'hero' CHECK(role IN ('hero','villain','supporting','cameo')),
        UNIQUE(issue_id, character_id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_issue_characters_issue_id     ON issue_characters(issue_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_issue_characters_character_id ON issue_characters(character_id)`);

      // Творці випуску з роллю (writer, penciler, inker, colorist тощо)
      db.run(`CREATE TABLE IF NOT EXISTS issue_personnel (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id     INTEGER NOT NULL REFERENCES issues(id)    ON DELETE CASCADE,
        personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
        role         TEXT    NOT NULL,
        UNIQUE(issue_id, personnel_id, role)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_issue_personnel_issue_id     ON issue_personnel(issue_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_issue_personnel_personnel_id ON issue_personnel(personnel_id)`);

      // Колекції у порядку читання (раніше були лише issues)
      db.run(`CREATE TABLE IF NOT EXISTS reading_order_collections (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        reading_order_id INTEGER NOT NULL REFERENCES reading_orders(id) ON DELETE CASCADE,
        collection_id    INTEGER NOT NULL REFERENCES collections(id)    ON DELETE CASCADE,
        order_num        INTEGER NOT NULL DEFAULT 0,
        UNIQUE(reading_order_id, collection_id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_ro_collections_order         ON reading_order_collections(reading_order_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_ro_collections_collection_id ON reading_order_collections(collection_id)`);
    },
  },

  // ── M009: collection_issues — додаємо order_num для сортування ───────────
  {
    id: 'M009_collection_issues_order',
    up(db) {
      db.run(`ALTER TABLE collection_issues ADD COLUMN order_num INTEGER NOT NULL DEFAULT 0`);
    },
  },

  // ── M010: reading_order_issues — додаємо issue_cv_id ─────────────────────
  {
    id: 'M010_roi_issue_cv_id',
    up(db) {
      // Додаємо колонку
      db.run(`ALTER TABLE reading_order_issues ADD COLUMN issue_cv_id INTEGER`);

      // Заповнюємо існуючі рядки через JOIN з таблицею issues
      db.run(`
        UPDATE reading_order_issues
        SET issue_cv_id = (
          SELECT cv_id FROM issues WHERE issues.id = reading_order_issues.issue_id
        )
        WHERE issue_cv_id IS NULL
      `);

      // Індекс для швидкого пошуку
      db.run(`CREATE INDEX IF NOT EXISTS idx_roi_issue_cv_id ON reading_order_issues(issue_cv_id)`);
    },
  },
   // ── M011: themes — додаємо поле type для жанрів та тем ─────────────────────────────
  {
    id: 'M011_themes_type',
    up(db) {
      // Додаємо колонку type зі значенням за замовчуванням 'theme'
      db.run(`ALTER TABLE themes ADD COLUMN type TEXT NOT NULL DEFAULT 'theme' CHECK(type IN ('genre', 'theme'))`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_themes_type ON themes(type)`);
    },
  },
   // ── M012: volume_translations + volume_magazines ──────────────────────────
  //   • volume_translations — зв'язок оригінал → переклад                    
  //   • volume_magazines    — зв'язок журнал → том                           
  {
    id: 'M012_volume_relations',
    up(db) {
      // Переклади: parent = оригінальний том, child = перекладений том
      db.run(`CREATE TABLE IF NOT EXISTS volume_translations (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        child_id  INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        UNIQUE(parent_id, child_id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_vtrans_parent ON volume_translations(parent_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_vtrans_child  ON volume_translations(child_id)`);

      // Журнали: magazine_id = батьківський том-журнал, child_id = том що входить у журнал
      db.run(`CREATE TABLE IF NOT EXISTS volume_magazines (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        magazine_id INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        child_id    INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        UNIQUE(magazine_id, child_id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_vmag_magazine ON volume_magazines(magazine_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_vmag_child    ON volume_magazines(child_id)`);
    },
  },
  // ── M013: volumes — додаємо поле description ────────────────────────────
  {
    id: 'M013_volumes_description',
    up(db) {
      db.run(`ALTER TABLE volumes ADD COLUMN description TEXT`);
    },
  },
  // ── M014: volume_relations — хронологія та зв'язки між томами ────────────
  {
    id: 'M014_volume_relations',
    up(db) {
      db.run(`CREATE TABLE IF NOT EXISTS volume_relations (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        from_vol_id INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        to_vol_id   INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
        rel_type    TEXT    NOT NULL CHECK(rel_type IN ('continuation','sequel','prequel','spinoff','related')),
        order_num   INTEGER NOT NULL DEFAULT 0,
        UNIQUE(from_vol_id, to_vol_id, rel_type)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_vrel_from ON volume_relations(from_vol_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_vrel_to   ON volume_relations(to_vol_id)`);
    },
  },
  // ── M015: manga volumes support ──────────────────────────────────────────
  //   • volumes  — hikka_slug, mal_id
  //   • issues   — ds_vol_id (посилання на внутрішній том з нашої БД)
  {
    id: 'M015_manga_volumes',
    up(db) {
      db.run(`ALTER TABLE volumes ADD COLUMN hikka_slug TEXT`);
      db.run(`ALTER TABLE volumes ADD COLUMN mal_id     INTEGER`);

      db.run(`ALTER TABLE issues ADD COLUMN ds_vol_id INTEGER REFERENCES volumes(id) ON DELETE SET NULL`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_volumes_hikka_slug ON volumes(hikka_slug)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_volumes_mal_id     ON volumes(mal_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_issues_ds_vol_id   ON issues(ds_vol_id)`);
    },
  },
  // ── M016: volume_themes — додаємо volume_id (внутрішній PK тому) ─────────
  //   Раніше cv_vol_id посилався на volumes.cv_id (зовнішній ідентифікатор CV).
  //   Манґа-томи не мають cv_id, тому переходимо на volume_id → volumes.id.
  //   Стара колонка cv_vol_id лишається для зворотної сумісності (не видаляємо).
  {
    id: 'M016_volume_themes_volume_id',
    up(db) {
      // 1. Додаємо нову колонку
      db.run(`ALTER TABLE volume_themes ADD COLUMN volume_id INTEGER REFERENCES volumes(id) ON DELETE CASCADE`);

      // 2. Заповнюємо для всіх існуючих записів через JOIN
      db.run(`
        UPDATE volume_themes
        SET volume_id = (
          SELECT v.id FROM volumes v WHERE v.cv_id = volume_themes.cv_vol_id
        )
        WHERE volume_id IS NULL
      `);

      // 3. Індекс для швидкого пошуку + унікальність по новій парі
      db.run(`CREATE INDEX IF NOT EXISTS idx_vthemes_volume_id ON volume_themes(volume_id)`);
      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vthemes_volume_theme ON volume_themes(volume_id, theme_id)`);
    },
  },
  // ── M017: volume_themes — пересоздання таблиці ───────────────────────────
  //   Проблема: cv_vol_id було оголошено як REFERENCES volumes(id), але
  //   реально зберігає volumes.cv_id → SQLite падає при UPDATE volumes.
  //   Рішення: пересоздати таблицю без хибного FK на cv_vol_id.
  //   volume_id (додано в M016) — єдиний коректний FK → volumes(id).
  {
    id: 'M017_volume_themes_recreate',
    up(db) {
      // 1. Копіюємо дані у тимчасову таблицю
      db.run(`CREATE TABLE IF NOT EXISTS _vt_backup AS SELECT * FROM volume_themes`);

      // 2. Дропаємо стару таблицю (разом з усіма її індексами і FK)
      db.run(`DROP TABLE IF EXISTS volume_themes`);

      // 3. Створюємо нову — cv_vol_id лишається як просте INTEGER (без FK),
      //    volume_id має коректний FK → volumes(id)
      db.run(`
        CREATE TABLE volume_themes (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          cv_vol_id  INTEGER,
          volume_id  INTEGER REFERENCES volumes(id) ON DELETE CASCADE,
          theme_id   INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
          UNIQUE(volume_id, theme_id)
        )
      `);

      // 4. Відновлюємо дані з бекапу
      db.run(`
        INSERT INTO volume_themes (id, cv_vol_id, volume_id, theme_id)
        SELECT id, cv_vol_id, volume_id, theme_id FROM _vt_backup
      `);

      // 5. Видаляємо тимчасову таблицю
      db.run(`DROP TABLE IF EXISTS _vt_backup`);

      // 6. Індекси
      db.run(`CREATE INDEX IF NOT EXISTS idx_vthemes_volume_id    ON volume_themes(volume_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_vthemes_theme_id     ON volume_themes(theme_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_vthemes_cv_vol_id    ON volume_themes(cv_vol_id)`);
    },
  },

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