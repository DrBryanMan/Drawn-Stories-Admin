// routes/collections.js
const { Router } = require('express');
const { runQuery, getAll, getOne, rawRun, saveDatabase } = require('../db');

const COLLECTION_THEME_ID = 44; // themes.id для "Collection"

const router = Router();

// Збірники конкретного тому (по cv_vol_id)
router.get('/by-volume/:cv_vol_id', (req, res) => {
  const data = getAll(`
    SELECT c.*
    FROM collections c
    WHERE c.cv_vol_id = ?
    ORDER BY CAST(c.issue_number AS REAL) ASC, c.name ASC
  `, [parseInt(req.params.cv_vol_id)]);
  res.json({ data });
});

// Пошук збірників (для модалок)
router.get('/search', (req, res) => {
  const { search, limit = 20 } = req.query;
  let where = '', params = [];
  if (search) { where = ' WHERE (c.name LIKE ? OR v.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  const data = getAll(`
    SELECT c.id, c.name, c.cv_img, v.name as volume_name
    FROM collections c
    LEFT JOIN volumes v ON c.cv_vol_id = v.cv_id
    ${where}
    ORDER BY c.name ASC
    LIMIT ?
  `, [...params, parseInt(limit)]);
  res.json({ data });
});

// Комбінований список: випуски з томів теми collection + таблиця collections
router.get('/', (req, res) => {
  const { search, limit = 50, offset = 0, type } = req.query;

  let issueItems = [];
  if (!type || type === 'issue') {
    let issueWhere = 'WHERE vt.theme_id = ?';
    let issueParams = [COLLECTION_THEME_ID];
    if (search) { issueWhere += ' AND (i.name LIKE ? OR v.name LIKE ?)'; issueParams.push(`%${search}%`, `%${search}%`); }

    issueItems = getAll(`
      SELECT DISTINCT i.id, i.name, i.cv_img, i.issue_number, i.release_date,
                      v.name as volume_name, 'issue' as _type
      FROM issues i
      JOIN volumes v ON i.cv_vol_id = v.cv_id
      JOIN volume_themes vt ON v.cv_id = vt.cv_vol_id
      ${issueWhere}
      ORDER BY v.name ASC, CAST(i.issue_number AS REAL) ASC
    `, issueParams);
  }

  let colItems = [];
  if (!type || type === 'collection') {
    let colWhere = '', colParams = [];
    if (search) { colWhere = ' WHERE (c.name LIKE ? OR v.name LIKE ?)'; colParams.push(`%${search}%`, `%${search}%`); }

    colItems = getAll(`
      SELECT c.id, c.name, c.cv_img, c.issue_number, c.created_at as release_date,
             v.name as volume_name, 'collection' as _type,
             p.name as publisher_name,
             (SELECT COUNT(*) FROM collection_issues ci WHERE ci.collection_id = c.id) as issue_count
      FROM collections c
      LEFT JOIN volumes v ON c.cv_vol_id = v.cv_id
      LEFT JOIN publishers p ON c.publisher = p.id
      ${colWhere}
      ORDER BY c.name ASC
    `, colParams);
  }

  const allItems = [...issueItems, ...colItems];
  res.json({
    data: allItems.slice(parseInt(offset), parseInt(offset) + parseInt(limit)),
    total: allItems.length,
  });
});

router.get('/:id/themes', (req, res) => {
  const data = getAll(
    `SELECT t.* FROM themes t JOIN collection_themes ct ON t.id = ct.theme_id WHERE ct.collection_id = ?`,
    [req.params.id]
  );
  res.json({ data });
});

router.get('/:id/series', (req, res) => {
  try {
    const data = getAll(
      `SELECT s.* FROM series s JOIN series_collections sc ON s.id = sc.series_id WHERE sc.collection_id = ?`,
      [req.params.id]
    );
    res.json({ data });
  } catch(e) { res.json({ data: [] }); }
});

router.get('/:id', (req, res) => {
  if (isNaN(parseInt(req.params.id))) return res.status(404).json({ error: 'Збірник не знайдено' });

  const collection = getOne(`
    SELECT c.*,
           v.name as volume_name, v.id as volume_id,
           p.name as publisher_name
    FROM collections c
    LEFT JOIN volumes v ON c.cv_vol_id = v.cv_id
    LEFT JOIN publishers p ON c.publisher = p.id
    WHERE c.id = ?
  `, [req.params.id]);
  if (!collection) return res.status(404).json({ error: 'Збірник не знайдено' });

  const issues = getAll(`
    SELECT i.*, v.name as volume_name
    FROM issues i
    JOIN collection_issues ci ON i.id = ci.issue_id
    LEFT JOIN volumes v ON i.cv_vol_id = v.cv_id
    WHERE ci.collection_id = ?
    ORDER BY CAST(i.issue_number AS REAL) ASC, i.issue_number ASC
  `, [req.params.id]);

  const themes = getAll(
    `SELECT t.* FROM themes t JOIN collection_themes ct ON t.id = ct.theme_id WHERE ct.collection_id = ?`,
    [req.params.id]
  );

  res.json({ ...collection, issues, themes });
});

router.put('/:id', (req, res) => {
  const { name, cv_img, cv_id, cv_slug, cv_vol_id, publisher, issue_number, isbn, cover_date, release_date, description, theme_ids } = req.body;
  try {
    runQuery(
      `UPDATE collections SET name = ?, cv_img = ?, cv_id = ?, cv_slug = ?,
        cv_vol_id = ?, publisher = ?, issue_number = ?, isbn = ?,
        cover_date = ?, release_date = ?, description = ?
       WHERE id = ?`,
      [name, cv_img || null, cv_id || null, cv_slug || null,
       cv_vol_id || null, publisher || null, issue_number || null, isbn || null,
       cover_date || null, release_date || null, description || null,
       req.params.id]
    );
    if (Array.isArray(theme_ids)) {
      rawRun('DELETE FROM collection_themes WHERE collection_id = ?', [req.params.id]);
      theme_ids.forEach(themeId =>
        rawRun('INSERT INTO collection_themes (collection_id, theme_id) VALUES (?, ?)', [req.params.id, themeId])
      );
      saveDatabase();
    }
    res.json({ message: 'Збірник оновлено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// Зворотня конвертація збірника → випуск
router.post('/:id/make-issue', (req, res) => {
  try {
    const collectionId = parseInt(req.params.id);
    const collection = getOne('SELECT * FROM collections WHERE id = ?', [collectionId]);
    if (!collection) return res.status(404).json({ error: 'Збірник не знайдено' });
    if (!collection.cv_id || !collection.cv_slug) return res.status(400).json({ error: 'Для конвертації потрібні cv_id та cv_slug' });

    const existingIssue = getOne('SELECT id FROM issues WHERE cv_id = ?', [collection.cv_id]);
    if (existingIssue) return res.status(400).json({ error: 'Випуск з таким cv_id вже існує', issue_id: existingIssue.id });

    rawRun(
      'INSERT INTO issues (cv_id, cv_slug, name, cv_img, cv_vol_id, issue_number, cover_date, release_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [collection.cv_id, collection.cv_slug, collection.name || 'Без назви',
       collection.cv_img || null, collection.cv_vol_id || null,
       collection.issue_number || null, collection.cover_date || null, collection.release_date || null]
    );
    rawRun('DELETE FROM collection_issues WHERE collection_id = ?', [collectionId]);
    rawRun('DELETE FROM collection_themes WHERE collection_id = ?', [collectionId]);
    rawRun('DELETE FROM series_collections WHERE collection_id = ?', [collectionId]);
    rawRun('DELETE FROM collections WHERE id = ?', [collectionId]);
    saveDatabase();

    const newIssue = getOne('SELECT * FROM issues WHERE cv_id = ?', [collection.cv_id]);
    res.json({ message: 'Збірник перетворено на випуск', issue: newIssue });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    runQuery('DELETE FROM collection_issues WHERE collection_id = ?', [req.params.id]);
    runQuery('DELETE FROM collection_themes WHERE collection_id = ?', [req.params.id]);
    runQuery('DELETE FROM collections WHERE id = ?', [req.params.id]);
    res.json({ message: 'Збірник видалено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/:id/issues', (req, res) => {
  const { issue_id } = req.body;
  try {
    const exists = getOne('SELECT id FROM collection_issues WHERE collection_id = ? AND issue_id = ?', [req.params.id, issue_id]);
    if (exists) return res.status(400).json({ error: 'Випуск вже є у збірнику' });
    runQuery('INSERT INTO collection_issues (collection_id, issue_id) VALUES (?, ?)', [req.params.id, issue_id]);
    res.json({ message: 'Випуск додано до збірника' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/:id/issues/:issue_id', (req, res) => {
  try {
    runQuery('DELETE FROM collection_issues WHERE collection_id = ? AND issue_id = ?', [req.params.id, req.params.issue_id]);
    res.json({ message: 'Випуск видалено зі збірника' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

module.exports = router;

// ─── Manga router ────────────────────────────────────────────────────────────
const MANGA_THEME_ID = 36;
const mangaRouter = Router();

mangaRouter.get('/', (req, res) => {
  const { search, limit = 50, offset = 0, type } = req.query;

  let issueItems = [];
  if (!type || type === 'issue') {
    let where = 'WHERE vt.theme_id = ?';
    let params = [MANGA_THEME_ID];
    if (search) { where += ' AND (i.name LIKE ? OR v.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    issueItems = getAll(`
      SELECT DISTINCT i.id, i.name, i.cv_img, i.issue_number, i.release_date,
                      v.name as volume_name, v.id as volume_id, 'issue' as _type
      FROM issues i
      JOIN volumes v ON i.cv_vol_id = v.cv_id
      JOIN volume_themes vt ON v.cv_id = vt.cv_vol_id
      ${where}
      ORDER BY v.name ASC, CAST(i.issue_number AS REAL) ASC
    `, params);
  }

  let colItems = [];
  if (!type || type === 'collection') {
    let where = '', params = [];
    if (search) { where = ' WHERE (c.name LIKE ? OR v.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    colItems = getAll(`
      SELECT DISTINCT c.id, c.name, c.cv_img, c.issue_number, c.release_date,
                      v.name as volume_name, v.id as volume_id, 'collection' as _type
      FROM collections c
      JOIN volumes v ON c.cv_vol_id = v.cv_id
      JOIN volume_themes vt ON v.cv_id = vt.cv_vol_id
      WHERE vt.theme_id = ?
      ${where ? 'AND ' + where.replace(' WHERE ', '') : ''}
      ORDER BY v.name ASC, CAST(c.issue_number AS REAL) ASC
    `, [MANGA_THEME_ID, ...params]);
  }

  const allItems = [...issueItems, ...colItems];
  const lim = parseInt(limit);
  const off = parseInt(offset);

  res.json({
    data: allItems.slice(off, off + lim),
    total: allItems.length,
  });
});

module.exports.mangaRouter = mangaRouter;