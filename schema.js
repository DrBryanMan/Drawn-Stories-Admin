function applySchema(db) {
  // ── Таблиці ────────────────────────────────────────────────────────────────

  db.run(`CREATE TABLE IF NOT EXISTS volumes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_id        INTEGER UNIQUE,
    cv_slug      TEXT,
    cv_img       TEXT,
    locg_id      INTEGER,
    locg_slug    TEXT,
    name         TEXT    NOT NULL,
    publisher    INTEGER REFERENCES publishers(id) ON DELETE SET NULL,
    lang         TEXT,
    start_year   INTEGER,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS publishers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_id      INTEGER NOT NULL UNIQUE,
    name       TEXT    NOT NULL,
    cv_slug    TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS themes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_id       INTEGER NOT NULL UNIQUE,
    name        TEXT    NOT NULL
	  ua_name	    INTEGER,
	  type	      TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS issues (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_id          INTEGER UNIQUE,
    cv_slug        TEXT,
    name           TEXT,
    cv_img         TEXT,
    cv_vol_id      INTEGER,
    issue_number   TEXT,
    cover_date     TEXT,
    release_date   TEXT,
    description    TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS characters (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_id       INTEGER NOT NULL UNIQUE,
    cv_slug     TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    real_name   TEXT,
    cv_img      TEXT,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS character_aliases (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    alias        TEXT    NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS personnel (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_id      INTEGER UNIQUE,
    cv_slug    TEXT,
    name       TEXT    NOT NULL,
    bio        TEXT,
    cv_img     TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // ── Зв'язки: випуски ───────────────────────────────────────────────────────

  db.run(`CREATE TABLE IF NOT EXISTS issue_characters (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id     INTEGER NOT NULL REFERENCES issues(id)     ON DELETE CASCADE,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    role         TEXT DEFAULT 'hero' CHECK(role IN ('hero','villain','supporting','cameo')),
    UNIQUE(issue_id, character_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS issue_personnel (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id     INTEGER NOT NULL REFERENCES issues(id)    ON DELETE CASCADE,
    personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    role         TEXT    NOT NULL,
    UNIQUE(issue_id, personnel_id, role)
  )`);

  // ── Теми ──────────────────────────────────────────────────────────────────

  db.run(`CREATE TABLE IF NOT EXISTS volume_themes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_vol_id    INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
    theme_id     INTEGER NOT NULL REFERENCES themes(id)  ON DELETE CASCADE,
    UNIQUE(cv_vol_id, theme_id)
  )`);

  // ── Колекції ──────────────────────────────────────────────────────────────

  db.run(`CREATE TABLE IF NOT EXISTS collections (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_id        INTEGER UNIQUE,
    cv_slug      TEXT,
    cv_vol_id    INTEGER,
    cv_img       TEXT,
    publisher    INTEGER REFERENCES publishers(id) ON DELETE SET NULL,
    issue_number TEXT,
    isbn         TEXT,
    cover_date   TEXT,
    release_date TEXT,
    name         TEXT,
    description  TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS collection_issues (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    issue_id      INTEGER NOT NULL REFERENCES issues(id)      ON DELETE CASCADE,
    order_num     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(collection_id, issue_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS collection_themes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    theme_id      INTEGER NOT NULL REFERENCES themes(id)       ON DELETE CASCADE,
    UNIQUE(collection_id, theme_id)
  )`);

  // ── Серії ─────────────────────────────────────────────────────────────────

  db.run(`CREATE TABLE IF NOT EXISTS series (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT,
    cv_img      TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS series_volumes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id INTEGER NOT NULL REFERENCES series(id)  ON DELETE CASCADE,
    volume_id INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
    order_num INTEGER NOT NULL DEFAULT 0,
    UNIQUE(series_id, volume_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS series_collections (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id     INTEGER NOT NULL REFERENCES series(id)      ON DELETE CASCADE,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    order_num     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(series_id, collection_id)
  )`);

  // ── Порядок читання ───────────────────────────────────────────────────────

  db.run(`CREATE TABLE IF NOT EXISTS reading_orders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT,
    cv_img      TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reading_order_issues (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_order_id INTEGER NOT NULL REFERENCES reading_orders(id) ON DELETE CASCADE,
    issue_id         INTEGER NOT NULL REFERENCES issues(id)         ON DELETE CASCADE,
    issue_cv_id      INTEGER REFERENCES issues(cv_id)               ON DELETE CASCADE,
    order_num        INTEGER NOT NULL DEFAULT 0,
    UNIQUE(reading_order_id, issue_id, issue_cv_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reading_order_collections (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_order_id INTEGER NOT NULL REFERENCES reading_orders(id) ON DELETE CASCADE,
    collection_id    INTEGER NOT NULL REFERENCES collections(id)    ON DELETE CASCADE,
    order_num        INTEGER NOT NULL DEFAULT 0,
    UNIQUE(reading_order_id, collection_id)
  )`);

  // ── Події ─────────────────────────────────────────────────────────────────

  db.run(`CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT,
    cv_img      TEXT,
    start_year  INTEGER,
    end_year    INTEGER,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS event_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    item_id     INTEGER NOT NULL,
    item_type   TEXT    NOT NULL CHECK(item_type IN ('issue','collection')),
    order_num   INTEGER NOT NULL DEFAULT 0,
    importance  TEXT    DEFAULT 'main' CHECK(importance IN ('main','tie-in','prologue','epilogue')),
    UNIQUE(event_id, item_id, item_type)
  )`);

  // ── Індекси ────────────────────────────────────────────────────────────────

  // publishers
  db.run(`CREATE INDEX IF NOT EXISTS idx_publishers_cv_id ON publishers(cv_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_publishers_name  ON publishers(name COLLATE NOCASE)`);

  // volumes
  db.run(`CREATE INDEX IF NOT EXISTS idx_volumes_cv_id       ON volumes(cv_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_volumes_name        ON volumes(name COLLATE NOCASE)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_volumes_cv_slug     ON volumes(cv_slug)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_volumes_publisher   ON volumes(publisher)`);

  // issues
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_cv_id        ON issues(cv_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_cv_slug      ON issues(cv_slug)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_name         ON issues(name COLLATE NOCASE)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_cv_vol_id    ON issues(cv_vol_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_issue_number ON issues(issue_number)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_cover_date   ON issues(cover_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_release_date ON issues(release_date)`);

  // characters
  db.run(`CREATE INDEX IF NOT EXISTS idx_characters_cv_id ON characters(cv_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_characters_name  ON characters(name COLLATE NOCASE)`);

  // character_aliases
  db.run(`CREATE INDEX IF NOT EXISTS idx_character_aliases_character_id ON character_aliases(character_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_character_aliases_alias        ON character_aliases(alias COLLATE NOCASE)`);

  // personnel
  db.run(`CREATE INDEX IF NOT EXISTS idx_personnel_name  ON personnel(name COLLATE NOCASE)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_personnel_cv_id ON personnel(cv_id)`);

  // issue_characters
  db.run(`CREATE INDEX IF NOT EXISTS idx_issue_characters_issue_id     ON issue_characters(issue_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issue_characters_character_id ON issue_characters(character_id)`);

  // issue_personnel
  db.run(`CREATE INDEX IF NOT EXISTS idx_issue_personnel_issue_id     ON issue_personnel(issue_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issue_personnel_personnel_id ON issue_personnel(personnel_id)`);

  // themes
  db.run(`CREATE INDEX IF NOT EXISTS idx_themes_name ON themes(name COLLATE NOCASE)`);

  // volume_themes
  db.run(`CREATE INDEX IF NOT EXISTS idx_volume_themes_cv_vol_id ON volume_themes(cv_vol_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_volume_themes_theme_id  ON volume_themes(theme_id)`);

  // collections
  db.run(`CREATE INDEX IF NOT EXISTS idx_collections_cv_vol_id    ON collections(cv_vol_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_collections_cv_id        ON collections(cv_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_collections_name         ON collections(name COLLATE NOCASE)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_collections_publisher    ON collections(publisher)`);

  // collection_issues
  db.run(`CREATE INDEX IF NOT EXISTS idx_collection_issues_collection_id ON collection_issues(collection_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_collection_issues_issue_id      ON collection_issues(issue_id)`);

  // collection_themes
  db.run(`CREATE INDEX IF NOT EXISTS idx_collection_themes_collection_id ON collection_themes(collection_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_collection_themes_theme_id      ON collection_themes(theme_id)`);

  // series
  db.run(`CREATE INDEX IF NOT EXISTS idx_series_name ON series(name COLLATE NOCASE)`);

  // series_volumes
  db.run(`CREATE INDEX IF NOT EXISTS idx_series_volumes_series_id ON series_volumes(series_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_series_volumes_volume_id ON series_volumes(volume_id)`);

  // series_collections
  db.run(`CREATE INDEX IF NOT EXISTS idx_series_collections_series_id     ON series_collections(series_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_series_collections_collection_id ON series_collections(collection_id)`);

  // reading_order_issues
  db.run(`CREATE INDEX IF NOT EXISTS idx_ro_issues_order      ON reading_order_issues(reading_order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ro_issues_issue_id   ON reading_order_issues(issue_id)`);

  // reading_order_collections
  db.run(`CREATE INDEX IF NOT EXISTS idx_ro_collections_order         ON reading_order_collections(reading_order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ro_collections_collection_id ON reading_order_collections(collection_id)`);

  // events
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_name ON events(name COLLATE NOCASE)`);

  // event_items
  db.run(`CREATE INDEX IF NOT EXISTS idx_event_items_event ON event_items(event_id)`);
}

module.exports = { applySchema };