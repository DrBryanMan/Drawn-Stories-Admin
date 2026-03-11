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
      SELECT c.id, c.name, c.cv_img, c.cover_date, c.release_date, ci.order_num
      FROM collections c
      JOIN collection_issues ci ON c.id = ci.collection_id
      WHERE ci.issue_id = ?
      ORDER BY c.name ASC
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

  issue.collection_id = getCollectionIdForIssue(issue.id);
  res.json(issue);
});

router.post('/', (req, res) => {
  const { cv_id, cv_slug, name, cv_img, cv_vol_id, issue_number, cover_date, release_date, description } = req.body;
  try {
    runQuery(
      'INSERT INTO issues (cv_id, cv_slug, name, cv_img, cv_vol_id, issue_number, cover_date, release_date, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [cv_id, cv_slug || null, name || null, cv_img || null, cv_vol_id || null, issue_number || null, cover_date || null, release_date || null, description || null]
    );
    saveDatabase();
    res.json({ message: 'Випуск створено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/:id', (req, res) => {
  const { cv_id, cv_slug, name, cv_img, cv_vol_id, ds_vol_id, issue_number, cover_date, release_date } = req.body;
  try {
    runQuery(
      'UPDATE issues SET cv_id=?, cv_slug=?, name=?, cv_img=?, cv_vol_id=?, ds_vol_id=?, issue_number=?, cover_date=?, release_date=? WHERE id=?',
      [cv_id||null, cv_slug||null, name, cv_img||null, cv_vol_id||null, ds_vol_id||null, issue_number||null, cover_date||null, release_date||null, req.params.id]
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

module.exports = router;