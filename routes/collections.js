const { Router } = require('express');
const { runQuery, getAll, getOne, rawRun, saveDatabase } = require('../db');

const COLLECTION_THEME_ID = 44; // themes.id для "Collection"

const router = Router();

// ── Нормалізація order_num для існуючих записів ───────────────────────────
// Якщо всі order_num = 0 або є дублікати — перенумеровуємо за номером випуску
function ensureOrderNums(collectionId) {
  const items = getAll(
    'SELECT ci.issue_id, ci.order_num FROM collection_issues ci WHERE ci.collection_id = ? ORDER BY ci.order_num ASC, CAST((SELECT issue_number FROM issues WHERE id = ci.issue_id) AS REAL) ASC, ci.issue_id ASC',
    [collectionId]
  );
  if (!items.length) return;

  // Перевіряємо: якщо всі order_num = 0 або є дублікати — нормалізуємо
  const nums = items.map(i => i.order_num);
  const allZero = nums.every(n => n === 0);
  const hasDuplicates = new Set(nums).size !== nums.length;

  if (allZero || hasDuplicates) {
    items.forEach((item, idx) => {
      rawRun(
        'UPDATE collection_issues SET order_num = ? WHERE collection_id = ? AND issue_id = ?',
        [idx + 1, collectionId, item.issue_id]
      );
    });
    saveDatabase();
  }
}

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
  const { name, volume_name, issue_number, cv_vol_id, exact, limit = 60 } = req.query;
  const isExact = exact === 'true';

  const conds = [], params = [];

  if (name) {
    conds.push(isExact ? 'LOWER(c.name) = LOWER(?)' : 'c.name LIKE ?');
    params.push(isExact ? name : `%${name}%`);
  }
  if (volume_name) {
    conds.push(isExact ? 'LOWER(v.name) = LOWER(?)' : 'v.name LIKE ?');
    params.push(isExact ? volume_name : `%${volume_name}%`);
  }
  if (issue_number) {
    conds.push('c.issue_number LIKE ?');
    params.push(`%${issue_number}%`);
  }
  if (cv_vol_id) {
    conds.push('c.cv_vol_id = ?');
    params.push(parseInt(cv_vol_id));
  }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const data = getAll(`
    SELECT c.id, c.name, c.cv_img, c.cv_id, c.issue_number,
           v.name as volume_name
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
  const { search, limit = 50, offset = 0, type, publisher_ids, theme_ids } = req.query;

  // Розбираємо publisher_ids: "1,2,3" → [1, 2, 3]
  const pubIds = publisher_ids
    ? publisher_ids.split(',').map(Number).filter(Boolean)
    : [];

  const themeIds = theme_ids
      ? theme_ids.split(',').map(Number).filter(Boolean)
      : [];

  // ── Випуски (issues) з томів теми Collection ─────────────────────────────
  let issueItems = [];
  if (!type || type === 'issue') {
    let issueWhere = 'WHERE vt.theme_id = ?';
    let issueParams = [COLLECTION_THEME_ID];

    if (search) {
      issueWhere += ' AND (i.name LIKE ? OR v.name LIKE ?)';
      issueParams.push(`%${search}%`, `%${search}%`);
    }
    if (pubIds.length) {
      issueWhere += ` AND v.publisher IN (${pubIds.map(() => '?').join(',')})`;
      issueParams.push(...pubIds);
    }
    themeIds.forEach(tid => {
      issueWhere += ' AND EXISTS (SELECT 1 FROM volume_themes _vt WHERE _vt.cv_vol_id = v.cv_id AND _vt.theme_id = ?)';
      issueParams.push(tid);
    });

    issueItems = getAll(`
      SELECT DISTINCT i.id, i.name, i.cv_img, i.issue_number, i.release_date,
                      i.created_at,
                      v.name as volume_name, 'issue' as _type
      FROM issues i
      JOIN volumes v ON i.cv_vol_id = v.cv_id
      JOIN volume_themes vt ON v.id = vt.volume_id
      ${issueWhere}
      ORDER BY i.created_at DESC
    `, issueParams);
  }

  // ── Збірники (collections) ────────────────────────────────────────────────
  let colItems = [];
  if (!type || type === 'collection') {
    const colConds = [];
    const colParams = [];

    if (search) {
      colConds.push('(c.name LIKE ? OR v.name LIKE ?)');
      colParams.push(`%${search}%`, `%${search}%`);
    }
    if (pubIds.length) {
      colConds.push(`c.publisher IN (${pubIds.map(() => '?').join(',')})`);
      colParams.push(...pubIds);
    }
    themeIds.forEach(tid => {
      colConds.push(`EXISTS (
          SELECT 1 FROM volume_themes _vt
          JOIN volumes _v ON _v.id = _vt.volume_id
          WHERE _v.cv_id = c.cv_vol_id AND _vt.theme_id = ?
      )`);
      colParams.push(tid);
    });

    const colWhere = colConds.length ? 'WHERE ' + colConds.join(' AND ') : '';
    colItems = getAll(`
      SELECT c.id, c.name, c.cv_img, c.issue_number, c.created_at as release_date,
             c.created_at,
             v.name as volume_name, 'collection' as _type,
             p.name as publisher_name,
             (SELECT COUNT(*) FROM collection_issues ci WHERE ci.collection_id = c.id) as issue_count
      FROM collections c
      LEFT JOIN volumes v ON c.cv_vol_id = v.cv_id
      LEFT JOIN publishers p ON c.publisher = p.id
      ${colWhere}
      ORDER BY c.created_at DESC
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
           COALESCE(v.name, mv.name) as volume_name,
           COALESCE(v.id, mv.id)     as volume_id,
           p.name as publisher_name
    FROM collections c
    LEFT JOIN volumes v  ON c.cv_vol_id IS NOT NULL AND v.cv_id = c.cv_vol_id
    LEFT JOIN volumes mv ON c.cv_vol_id IS NULL AND mv.id = (
        SELECT ds_vol_id FROM issues i
        JOIN collection_issues ci ON ci.issue_id = i.id
        WHERE ci.collection_id = c.id AND i.ds_vol_id IS NOT NULL
        LIMIT 1
    )
    LEFT JOIN publishers p ON c.publisher = p.id
    WHERE c.id = ?
  `, [req.params.id]);
  if (!collection) return res.status(404).json({ error: 'Збірник не знайдено' });

  // Нормалізуємо order_num якщо потрібно (для старих даних з order_num = 0)
  ensureOrderNums(req.params.id);

const issues = getAll(`
    SELECT i.*,
           COALESCE(v.name, mv.name)   AS volume_name,
           COALESCE(v.id,   mv.id)     AS volume_db_id,
           ci.order_num,
           ci.chapter_title
    FROM issues i
    JOIN collection_issues ci ON i.id = ci.issue_id
    LEFT JOIN volumes v  ON i.cv_vol_id = v.cv_id
    LEFT JOIN volumes mv ON i.ds_vol_id = mv.id
    WHERE ci.collection_id = ?
    ORDER BY ci.order_num ASC, CAST(i.issue_number AS REAL) ASC
  `, [req.params.id]);

const themes = getAll(
    `SELECT t.* FROM themes t JOIN collection_themes ct ON t.id = ct.theme_id WHERE ct.collection_id = ?`,
    [req.params.id]
  );

  // Теми тому збірника (для comics — через cv_vol_id, для manga — через ds_vol_id розділів)
  const volumeDbId = collection.volume_id
    || issues.find(i => i.ds_vol_id)?.ds_vol_id
    || null;
  const volume_themes = volumeDbId
    ? getAll(
        `SELECT t.* FROM themes t JOIN volume_themes vt ON t.id = vt.theme_id WHERE vt.volume_id = ?`,
        [volumeDbId]
      )
    : [];

  res.json({ ...collection, issues, themes, volume_themes });
});

router.put('/:id', (req, res) => {
  const allowed = ['name', 'cv_img', 'cv_id', 'cv_slug', 'cv_vol_id', 'publisher', 'issue_number', 'isbn', 'cover_date', 'release_date', 'description'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (key in req.body) {
      fields.push(`${key} = ?`);
      values.push(req.body[key] === '' ? null : (req.body[key] ?? null));
    }
  }
  if (!fields.length && !Array.isArray(req.body.theme_ids)) {
    return res.status(400).json({ error: 'Нема полів для оновлення' });
  }
  try {
    if (fields.length) {
      runQuery(
        `UPDATE collections SET ${fields.join(', ')} WHERE id = ?`,
        [...values, req.params.id]
      );
    }
    if (Array.isArray(req.body.theme_ids)) {
      rawRun('DELETE FROM collection_themes WHERE collection_id = ?', [req.params.id]);
      req.body.theme_ids.forEach(themeId =>
        rawRun('INSERT INTO collection_themes (collection_id, theme_id) VALUES (?, ?)', [req.params.id, themeId])
      );
    }
    saveDatabase();
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

// ── Додавання випуску до збірника ─────────────────────────────────────────

router.post('/:id/issues', (req, res) => {
  const { issue_id, chapter_title } = req.body;
  try {
    const exists = getOne(
      'SELECT id FROM collection_issues WHERE collection_id = ? AND issue_id = ?',
      [req.params.id, issue_id]
    );
    if (exists) return res.status(400).json({ error: 'Випуск вже є у збірнику' });

    // Заповнюємо chapter_title з назви випуску якщо не передано
    const resolvedTitle = chapter_title ||
      getOne('SELECT name FROM issues WHERE id = ?', [issue_id])?.name ||
      null;

    // Призначаємо наступний order_num
    const totalRow = getOne(
      'SELECT COUNT(*) as cnt FROM collection_issues WHERE collection_id = ?',
      [req.params.id]
    );
    const insertPos = (totalRow?.cnt || 0) + 1;

    rawRun(
      'INSERT INTO collection_issues (collection_id, issue_id, order_num, chapter_title) VALUES (?, ?, ?, ?)',
      [req.params.id, issue_id, insertPos, resolvedTitle]
    );
    saveDatabase();
    res.json({ message: 'Випуск додано до збірника', order_num: insertPos });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ── Оновлення chapter_title запису у збірнику ─────────────────────────────
router.patch('/:id/issues/:issueId', (req, res) => {
  const { chapter_title } = req.body;
  try {
    rawRun(
      'UPDATE collection_issues SET chapter_title = ? WHERE collection_id = ? AND issue_id = ?',
      [chapter_title || null, req.params.id, req.params.issueId]
    );
    saveDatabase();
    res.json({ message: 'chapter_title оновлено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ── Видалення випуску зі збірника (з перенумерацією) ──────────────────────

router.delete('/:id/issues/:issue_id', (req, res) => {
  try {
    const item = getOne(
      'SELECT order_num FROM collection_issues WHERE collection_id = ? AND issue_id = ?',
      [req.params.id, req.params.issue_id]
    );
    if (item) {
      rawRun(
        'DELETE FROM collection_issues WHERE collection_id = ? AND issue_id = ?',
        [req.params.id, req.params.issue_id]
      );
      // Зменшуємо order_num для всіх наступних
      rawRun(
        'UPDATE collection_issues SET order_num = order_num - 1 WHERE collection_id = ? AND order_num > ?',
        [req.params.id, item.order_num]
      );
      saveDatabase();
    }
    res.json({ message: 'Випуск видалено зі збірника' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ── Зміна порядку випуску у збірнику ──────────────────────────────────────

router.put('/:id/issues/:issue_id/reorder', (req, res) => {
  const collectionId = req.params.id;
  const issueId      = req.params.issue_id;
  const new_order    = parseInt(req.body.new_order);

  if (isNaN(new_order)) return res.status(400).json({ error: 'new_order обов\'язковий' });

  try {
    const item = getOne(
      'SELECT order_num FROM collection_issues WHERE collection_id = ? AND issue_id = ?',
      [collectionId, issueId]
    );
    if (!item) return res.status(404).json({ error: 'Не знайдено' });

    const old_order  = item.order_num;
    const totalRow   = getOne('SELECT COUNT(*) as cnt FROM collection_issues WHERE collection_id = ?', [collectionId]);
    const clampedNew = Math.max(1, Math.min(new_order, totalRow?.cnt || 1));

    if (old_order === clampedNew) return res.json({ message: 'Без змін' });

    if (old_order < clampedNew) {
      // Рухаємо вниз: зменшуємо всі між старою і новою позицією
      rawRun(
        'UPDATE collection_issues SET order_num = order_num - 1 WHERE collection_id = ? AND order_num > ? AND order_num <= ?',
        [collectionId, old_order, clampedNew]
      );
    } else {
      // Рухаємо вгору: збільшуємо всі між новою і старою позицією
      rawRun(
        'UPDATE collection_issues SET order_num = order_num + 1 WHERE collection_id = ? AND order_num >= ? AND order_num < ?',
        [collectionId, clampedNew, old_order]
      );
    }

    rawRun(
      'UPDATE collection_issues SET order_num = ? WHERE collection_id = ? AND issue_id = ?',
      [clampedNew, collectionId, issueId]
    );

    saveDatabase();
    res.json({ message: 'Порядок оновлено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

module.exports = router;

// ─── Manga router ────────────────────────────────────────────────────────────
const MANGA_THEME_ID = 36;
const mangaRouter = Router();

mangaRouter.get('/', (req, res) => {
  const { search, limit = 50, offset = 0, type, publisher_ids, theme_ids } = req.query;

  const pubIds = publisher_ids
    ? publisher_ids.split(',').map(Number).filter(Boolean)
    : [];

  const themeIds = theme_ids
    ? theme_ids.split(',').map(Number).filter(Boolean)
    : [];

  // ── Випуски манґи ─────────────────────────────────────────────────────────
  let issueItems = [];
  if (!type || type === 'issue') {
    let issueWhere = 'WHERE vt.theme_id = ?';
    let issueParams = [MANGA_THEME_ID];

    if (search) {
      issueWhere += ' AND (i.name LIKE ? OR v.name LIKE ?)';
      issueParams.push(`%${search}%`, `%${search}%`);
    }
    if (pubIds.length) {
      issueWhere += ` AND v.publisher IN (${pubIds.map(() => '?').join(',')})`;
      issueParams.push(...pubIds);
    }
    themeIds.forEach(tid => {
      issueWhere += ' AND EXISTS (SELECT 1 FROM volume_themes _vt WHERE _vt.volume_id = v.id AND _vt.theme_id = ?)';
      issueParams.push(tid);
    });

    issueItems = getAll(`
      SELECT DISTINCT i.id, i.name, i.cv_img, i.issue_number, i.release_date,
                      i.created_at,
                      v.name as volume_name, 'issue' as _type
      FROM issues i
      JOIN volumes v ON i.cv_vol_id = v.cv_id
      JOIN volume_themes vt ON v.id = vt.volume_id
      ${issueWhere}
      ORDER BY i.created_at DESC
    `, issueParams);
  }

  // ── Збірники манґи ────────────────────────────────────────────────────────
  let colItems = [];
  if (!type || type === 'collection') {
    const colConds = [];
    const colParams = [];

    if (search) {
      colConds.push('(c.name LIKE ? OR v.name LIKE ?)');
      colParams.push(`%${search}%`, `%${search}%`);
    }
    if (pubIds.length) {
      colConds.push(`c.publisher IN (${pubIds.map(() => '?').join(',')})`);
      colParams.push(...pubIds);
    }
    themeIds.forEach(tid => {
      colConds.push('EXISTS (SELECT 1 FROM volume_themes _vt JOIN volumes _v ON _v.id = _vt.volume_id WHERE _v.cv_id = c.cv_vol_id AND _vt.theme_id = ?)');
      colParams.push(tid);
    });



    const colWhere = colConds.length ? 'WHERE ' + colConds.join(' AND ') : '';
    colItems = getAll(`
      SELECT c.id, c.name, c.cv_img, c.issue_number, c.created_at as release_date,
             c.created_at,
             v.name as volume_name, 'collection' as _type,
             p.name as publisher_name,
             (SELECT COUNT(*) FROM collection_issues ci WHERE ci.collection_id = c.id) as issue_count
      FROM collections c
      LEFT JOIN volumes v ON c.cv_vol_id = v.cv_id
      LEFT JOIN publishers p ON c.publisher = p.id
      ${colWhere}
      ORDER BY c.created_at DESC
    `, colParams);
  }

  const allItems = [...issueItems, ...colItems];
  res.json({
    data: allItems.slice(parseInt(offset), parseInt(offset) + parseInt(limit)),
    total: allItems.length,
  });
});

module.exports.mangaRouter = mangaRouter;