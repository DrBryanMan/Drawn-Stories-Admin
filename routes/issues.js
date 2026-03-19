const { Router } = require('express');
const { runQuery, getAll, getOne, rawRun, saveDatabase } = require('../db');

const router = Router();

const TRANSLATED_THEME_ID = 51;
const COLLECTION_THEME_ID = 44;

function getCollectionIdForIssue(issueId) {
  try {
    // Спочатку шукаємо по cv_id (старий спосіб)
    const byCV = getOne(
      'SELECT id FROM collections WHERE cv_id IS NOT NULL AND cv_id = (SELECT cv_id FROM issues WHERE id = ? AND cv_id IS NOT NULL)',
      [issueId]
    );
    if (byCV) return byCV.id;
    // Потім шукаємо чи цей випуск є у якомусь збірнику
    const byMembership = getOne(
      'SELECT collection_id as id FROM collection_issues WHERE issue_id = ? LIMIT 1',
      [issueId]
    );
    return byMembership ? byMembership.id : null;
  } catch (e) { return null; }
}

function getNextFreeId() {
  const row = getOne(`
    SELECT COALESCE(
      (SELECT MIN(id + 1) FROM issues WHERE id + 1 NOT IN (SELECT id FROM issues)),
      (SELECT MAX(id) + 1 FROM issues),
      1
    ) as next_id
  `);
  return row?.next_id || 1;
}

router.get('/', (req, res) => {
  const {
    search, exact, cv_id, ds_id, volume_id, ds_vol_id, name, volume_name,
    issue_number, limit, offset = 0,
    publisher_ids, theme_ids,
  } = req.query;

  const isExact = exact === 'true';

  // Розбираємо publisher_ids та theme_ids
  const pubIds = publisher_ids
    ? publisher_ids.split(',').map(Number).filter(Boolean)
    : [];
  const themeIds = theme_ids
    ? theme_ids.split(',').map(Number).filter(Boolean)
    : [];

  let query = `
    SELECT i.*,
           COALESCE(v.name, mv.name) as volume_name
    FROM issues i
    LEFT JOIN volumes v  ON i.cv_vol_id = v.cv_id
    LEFT JOIN volumes mv ON i.ds_vol_id = mv.id
  `;
  let params = [], conditions = [];

  if (search) {
    conditions.push(isExact
      ? '(LOWER(i.name) = LOWER(?) OR LOWER(COALESCE(v.name, mv.name)) = LOWER(?))'
      : '(i.name LIKE ? OR i.cv_slug LIKE ? OR i.issue_number LIKE ? OR v.name LIKE ? OR mv.name LIKE ?)');
    params.push(...(isExact ? [search, search] : [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]));
  }
  if (name)         { conditions.push(isExact ? 'LOWER(i.name) = LOWER(?)' : 'i.name LIKE ?'); params.push(isExact ? name : `%${name}%`); }
  if (volume_name) {
    conditions.push(isExact
      ? 'LOWER(COALESCE(v.name, mv.name)) = LOWER(?)'
      : '(v.name LIKE ? OR mv.name LIKE ?)');
    params.push(...(isExact ? [volume_name] : [`%${volume_name}%`, `%${volume_name}%`]));
  }
  if (issue_number) { conditions.push('i.issue_number LIKE ?'); params.push(`%${issue_number}%`); }
  if (volume_id)    { conditions.push('i.cv_vol_id = ?'); params.push(parseInt(volume_id)); }
  if (ds_vol_id)    { conditions.push('i.ds_vol_id = ?'); params.push(parseInt(ds_vol_id)); }
  if (cv_id)        { conditions.push('i.cv_id = ?'); params.push(parseInt(cv_id)); }
  if (ds_id)        { conditions.push('i.id = ?'); params.push(parseInt(ds_id)); }

  // Фільтр за видавцем тому (через volumes.publisher)
  if (pubIds.length) {
    conditions.push(`v.publisher IN (${pubIds.map(() => '?').join(',')})`);
    params.push(...pubIds);
  }

  // Фільтр за темами тому (через volume_themes) — AND логіка (всі обрані теми)
  themeIds.forEach(tid => {
    conditions.push('EXISTS (SELECT 1 FROM volume_themes _vt JOIN volumes _v ON _v.id = _vt.volume_id WHERE _v.cv_id = i.cv_vol_id AND _vt.theme_id = ?)');
    params.push(tid);
  });

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY i.created_at DESC';

  const countParams = [...params];

  if (limit) {
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
  }

  const issues = getAll(query, params);
  let countQuery = `SELECT COUNT(*) as count FROM issues i LEFT JOIN volumes v ON i.cv_vol_id = v.cv_id LEFT JOIN volumes mv ON i.ds_vol_id = mv.id`;
  if (conditions.length) countQuery += ' WHERE ' + conditions.join(' AND ');
  const total = getOne(countQuery, countParams);
  res.json({ data: issues, total: total?.count || 0 });
});

