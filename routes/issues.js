// routes/issues.js
const { Router } = require('express');
const { runQuery, getAll, getOne, rawRun, saveDatabase } = require('../db');

const router = Router();

function getCollectionIdForIssue(issueId) {
  try {
    const row = getOne(
      'SELECT id FROM collections WHERE cv_id = (SELECT cv_id FROM issues WHERE id = ?)',
      [issueId]
    );
    return row ? row.id : null;
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
  const { search, exact, cv_id, volume_id, name, volume_name, issue_number, limit, offset = 0 } = req.query;
  const isExact = exact === 'true';
  let query = `SELECT i.*, v.name as volume_name FROM issues i LEFT JOIN volumes v ON i.cv_vol_id = v.cv_id`;
  let params = [], conditions = [];

  if (search) {
    conditions.push(isExact
      ? 'LOWER(i.name) = LOWER(?) OR LOWER(v.name) = LOWER(?)'
      : '(i.name LIKE ? OR i.cv_slug LIKE ? OR i.issue_number LIKE ? OR v.name LIKE ?)');
    params.push(...(isExact ? [search, search] : [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]));
  }
  if (name)         { conditions.push(isExact ? 'LOWER(i.name) = LOWER(?)' : 'i.name LIKE ?'); params.push(isExact ? name : `%${name}%`); }
  if (volume_name)  { conditions.push(isExact ? 'LOWER(v.name) = LOWER(?)' : 'v.name LIKE ?'); params.push(isExact ? volume_name : `%${volume_name}%`); }
  if (issue_number) { conditions.push('i.issue_number LIKE ?'); params.push(`%${issue_number}%`); }
  if (volume_id)    { conditions.push('i.cv_vol_id = ?'); params.push(parseInt(volume_id)); }
  if (cv_id) { conditions.push('i.cv_id = ?'); params.push(parseInt(cv_id)); }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY i.created_at DESC';
  if (limit) {
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
  }

  const issues = getAll(query, params);
  let countQuery = `SELECT COUNT(*) as count FROM issues i LEFT JOIN volumes v ON i.cv_vol_id = v.cv_id`;
  if (conditions.length) countQuery += ' WHERE ' + conditions.join(' AND ');
  const total = getOne(countQuery, limit ? params.slice(0, -2) : params);
  res.json({ data: issues, total: total?.count || 0 });
});

router.get('/:id/reading-orders', (req, res) => {
  try {
    const data = getAll(`
      SELECT ro.id, ro.name, roi.order_num
      FROM reading_orders ro
      JOIN reading_order_issues roi ON ro.id = roi.reading_order_id
      WHERE roi.issue_id = ?
      ORDER BY ro.name ASC
    `, [req.params.id]);
    res.json({ data });
  } catch(e) { res.json({ data: [] }); }
});

router.get('/:id/collections-membership', (req, res) => {
  try {
    const data = getAll(`
      SELECT c.id, c.name FROM collections c
      JOIN collection_issues ci ON c.id = ci.collection_id
      WHERE ci.issue_id = ?
      ORDER BY c.name ASC
    `, [req.params.id]);
    res.json({ data });
  } catch(e) { res.json({ data: [] }); }
});

router.get('/:id', (req, res) => {
  const issue = getOne(`
    SELECT i.*, v.name as volume_name
    FROM issues i
    LEFT JOIN volumes v ON i.cv_vol_id = v.cv_id
    WHERE i.id = ?
  `, [req.params.id]);
  if (!issue) return res.status(404).json({ error: 'Випуск не знайдено' });
  const collection_id = getCollectionIdForIssue(parseInt(req.params.id));
  res.json({ ...issue, collection_id });
});

router.post('/', (req, res) => {
  const { cv_id, cv_slug, name, cv_img, cv_vol_id, issue_number, cover_date, release_date } = req.body;
  try {
    const nextId = getNextFreeId(); // ← додай це
    runQuery(
      'INSERT INTO issues (id, cv_id, cv_slug, name, cv_img, cv_vol_id, issue_number, cover_date, release_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nextId, cv_id, cv_slug, name, cv_img, cv_vol_id, issue_number, cover_date, release_date] // ← і nextId тут
    );
    res.json({ message: 'Випуск створено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/:id', (req, res) => {
  const { cv_id, cv_slug, name, cv_img, cv_vol_id, issue_number, cover_date, release_date } = req.body;
  try {
    runQuery(
      'UPDATE issues SET cv_id = ?, cv_slug = ?, name = ?, cv_img = ?, cv_vol_id = ?, issue_number = ?, cover_date = ?, release_date = ? WHERE id = ?',
      [cv_id, cv_slug, name, cv_img, cv_vol_id, issue_number, cover_date, release_date, req.params.id]
    );
    res.json({ message: 'Випуск оновлено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    runQuery('DELETE FROM issues WHERE id = ?', [req.params.id]);
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

    const volume = getOne('SELECT publisher_id FROM volumes WHERE cv_id = ?', [issue.cv_vol_id]);

    rawRun(
      'INSERT INTO collections (cv_vol_id, name, cv_img, cv_id, cv_slug, publisher_id) VALUES (?, ?, ?, ?, ?, ?)',
      [issue.cv_vol_id || null, issue.name || 'Без назви', issue.cv_img || null, issue.cv_id, issue.cv_slug, volume?.publisher_id || null]
    );
    rawRun('DELETE FROM issues WHERE id = ?', [issueId]);
    saveDatabase();

    const newCollection = getOne('SELECT * FROM collections WHERE cv_id = ?', [issue.cv_id]);
    res.json({ message: 'Збірник створено, випуск замінено', collection: newCollection });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

module.exports = router;