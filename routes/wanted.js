// routes/wanted.js — Сторінка "Wanted": контент з відсутніми даними
const { Router } = require('express');
const { getAll, getOne } = require('../db');

const router = Router();

// ── Утиліти ────────────────────────────────────────────────────────────────

function buildWhereFromFilters(filters, conditions) {
  const active = Array.isArray(filters) ? filters : (filters || '').split(',').filter(Boolean);
  const clauses = active.map(f => conditions[f]).filter(Boolean);
  return clauses.length ? '(' + clauses.join(') OR (') + ')' : '1=1';
}

// ── Тома ───────────────────────────────────────────────────────────────────

const VOLUME_CONDITIONS = {
  no_name_uk:            `(v.name_uk IS NULL OR v.name_uk = '')`,
  no_lang:               `(v.lang IS NULL OR v.lang = '')`,
  no_start_year:         `(v.start_year IS NULL)`,
  no_publisher:          `(v.publisher IS NULL)`,
  no_theme:              `(v.cv_id NOT IN (SELECT cv_vol_id FROM volume_themes))`,
  no_translation_source: `(EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.cv_vol_id = v.cv_id AND vt.theme_id = 51)
                           AND v.id NOT IN (SELECT child_id FROM volume_translations))`,
  no_manga_magazine:     `(EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.cv_vol_id = v.cv_id AND vt.theme_id = 36)
                           AND v.id NOT IN (SELECT child_id FROM volume_magazines))`,
  has_mixed_types: `(EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.cv_vol_id = v.cv_id AND vt.theme_id = 44)
                    AND EXISTS (SELECT 1 FROM issues i WHERE i.cv_vol_id = v.cv_id))`,
  no_manga_vol_parent: `(
    v.lang = 'ja'
    AND EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.volume_id = v.id AND vt.theme_id = 36)
    AND EXISTS (SELECT 1 FROM volume_themes vt2 WHERE vt2.volume_id = v.id AND vt2.theme_id = 44)
    AND NOT EXISTS (
      SELECT 1 FROM volume_translations tr
      JOIN volumes pv ON pv.id = tr.parent_id
      WHERE tr.child_id = v.id
        AND (pv.hikka_slug IS NOT NULL OR pv.mal_id IS NOT NULL)
    )
  )`,
};

