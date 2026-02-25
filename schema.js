function applySchema(db) {
  // ── Таблиці ────────────────────────────────────────────────────────────────

  db.run(`CREATE TABLE IF NOT EXISTS volumes (
    "id"	INTEGER,
    "cv_id"	INTEGER NOT NULL UNIQUE,
    "cv_slug"	TEXT NOT NULL,
    "cv_img"	TEXT,
    "locg_id" INTEGER,
    "locg_slug" TEXT,
    "name"	TEXT NOT NULL,
    "publisher"	INTEGER,
    "themes"	INTEGER,
	  "lang"	TEXT,
    "start_year"	INTEGER,
    "created_at"	TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY("id" AUTOINCREMENT)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS publishers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    cv_slug TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS issues (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_id          INTEGER UNIQUE,
    cv_slug        TEXT,
    name           TEXT,
    cv_img         TEXT,
    cv_vol_id   INTEGER,
    issue_number   TEXT,
    cover_date     TEXT,
    release_date   TEXT,
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

  db.run(`CREATE TABLE IF NOT EXISTS themes (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_id INTEGER NOT NULL UNIQUE,
    name  TEXT    NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS volume_themes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_vol_id INTEGER NOT NULL,
    theme_id     INTEGER NOT NULL,
    FOREIGN KEY (cv_vol_id) REFERENCES volumes(id),
    FOREIGN KEY (theme_id)     REFERENCES themes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS collections (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cv_id       INTEGER,
    cv_slug     TEXT,
    cv_vol_id   INTEGER,
    cv_img      TEXT,
    publisher   INTEGER,
    issue_number	TEXT,
    isbn	TEXT,
    cover_date	TEXT,
    release_date	TEXT,
    name        TEXT,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS collection_issues (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    issue_id      INTEGER NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES collections(id),
    FOREIGN KEY (issue_id)      REFERENCES issues(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS collection_themes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    theme_id      INTEGER NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES collections(id),
    FOREIGN KEY (theme_id)      REFERENCES themes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS series (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT,
    cv_img      TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS series_volumes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id INTEGER NOT NULL,
    volume_id INTEGER NOT NULL,
    UNIQUE(series_id, volume_id),
    FOREIGN KEY (series_id) REFERENCES series(id),
    FOREIGN KEY (volume_id) REFERENCES volumes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS series_collections (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id     INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    UNIQUE(series_id, collection_id),
    FOREIGN KEY (series_id)     REFERENCES series(id),
    FOREIGN KEY (collection_id) REFERENCES collections(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reading_orders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT,
    cv_img      TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reading_order_issues (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_order_id INTEGER NOT NULL,
    issue_id         INTEGER NOT NULL,
    order_num        INTEGER NOT NULL DEFAULT 0,
    UNIQUE(reading_order_id, issue_id),
    FOREIGN KEY (reading_order_id) REFERENCES reading_orders(id),
    FOREIGN KEY (issue_id)         REFERENCES issues(id)
  )`);

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
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL,
    item_id     INTEGER NOT NULL,
    item_type   TEXT    NOT NULL CHECK(item_type IN ('issue','collection')),
    order_num   INTEGER NOT NULL DEFAULT 0,
    importance  TEXT    DEFAULT 'main' CHECK(importance IN ('main','tie-in','prologue','epilogue')),
    UNIQUE(event_id, item_id, item_type),
    FOREIGN KEY (event_id) REFERENCES events(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_event_items_event ON event_items(event_id)`);

  // ── Індекси ────────────────────────────────────────────────────────────────

  // volumes
  db.run(`CREATE INDEX IF NOT EXISTS idx_volumes_cv_id   ON volumes(cv_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_volumes_name    ON volumes(name COLLATE NOCASE)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_volumes_cv_slug ON volumes(cv_slug)`);

  // issues
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_cv_id        ON issues(cv_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_cv_slug      ON issues(cv_slug)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_name         ON issues(name COLLATE NOCASE)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_cv_vol_id ON issues(cv_vol_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_issue_number ON issues(issue_number)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_cover_date   ON issues(cover_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_release_date ON issues(release_date)`);

  // characters
  db.run(`CREATE INDEX IF NOT EXISTS idx_characters_cv_id ON characters(cv_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_characters_name  ON characters(name COLLATE NOCASE)`);

  // themes
  db.run(`CREATE INDEX IF NOT EXISTS idx_themes_name ON themes(name COLLATE NOCASE)`);

  // volume_themes
  db.run(`CREATE INDEX IF NOT EXISTS idx_volume_themes_cv_vol_id ON volume_themes(cv_vol_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_volume_themes_theme_id     ON volume_themes(theme_id)`);

  // collections
  db.run(`CREATE INDEX IF NOT EXISTS idx_collections_cv_vol_id ON collections(cv_vol_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_collections_cv_id     ON collections(cv_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_collections_name      ON collections(name COLLATE NOCASE)`);

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
  db.run(`CREATE INDEX IF NOT EXISTS idx_series_collections_series ON series_collections(series_id)`);

  // reading_order_issues
  db.run(`CREATE INDEX IF NOT EXISTS idx_ro_issues_order ON reading_order_issues(reading_order_id)`);
}

module.exports = { applySchema };