// ── Репринти: отримати всі репринти цього випуску (цей — оригінал) ────────
router.get('/:id/reprints', (req, res) => {
  try {
    const data = getAll(`
      SELECT i.id, i.name, i.cv_img, i.cv_id, i.cv_slug, i.issue_number, i.cv_vol_id,
             COALESCE(v.name, mv.name) AS volume_name,
             v.lang AS volume_lang,
             ir.story_id,
             s.name_original AS story_name_original,
             s.name_ua       AS story_name_ua
      FROM issue_reprints ir
      JOIN issues i ON i.id = ir.reprint_id
      LEFT JOIN volumes v        ON i.cv_vol_id = v.cv_id
      LEFT JOIN volumes mv       ON i.ds_vol_id = mv.id
      LEFT JOIN issue_stories s  ON s.id = ir.story_id
      WHERE ir.original_id = ?
      ORDER BY v.lang, i.issue_number
    `, [req.params.id]);
    res.json({ data });
  } catch (e) { console.error('reprints error:', e.message); res.json({ data: [] }); }
});

// ── Репринти: отримати оригінал цього репринту (цей — перекладений сінгл) ─
router.get('/:id/reprint-source', (req, res) => {
  try {
    const data = getAll(`
      SELECT i.id, i.name, i.cv_img, i.cv_id, i.cv_slug, i.issue_number, i.cv_vol_id,
             COALESCE(v.name, mv.name) AS volume_name,
             ir.story_id,
             s.name_original AS story_name_original,
             s.name_ua       AS story_name_ua,
             s.plot          AS story_plot,
             i.plot          AS source_issue_plot
      FROM issue_reprints ir
      JOIN issues i ON i.id = ir.original_id
      LEFT JOIN volumes v        ON i.cv_vol_id = v.cv_id
      LEFT JOIN volumes mv       ON i.ds_vol_id = mv.id
      LEFT JOIN issue_stories s  ON s.id = ir.story_id
      WHERE ir.reprint_id = ?
    `, [req.params.id]);
    res.json({ data });
  } catch (e) { res.json({ data: [] }); }
});