router.get('/volumes', (req, res) => {
  try {
    const { filters, search, limit = 200, offset = 0 } = req.query;
    const filterList = Array.isArray(filters) ? filters : (filters || '').split(',').filter(Boolean);

    if (!filterList.length) return res.json({ data: [], total: 0, counts: {} });

    const filterWhere = buildWhereFromFilters(filterList, VOLUME_CONDITIONS);
    let searchClause = '';
    let searchParams = [];
    if (search) {
      searchClause = `AND (v.name LIKE ? OR COALESCE(v.name_uk,'') LIKE ?)`;
      searchParams = [`%${search}%`, `%${search}%`];
    }

    const sql = `
      SELECT v.*,
             p.name as publisher_name,
             (SELECT COUNT(*) FROM issues i WHERE i.cv_vol_id = v.cv_id) as issue_count,
             (SELECT GROUP_CONCAT(t.name, ', ')
              FROM themes t JOIN volume_themes vt ON t.id = vt.theme_id
              WHERE vt.cv_vol_id = v.cv_id) as theme_names,
             CASE WHEN (v.name_uk IS NULL OR v.name_uk = '') THEN 1 ELSE 0 END as miss_name_uk,
             CASE WHEN (v.lang IS NULL OR v.lang = '')        THEN 1 ELSE 0 END as miss_lang,
             CASE WHEN v.start_year IS NULL                   THEN 1 ELSE 0 END as miss_start_year,
             CASE WHEN v.publisher IS NULL                    THEN 1 ELSE 0 END as miss_publisher,
             CASE WHEN v.cv_id NOT IN (SELECT cv_vol_id FROM volume_themes) THEN 1 ELSE 0 END as miss_theme,
             CASE WHEN (EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.cv_vol_id = v.cv_id AND vt.theme_id = 51)
                        AND v.id NOT IN (SELECT child_id FROM volume_translations)) THEN 1 ELSE 0 END as miss_translation_source,
             CASE WHEN (EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.cv_vol_id = v.cv_id AND vt.theme_id = 36)
                        AND v.id NOT IN (SELECT child_id FROM volume_magazines))    THEN 1 ELSE 0 END as miss_manga_magazine,
             CASE WHEN (EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.cv_vol_id = v.cv_id AND vt.theme_id = 44)
                        AND EXISTS (SELECT 1 FROM issues i WHERE i.cv_vol_id = v.cv_id))            THEN 1 ELSE 0 END as miss_mixed_types,
            CASE WHEN (
              v.lang = 'ja'
              AND EXISTS (SELECT 1 FROM volume_themes vt WHERE vt.volume_id = v.id AND vt.theme_id = 36)
              AND EXISTS (SELECT 1 FROM volume_themes vt2 WHERE vt2.volume_id = v.id AND vt2.theme_id = 44)
              AND NOT EXISTS (
                SELECT 1 FROM volume_translations tr
                JOIN volumes pv ON pv.id = tr.parent_id
                WHERE tr.child_id = v.id
                  AND (pv.hikka_slug IS NOT NULL OR pv.mal_id IS NOT NULL)
              )
            ) THEN 1 ELSE 0 END as miss_manga_vol_parent
      FROM volumes v
      LEFT JOIN publishers p ON v.publisher = p.id
      WHERE (${filterWhere}) ${searchClause}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) as count FROM volumes v
      WHERE (${filterWhere}) ${searchClause}
    `;

    const params = [...searchParams, parseInt(limit), parseInt(offset)];
    const countParams = [...searchParams];

    const data  = getAll(sql, params);
    const total = getOne(countSql, countParams)?.count || 0;

    const counts = {};
    Object.keys(VOLUME_CONDITIONS).forEach(key => {
      try {
        counts[key] = getOne(
          `SELECT COUNT(*) as c FROM volumes v WHERE ${VOLUME_CONDITIONS[key]}`,
          []
        )?.c || 0;
      } catch(e) { counts[key] = 0; }
    });

    res.json({ data, total, counts });
  } catch (err) {
    console.error('wanted/volumes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Випуски ────────────────────────────────────────────────────────────────

const ISSUE_CONDITIONS = {
  no_cover_date:   `(i.cover_date IS NULL OR i.cover_date = '')`,
  no_release_date: `(i.release_date IS NULL OR i.release_date = '')`,
};

router.get('/issues', (req, res) => {
  try {
    const { filters, search, limit = 200, offset = 0 } = req.query;
    const filterList = Array.isArray(filters) ? filters : (filters || '').split(',').filter(Boolean);

    if (!filterList.length) return res.json({ data: [], total: 0, counts: {} });

    const filterWhere = buildWhereFromFilters(filterList, ISSUE_CONDITIONS);
    let searchClause = '';
    let searchParams = [];
    if (search) {
      searchClause = `AND (i.name LIKE ? OR v.name LIKE ?)`;
      searchParams = [`%${search}%`, `%${search}%`];
    }

    const sql = `
      SELECT i.*,
             v.name as volume_name,
             CASE WHEN (i.cover_date IS NULL OR i.cover_date = '')    THEN 1 ELSE 0 END as miss_cover_date,
             CASE WHEN (i.release_date IS NULL OR i.release_date = '') THEN 1 ELSE 0 END as miss_release_date
      FROM issues i
      LEFT JOIN volumes v ON i.cv_vol_id = v.cv_id
      WHERE (${filterWhere}) ${searchClause}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) as count FROM issues i
      LEFT JOIN volumes v ON i.cv_vol_id = v.cv_id
      WHERE (${filterWhere}) ${searchClause}
    `;

    const params = [...searchParams, parseInt(limit), parseInt(offset)];
    const data  = getAll(sql, params);
    const total = getOne(countSql, [...searchParams])?.count || 0;

    const counts = {};
    Object.keys(ISSUE_CONDITIONS).forEach(key => {
      try {
        counts[key] = getOne(
          `SELECT COUNT(*) as c FROM issues i WHERE ${ISSUE_CONDITIONS[key]}`,
          []
        )?.c || 0;
      } catch(e) { counts[key] = 0; }
    });

    res.json({ data, total, counts });
  } catch (err) {
    console.error('wanted/issues error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Збірники ───────────────────────────────────────────────────────────────

const COLLECTION_CONDITIONS = {
  no_isbn:         `(c.isbn IS NULL OR c.isbn = '')`,
  no_release_date: `(c.release_date IS NULL OR c.release_date = '')`,
  no_theme:        `(c.id NOT IN (SELECT collection_id FROM collection_themes))`,
  no_description:  `(c.description IS NULL OR c.description = '')`,
  no_issues:       `(c.id NOT IN (SELECT collection_id FROM collection_issues))`,
};

router.get('/collections', (req, res) => {
  try {
    const { filters, search, limit = 200, offset = 0 } = req.query;
    const filterList = Array.isArray(filters) ? filters : (filters || '').split(',').filter(Boolean);

    if (!filterList.length) return res.json({ data: [], total: 0, counts: {} });

    const filterWhere = buildWhereFromFilters(filterList, COLLECTION_CONDITIONS);
    let searchClause = '';
    let searchParams = [];
    if (search) {
      searchClause = `AND (c.name LIKE ? OR v.name LIKE ?)`;
      searchParams = [`%${search}%`, `%${search}%`];
    }

    const sql = `
      SELECT c.*,
             v.name as volume_name,
             p.name as publisher_name,
             (SELECT COUNT(*) FROM collection_issues ci WHERE ci.collection_id = c.id) as issue_count,
             CASE WHEN (c.isbn IS NULL OR c.isbn = '')                THEN 1 ELSE 0 END as miss_isbn,
             CASE WHEN (c.release_date IS NULL OR c.release_date = '') THEN 1 ELSE 0 END as miss_release_date,
             CASE WHEN c.id NOT IN (SELECT collection_id FROM collection_themes)  THEN 1 ELSE 0 END as miss_theme,
             CASE WHEN (c.description IS NULL OR c.description = '')  THEN 1 ELSE 0 END as miss_description,
             CASE WHEN c.id NOT IN (SELECT collection_id FROM collection_issues)  THEN 1 ELSE 0 END as miss_issues
      FROM collections c
      LEFT JOIN volumes v ON c.cv_vol_id = v.cv_id
      LEFT JOIN publishers p ON c.publisher = p.id
      WHERE (${filterWhere}) ${searchClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) as count FROM collections c
      LEFT JOIN volumes v ON c.cv_vol_id = v.cv_id
      WHERE (${filterWhere}) ${searchClause}
    `;

    const params = [...searchParams, parseInt(limit), parseInt(offset)];
    const data  = getAll(sql, params);
    const total = getOne(countSql, [...searchParams])?.count || 0;

    const counts = {};
    Object.keys(COLLECTION_CONDITIONS).forEach(key => {
      try {
        counts[key] = getOne(
          `SELECT COUNT(*) as c FROM collections c WHERE ${COLLECTION_CONDITIONS[key]}`,
          []
        )?.c || 0;
      } catch(e) { counts[key] = 0; }
    });

    res.json({ data, total, counts });
  } catch (err) {
    console.error('wanted/collections error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;