// ── Репринти: додати репринт (тіло: { reprint_id }) ──────────────────────
router.post('/:id/reprints', (req, res) => {
  const originalId = parseInt(req.params.id);
  const { reprint_id } = req.body;
  if (!reprint_id) return res.status(400).json({ error: 'reprint_id обов\'язковий' });
  if (parseInt(reprint_id) === originalId) return res.status(400).json({ error: 'Випуск не може бути репринтом самого себе' });
  try {
    const exists = getOne(
      'SELECT id FROM issue_reprints WHERE original_id = ? AND reprint_id = ? AND story_id IS NULL',
      [originalId, reprint_id]
    );
    if (exists) return res.status(400).json({ error: 'Цей зв\'язок вже існує' });
    rawRun(
      'INSERT INTO issue_reprints (original_id, reprint_id) VALUES (?, ?)',
      [originalId, reprint_id]
    );
    saveDatabase();
    res.json({ message: 'Репринт додано' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Репринти: видалити зв'язок ────────────────────────────────────────────
router.delete('/:id/reprints/:reprintId', (req, res) => {
  try {
    rawRun(
      'DELETE FROM issue_reprints WHERE original_id = ? AND reprint_id = ?',
      [req.params.id, req.params.reprintId]
    );
    saveDatabase();
    res.json({ message: 'Зв\'язок видалено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Репринти: додати джерело (тіло: { original_id }) — з боку репринту ───
router.post('/:id/reprint-source', (req, res) => {
  const reprintId = parseInt(req.params.id);
  const { original_id, story_id } = req.body;
  if (!original_id) return res.status(400).json({ error: 'original_id обов\'язковий' });
  if (parseInt(original_id) === reprintId) return res.status(400).json({ error: 'Випуск не може бути джерелом самого себе' });
  try {
    const exists = getOne(
      'SELECT id FROM issue_reprints WHERE original_id = ? AND reprint_id = ? AND (story_id IS ? OR story_id = ?)',
      [original_id, reprintId, story_id || null, story_id || null]
    );
    if (exists) return res.status(400).json({ error: 'Цей зв\'язок вже існує' });
    rawRun(
      'INSERT INTO issue_reprints (original_id, reprint_id, story_id) VALUES (?, ?, ?)',
      [original_id, reprintId, story_id || null]
    );
    saveDatabase();
    res.json({ message: 'Джерело додано' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Репринти: видалити джерело — з боку репринту ─────────────────────────
router.delete('/:id/reprint-source/:originalId', (req, res) => {
  try {
    rawRun(
      'DELETE FROM issue_reprints WHERE original_id = ? AND reprint_id = ?',
      [req.params.originalId, req.params.id]
    );
    saveDatabase();
    res.json({ message: 'Джерело видалено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// STORIES (issue_stories)
// GET  /issues/:id/stories  — список усіх історій випуску
router.get('/:id/stories', (req, res) => {
  try {
    const stories = getAll(
      `SELECT s.*
       FROM issue_stories s
       WHERE s.issue_id = ?
       ORDER BY s.order_num, s.id`,
      [req.params.id]
    );
    res.json({ data: stories });
  } catch (e) { res.json({ data: [] }); }
});

// POST /issues/:id/stories  — додати нову історію
router.post('/:id/stories', (req, res) => {
  const { name_original, name_ua, plot, order_num } = req.body;
  if (!name_original && !name_ua)
    return res.status(400).json({ error: 'Вкажіть хоча б одну назву' });
  try {
    rawRun(
      `INSERT INTO issue_stories (issue_id, name_original, name_ua, plot, order_num)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, name_original || null, name_ua || null, plot || null, order_num ?? 0]
    );
    saveDatabase();
    res.json({ message: 'Історію додано' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT  /issues/:id/stories/:storyId — оновити
router.put('/:id/stories/:storyId', (req, res) => {
  const { name_original, name_ua, plot, order_num } = req.body;
  try {
    rawRun(
      `UPDATE issue_stories
          SET name_original = ?, name_ua = ?, plot = ?, order_num = ?
        WHERE id = ? AND issue_id = ?`,
      [name_original || null, name_ua || null, plot || null, order_num ?? 0,
       req.params.storyId, req.params.id]
    );
    saveDatabase();
    res.json({ message: 'Збережено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /issues/:id/stories/:storyId — видалити
router.delete('/:id/stories/:storyId', (req, res) => {
  try {
    rawRun(
      `DELETE FROM issue_stories WHERE id = ? AND issue_id = ?`,
      [req.params.storyId, req.params.id]
    );
    saveDatabase();
    res.json({ message: 'Видалено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Хронології
router.get('/:id/reading-orders', (req, res) => {
  try {
    const data = getAll(`
      SELECT ro.id, ro.name, roi.order_num
      FROM reading_orders ro
      JOIN reading_order_issues roi ON ro.id = roi.reading_order_id
      WHERE roi.issue_id = ?
      ORDER BY roi.order_num ASC
    `, [req.params.id]);
    res.json({ data });
  } catch (e) { res.json({ data: [] }); }
});

router.get('/:id/collections-membership', (req, res) => {
  try {
    const data = getAll(`
      SELECT c.id, c.name, c.cv_img, c.cv_vol_id, c.issue_number, c.cover_date, c.release_date, ci.order_num,
        pv.id   AS parent_vol_id,
        pv.name AS parent_vol_name,
        pv.lang AS parent_vol_lang
      FROM collections c
      JOIN collection_issues ci ON c.id = ci.collection_id
      LEFT JOIN volumes pv ON c.cv_vol_id = pv.cv_id
      WHERE ci.issue_id = ?
      ORDER BY pv.name ASC, CAST(c.issue_number AS REAL) ASC, c.name ASC
    `, [req.params.id]);
    res.json({ data });
  } catch (e) { res.json({ data: [] }); }
});

router.get('/:id', (req, res) => {
  const issue = getOne(`
    SELECT i.*,
           COALESCE(v.name, mv.name)  as volume_name,
           COALESCE(v.id,   mv.id)    as volume_db_id,
           p.name as publisher_name
    FROM issues i
    LEFT JOIN volumes v  ON i.cv_vol_id = v.cv_id
    LEFT JOIN volumes mv ON i.ds_vol_id = mv.id
    LEFT JOIN publishers p ON COALESCE(v.publisher, mv.publisher) = p.id
    WHERE i.id = ?
  `, [req.params.id]);
  if (!issue) return res.status(404).json({ error: 'Випуск не знайдено' });
  // Додаємо theme ids тому для визначення типу на фронті
  const volumeThemeIds = issue.cv_vol_id
    ? getAll(
        `SELECT vt.theme_id FROM volume_themes vt
         JOIN volumes v ON v.id = vt.volume_id
         WHERE v.cv_id = ?`,
        [issue.cv_vol_id]
      ).map(r => r.theme_id)
    : [];
  issue.volume_theme_ids = volumeThemeIds;
  issue.collection_id = getCollectionIdForIssue(issue.id);
  res.json({ ...issue, volume_theme_ids: volumeThemeIds });
});

router.post('/', (req, res) => {
  const { cv_id, cv_slug, name, cv_img, cv_vol_id, ds_vol_id, issue_number, cover_date, release_date, description } = req.body;
  try {
    runQuery(
      'INSERT INTO issues (cv_id, cv_slug, name, cv_img, cv_vol_id, ds_vol_id, issue_number, cover_date, release_date, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [cv_id || null, cv_slug || null, name || null, cv_img || null, cv_vol_id || null, ds_vol_id || null, issue_number || null, cover_date || null, release_date || null, description || null]
    );
    saveDatabase();
    res.json({ message: 'Випуск створено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/:id', (req, res) => {
  const allowed = ['cv_id', 'cv_slug', 'name', 'cv_img', 'cv_vol_id', 'ds_vol_id', 'issue_number', 'cover_date', 'release_date'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (key in req.body) {
      fields.push(`${key} = ?`);
      values.push(req.body[key] === '' ? null : (req.body[key] ?? null));
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'Нема полів для оновлення' });
  try {
    runQuery(
      `UPDATE issues SET ${fields.join(', ')} WHERE id = ?`,
      [...values, req.params.id]
    );
    saveDatabase();
    res.json({ message: 'Випуск оновлено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    runQuery('DELETE FROM issues WHERE id = ?', [req.params.id]);
    saveDatabase();
    res.json({ message: 'Випуск видалено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// Конвертація випуску у збірник
router.post('/:id/make-collection', (req, res) => {
  try {
    const issueId = parseInt(req.params.id);
    const issue = getOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!issue) return res.status(404).json({ error: 'Випуск не знайдено' });

    const existing = getOne('SELECT id FROM collections WHERE cv_id = ?', [issue.cv_id]);
    if (existing) return res.status(400).json({ error: 'Збірник вже існує для цього випуску', collection_id: existing.id });

    const volume = getOne('SELECT publisher FROM volumes WHERE cv_id = ?', [issue.cv_vol_id]);

    rawRun(
      'INSERT INTO collections (cv_vol_id, name, cv_img, cv_id, cv_slug, publisher) VALUES (?, ?, ?, ?, ?, ?)',
      [issue.cv_vol_id || null, issue.name || 'Без назви', issue.cv_img || null, issue.cv_id, issue.cv_slug, volume?.publisher || null]
    );
    rawRun('DELETE FROM issues WHERE id = ?', [issueId]);
    saveDatabase();

    const newCollection = getOne('SELECT * FROM collections WHERE cv_id = ?', [issue.cv_id]);
    res.json({ message: 'Збірник створено, випуск замінено', collection: newCollection });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// GET журнали, до яких входить цей розділ манги
router.get('/:id/magazine-memberships', (req, res) => {
  const data = getAll(`
    SELECT
      mc.id         AS link_id,
      mc.sort_order,
      mc.page_type,
      mi.id          AS mag_issue_id,
      mi.issue_number AS mag_issue_number,
      mi.name        AS mag_issue_name,
      mi.cv_img      AS mag_issue_cv_img,
      v.id           AS magazine_id,
      v.name         AS magazine_name,
      v.hikka_img,
      v.cv_img
    FROM magazine_chapters mc
    JOIN issues  mi ON mi.id  = mc.mag_issue_id
    JOIN volumes v  ON v.cv_id = mi.cv_vol_id
    WHERE mc.issue_id = ?
    ORDER BY v.name ASC, CAST(mi.issue_number AS REAL) ASC
  `, [req.params.id]);
  res.json({ data });
});

// ── Розділи манги у випуску журналу ──────────────────────────────────────

// GET список розділів манги у цьому випуску журналу
router.get('/:id/magazine-chapters', (req, res) => {
  const data = getAll(`
    SELECT
      mc.id, mc.sort_order, mc.page_type,
      i.id           AS issue_id,
      i.issue_number,
      i.name         AS issue_name,
      i.cv_img,
      i.release_date,
      v.id           AS vol_id,
      v.name         AS vol_name,
      v.hikka_slug
    FROM magazine_chapters mc
    JOIN issues  i ON i.id  = mc.issue_id
    JOIN volumes v ON v.id  = i.ds_vol_id
    WHERE mc.mag_issue_id = ?
    ORDER BY mc.sort_order ASC, v.name ASC, CAST(i.issue_number AS REAL) ASC
  `, [req.params.id]);
  res.json({ data });
});

// POST додати розділ манги до цього випуску журналу
router.post('/:id/magazine-chapters', (req, res) => {
  const magIssueId = parseInt(req.params.id);
  const { issue_id, sort_order, page_type } = req.body;
  if (!issue_id) return res.status(400).json({ error: 'issue_id обов\'язковий' });

  try {
    const issue = getOne('SELECT id, ds_vol_id FROM issues WHERE id = ?', [issue_id]);
    if (!issue) return res.status(404).json({ error: 'Розділ не знайдено' });
    if (!issue.ds_vol_id) return res.status(400).json({ error: 'Розділ не є розділом манги (немає ds_vol_id)' });

    const existing = getOne(
      'SELECT id FROM magazine_chapters WHERE mag_issue_id = ? AND issue_id = ?',
      [magIssueId, issue_id]
    );
    if (existing) return res.status(400).json({ error: 'Цей розділ вже доданий до цього випуску журналу' });

    const validTypes = ['color', 'cover', 'combined'];
    const safeType = validTypes.includes(page_type) ? page_type : null;

    runQuery(
      'INSERT INTO magazine_chapters (mag_issue_id, issue_id, sort_order, page_type) VALUES (?, ?, ?, ?)',
      [magIssueId, issue_id, sort_order ?? 0, safeType]
    );
    saveDatabase();

    // Якщо розділ не має дати виходу — копіюємо з випуску журналу
    try {
      const magIssue = getOne('SELECT release_date FROM issues WHERE id = ?', [magIssueId]);
      if (magIssue?.release_date) {
        const chapterIssue = getOne('SELECT release_date FROM issues WHERE id = ?', [issue_id]);
        if (!chapterIssue?.release_date) {
          rawRun('UPDATE issues SET release_date = ? WHERE id = ?', [magIssue.release_date, issue_id]);
          saveDatabase();
        }
      }
    } catch (_) {}

    res.json({ message: 'Розділ додано до випуску журналу' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// DELETE прибрати розділ з випуску журналу
router.delete('/:id/magazine-chapters/:chapterIssueId', (req, res) => {
  try {
    runQuery(
      'DELETE FROM magazine_chapters WHERE mag_issue_id = ? AND issue_id = ?',
      [req.params.id, req.params.chapterIssueId]
    );
    res.json({ message: 'Розділ видалено з випуску журналу' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

module.exports = router;