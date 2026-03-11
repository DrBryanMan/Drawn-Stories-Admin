// routes/volumes.js
const { Router } = require('express');
const { runQuery, getAll, getOne, rawRun, saveDatabase } = require('../db');

const COLLECTION_THEME_ID = 44; // Collection
const TRANSLATED_THEME_ID = 51; // Translated
const MAGAZINE_THEME_ID   = 35; // Magazine

const router = Router();

router.get('/', (req, res) => {
  const { search, exact, cv_id, limit = 50, offset = 0, publisher_ids, theme_ids } = req.query;
  const isExact = exact === 'true';

  const pubIds = publisher_ids
    ? publisher_ids.split(',').map(Number).filter(Boolean)
    : [];

  // Фільтр по темах: використовуємо DB id з таблиці themes (НЕ cv_id тому!)
  const themeIds = theme_ids
    ? theme_ids.split(',').map(Number).filter(Boolean)
    : [];

  let conditions = [], searchParams = [], params = [];

  if (search) {
    conditions.push(isExact ? 'LOWER(v.name) = LOWER(?)' : '(v.name LIKE ? OR v.cv_slug LIKE ?)');
    searchParams = isExact ? [search] : [`%${search}%`, `%${search}%`];
  }
  if (cv_id) {
    conditions.push('v.cv_id = ?');
    searchParams.push(parseInt(cv_id));
  }
  if (pubIds.length) {
    conditions.push(`v.publisher IN (${pubIds.map(() => '?').join(',')})`);
    searchParams.push(...pubIds);
  }
  // Кожна тема — окрема умова AND (том повинен мати ВСІ обрані теми)
  themeIds.forEach(tid => {
    conditions.push('EXISTS (SELECT 1 FROM volume_themes _vt WHERE _vt.cv_vol_id = v.cv_id AND _vt.theme_id = ?)');
    searchParams.push(tid);
  });

  const whereClause = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  params = [...searchParams, parseInt(limit), parseInt(offset)];

  const volumes = getAll(`
    SELECT v.*,
           p.name as publisher_name,
           (SELECT COUNT(*) FROM issues i WHERE i.cv_vol_id = v.cv_id) as issue_count
    FROM volumes v
    LEFT JOIN publishers p ON v.publisher = p.id
    ${whereClause}
    ORDER BY v.created_at DESC
    LIMIT ? OFFSET ?
  `, params);

  let countQuery = `SELECT COUNT(*) as count FROM volumes v LEFT JOIN publishers p ON v.publisher = p.id${whereClause}`;
  const total = getOne(countQuery, searchParams);
  res.json({ data: volumes, total: total?.count || 0 });
});

router.get('/by-cv-id/:cv_id', (req, res) => {
  const volume = getOne('SELECT * FROM volumes WHERE cv_id = ?', [parseInt(req.params.cv_id)]);
  if (!volume) return res.status(404).json({ error: 'Том не знайдено' });
  res.json(volume);
});

router.get('/:id/themes', (req, res) => {
  const vol = getOne('SELECT cv_id FROM volumes WHERE id = ?', [req.params.id]);
  if (!vol) return res.json({ data: [] });
  const data = getAll(
    `SELECT t.* FROM themes t JOIN volume_themes vt ON t.id = vt.theme_id WHERE vt.cv_vol_id = ?`,
    [vol.cv_id]
  );
  res.json({ data });
});

router.get('/:id/series', (req, res) => {
  const data = getAll(
    `SELECT s.* FROM series s JOIN series_volumes sv ON s.id = sv.series_id WHERE sv.volume_id = ?`,
    [req.params.id]
  );
  res.json({ data });
});

router.get('/:id', (req, res) => {
  const volume = getOne(`
    SELECT v.*,
           p.name as publisher_name,
           (SELECT COUNT(*) FROM issues i WHERE i.cv_vol_id = v.cv_id) as issue_count
    FROM volumes v
    LEFT JOIN publishers p ON v.publisher = p.id
    WHERE v.id = ?
  `, [req.params.id]);
  if (!volume) return res.status(404).json({ error: 'Том не знайдено' });
  res.json(volume);
});

router.post('/', (req, res) => {
  const { cv_id, cv_slug, name, cv_img, lang, locg_id, locg_slug, publisher, start_year, description } = req.body;
  try {
    runQuery(
      'INSERT INTO volumes (cv_id, cv_slug, name, cv_img, lang, locg_id, locg_slug, publisher, start_year, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [cv_id, cv_slug, name, cv_img || null, lang || null, locg_id || null, locg_slug || null, publisher || null, start_year || null, description || null]
    );
    if (lang) {
      rawRun(
        'INSERT OR IGNORE INTO volume_themes (cv_vol_id, theme_id) VALUES (?, ?)',
        [cv_id, TRANSLATED_THEME_ID]
      );
    }
    res.json({ message: 'Том створено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/:id', (req, res) => {
  const { cv_id, cv_slug, name, cv_img, lang, locg_id, locg_slug, publisher, start_year, description, theme_ids } = req.body;
  try {
    runQuery(
      'UPDATE volumes SET cv_id = ?, cv_slug = ?, name = ?, cv_img = ?, lang = ?, locg_id = ?, locg_slug = ?, publisher = ?, start_year = ?, description = ? WHERE id = ?',
      [cv_id, cv_slug, name, cv_img || null, lang || null, locg_id || null, locg_slug || null, publisher || null, start_year || null, description || null, req.params.id]
    );
    if (Array.isArray(theme_ids) && cv_id) {
      rawRun('DELETE FROM volume_themes WHERE cv_vol_id = ?', [cv_id]);
      theme_ids.forEach(themeId =>
        rawRun('INSERT INTO volume_themes (cv_vol_id, theme_id) VALUES (?, ?)', [cv_id, themeId])
      );
    }

    saveDatabase();
    res.json({ message: 'Том оновлено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// Збірники, до яких входять випуски цього тому
router.get('/:id/collections-from-issues', (req, res) => {
  try {
    const volume = getOne('SELECT * FROM volumes WHERE id = ?', [parseInt(req.params.id)]);
    if (!volume) return res.status(404).json({ error: 'Том не знайдено' });

    const collections = getAll(`
      SELECT DISTINCT c.*
      FROM collections c
      JOIN collection_issues ci ON c.id = ci.collection_id
      JOIN issues i ON ci.issue_id = i.id
      WHERE i.cv_vol_id = ?
      ORDER BY CAST(c.issue_number AS REAL) ASC, c.name ASC
    `, [volume.cv_id]);

    // Для кожного збірника визначаємо номери випусків з цього тому
    const result = collections.map(col => {
      const issueNumbers = getAll(`
        SELECT i.issue_number
        FROM collection_issues ci
        JOIN issues i ON ci.issue_id = i.id
        WHERE ci.collection_id = ? AND i.cv_vol_id = ? AND i.issue_number IS NOT NULL
        ORDER BY CAST(i.issue_number AS REAL) ASC
      `, [col.id, volume.cv_id]).map(r => r.issue_number);

      return { ...col, volume_issue_numbers: issueNumbers };
    });

    res.json({ data: result });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// Конвертація всіх випусків тома у збірники + додає тему Collection
router.post('/:id/convert-all-to-collections', (req, res) => {
  try {
    const volumeId = parseInt(req.params.id);
    const volume = getOne('SELECT * FROM volumes WHERE id = ?', [volumeId]);
    if (!volume) return res.status(404).json({ error: 'Том не знайдено' });

    const issues = getAll('SELECT * FROM issues WHERE cv_vol_id = ?', [volume.cv_id]);
    if (!issues.length) return res.status(400).json({ error: 'У цього тома немає випусків' });

    let converted = 0, skipped = 0;
    issues.forEach(issue => {
      const existing = getOne('SELECT id FROM collections WHERE cv_id = ?', [issue.cv_id]);
      if (existing) {
        rawRun('DELETE FROM issues WHERE id = ?', [issue.id]);
        skipped++;
        return;
      }
      rawRun(
        `INSERT INTO collections (cv_vol_id, name, cv_img, cv_id, cv_slug, issue_number, cover_date, release_date, publisher) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [issue.cv_vol_id || null, issue.name || 'Без назви', issue.cv_img || null, issue.cv_id, issue.cv_slug, issue.issue_number || null, issue.cover_date || null, issue.release_date || null, volume.publisher || null,  ]
      );
      rawRun('DELETE FROM issues WHERE id = ?', [issue.id]);
      converted++;
    });

    // Додаємо тему Collection до тому якщо ще немає
    const themeExists = getOne('SELECT id FROM volume_themes WHERE cv_vol_id = ? AND theme_id = ?', [volume.cv_id, COLLECTION_THEME_ID]);
    if (!themeExists) {
      rawRun('INSERT INTO volume_themes (cv_vol_id, theme_id) VALUES (?, ?)', [volume.cv_id, COLLECTION_THEME_ID]);
    }

    // Якщо том належить до журналу — прибираємо тему Translated
    const hasMagazineParent = getOne('SELECT id FROM volume_magazines WHERE child_id = ?', [volumeId]);
    if (hasMagazineParent) {
      rawRun('DELETE FROM volume_themes WHERE cv_vol_id = ? AND theme_id = ?', [volume.cv_id, TRANSLATED_THEME_ID]);
      if (!volume.lang || volume.lang === '') {
        rawRun("UPDATE volumes SET lang = 'ja' WHERE id = ?", [volumeId]);
      }
    }

    saveDatabase();
    res.json({ 
				message: `Конвертовано: ${converted}, видалено дублікатів (збірник вже існував): ${skipped}`, 
				converted, 
				skipped 
		});
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// Зворотня конвертація: всі збірники тома → випуски + видаляє тему Collection
router.post('/:id/convert-all-collections-to-issues', (req, res) => {
  try {
    const volumeId = parseInt(req.params.id);
    const volume = getOne('SELECT * FROM volumes WHERE id = ?', [volumeId]);
    if (!volume) return res.status(404).json({ error: 'Том не знайдено' });

    const collections = getAll('SELECT * FROM collections WHERE cv_vol_id = ?', [volume.cv_id]);
    if (!collections.length) return res.status(400).json({ error: 'У цього тома немає збірників' });

    let converted = 0, skipped = 0;
    collections.forEach(col => {
      if (!col.cv_id || !col.cv_slug) { skipped++; return; }
      const existingIssue = getOne('SELECT id FROM issues WHERE cv_id = ?', [col.cv_id]);
      if (existingIssue) { skipped++; return; }
      rawRun(
        'INSERT INTO issues (cv_id, cv_slug, name, cv_img, cv_vol_id, issue_number, cover_date, release_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [col.cv_id, col.cv_slug, col.name || 'Без назви', col.cv_img || null,
         col.cv_vol_id || null, col.issue_number || null, col.cover_date || null, col.release_date || null]
      );
      rawRun('DELETE FROM collection_issues WHERE collection_id = ?', [col.id]);
      rawRun('DELETE FROM collection_themes WHERE collection_id = ?', [col.id]);
      rawRun('DELETE FROM series_collections WHERE collection_id = ?', [col.id]);
      rawRun('DELETE FROM collections WHERE id = ?', [col.id]);
      converted++;
    });

    // Видаляємо тему Collection з тому
    rawRun('DELETE FROM volume_themes WHERE cv_vol_id = ? AND theme_id = ?', [volume.cv_id, COLLECTION_THEME_ID]);

    saveDatabase();
    res.json({ message: `Конвертовано: ${converted}, пропущено: ${skipped}`, converted, skipped });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/:id/themes', (req, res) => {
  const { theme_ids } = req.body;
  if (!Array.isArray(theme_ids)) return res.status(400).json({ error: 'theme_ids має бути масивом' });
  try {
    const vol = getOne('SELECT cv_id FROM volumes WHERE id = ?', [req.params.id]);
    if (!vol) return res.status(404).json({ error: 'Том не знайдено' });
    rawRun('DELETE FROM volume_themes WHERE cv_vol_id = ?', [vol.cv_id]);
    theme_ids.forEach(themeId =>
      rawRun('INSERT INTO volume_themes (cv_vol_id, theme_id) VALUES (?, ?)', [vol.cv_id, themeId])
    );
    saveDatabase();
    res.json({ message: 'Теми оновлено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    runQuery('DELETE FROM volumes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Том видалено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

function ensureVolumeTheme(volumeDbId, themeId) {
  const vol = getOne('SELECT cv_id FROM volumes WHERE id = ?', [volumeDbId]);
  if (!vol) return;
  const has = getOne(
    'SELECT id FROM volume_themes WHERE cv_vol_id = ? AND theme_id = ?',
    [vol.cv_id, themeId]
  );
  if (!has) {
    rawRun(
      'INSERT INTO volume_themes (cv_vol_id, theme_id) VALUES (?, ?)',
      [vol.cv_id, themeId]
    );
  }
}

// ── Переклади ─────────────────────────────────────────────────────────────

// GET список перекладів (дочірні томи) даного тому-оригіналу
router.get('/:id/translations', (req, res) => {
  const data = getAll(`
    SELECT v.*, p.name as publisher_name,
      (SELECT COUNT(*) FROM collections c WHERE c.cv_vol_id = v.cv_id) as collections_count
    FROM volume_translations vt
    JOIN volumes v ON v.id = vt.child_id
    LEFT JOIN publishers p ON p.id = v.publisher
    WHERE vt.parent_id = ?
    ORDER BY v.lang, v.name
  `, [req.params.id]);
  res.json({ data });
});

// GET батьківський том-оригінал для цього перекладу
router.get('/:id/translation-parent', (req, res) => {
  const row = getOne(`
    SELECT v.*, p.name as publisher_name,
      (SELECT COUNT(*) FROM collections c WHERE c.cv_vol_id = v.cv_id) as collections_count
    FROM volume_translations vt
    JOIN volumes v ON v.id = vt.parent_id
    LEFT JOIN publishers p ON p.id = v.publisher
    WHERE vt.child_id = ?
  `, [req.params.id]);
  res.json({ data: row || null });
});

// POST додати переклад: цей том (id) є оригіналом, child_id — переклад
router.post('/:id/translations', (req, res) => {
  const parentId = parseInt(req.params.id);
  const { child_id } = req.body;
  if (!child_id) return res.status(400).json({ error: 'child_id обов\'язковий' });
  if (parseInt(child_id) === parentId) return res.status(400).json({ error: 'Том не може бути перекладом самого себе' });
  try {
    const existing = getOne(
      'SELECT id FROM volume_translations WHERE parent_id = ? AND child_id = ?',
      [parentId, child_id]
    );
    if (existing) return res.status(400).json({ error: 'Цей зв\'язок вже існує' });

    // Перевіряємо чи child вже не є батьком (уникаємо циклів)
    const reverse = getOne(
      'SELECT id FROM volume_translations WHERE parent_id = ? AND child_id = ?',
      [child_id, parentId]
    );
    if (reverse) return res.status(400).json({ error: 'Цей том вже є батьком зазначеного' });

    runQuery('INSERT INTO volume_translations (parent_id, child_id) VALUES (?, ?)', [parentId, child_id]);

    // Автоматично додаємо тему Translated (51) до дочірнього тому
    ensureVolumeTheme(parseInt(child_id), TRANSLATED_THEME_ID);

    saveDatabase();
    res.json({ message: 'Переклад додано' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// DELETE прибрати переклад
router.delete('/:id/translations/:childId', (req, res) => {
  try {
    runQuery(
      'DELETE FROM volume_translations WHERE parent_id = ? AND child_id = ?',
      [req.params.id, req.params.childId]
    );
    res.json({ message: 'Переклад видалено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ── Журнали ───────────────────────────────────────────────────────────────

// GET список томів що входять у цей журнал
router.get('/:id/magazine-children', (req, res) => {
  const data = getAll(`
    SELECT v.*, p.name as publisher_name
    FROM volume_magazines vm
    JOIN volumes v ON v.id = vm.child_id
    LEFT JOIN publishers p ON p.id = v.publisher
    WHERE vm.magazine_id = ?
    ORDER BY v.start_year, v.name
  `, [req.params.id]);
  res.json({ data });
});

// GET батьківський журнал для цього тому
router.get('/:id/magazine-parent', (req, res) => {
  const rows = getAll(`
    SELECT v.*, p.name as publisher_name
    FROM volume_magazines vm
    JOIN volumes v ON v.id = vm.magazine_id
    LEFT JOIN publishers p ON p.id = v.publisher
    WHERE vm.child_id = ?
    ORDER BY v.name
  `, [req.params.id]);
  res.json({ data: rows });
});

// POST додати том до журналу: цей том (id) є журналом, child_id — дочірній том
router.post('/:id/magazine-children', (req, res) => {
  const magazineId = parseInt(req.params.id);
  const { child_id } = req.body;
  if (!child_id) return res.status(400).json({ error: 'child_id обов\'язковий' });
  if (parseInt(child_id) === magazineId) return res.status(400).json({ error: 'Том не може бути своїм власним журналом' });
  try {
    const existing = getOne(
      'SELECT id FROM volume_magazines WHERE magazine_id = ? AND child_id = ?',
      [magazineId, child_id]
    );
    if (existing) return res.status(400).json({ error: 'Цей зв\'язок вже існує' });

    // Перевіряємо чи child не є вже журналом для цього тому
    const alreadyParent = getOne(
      'SELECT id FROM volume_magazines WHERE magazine_id = ? AND child_id = ?',
      [child_id, magazineId]
    );
    if (alreadyParent) return res.status(400).json({ error: 'Цей том вже є дочірнім для зазначеного' });

    runQuery('INSERT INTO volume_magazines (magazine_id, child_id) VALUES (?, ?)', [magazineId, child_id]);

    // Автоматично додаємо тему Magazine (35) до батьківського тому-журналу
    ensureVolumeTheme(magazineId, MAGAZINE_THEME_ID);
    // Автоматично встановлюємо мову 'ja' для дочірнього тому (якщо ще не задана)
    rawRun(
      "UPDATE volumes SET lang = 'ja' WHERE id = ? AND (lang IS NULL OR lang = '')",
      [parseInt(child_id)]
    );

    saveDatabase();
    res.json({ message: 'Том додано до журналу' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// DELETE прибрати том з журналу
router.delete('/:id/magazine-children/:childId', (req, res) => {
  try {
    runQuery(
      'DELETE FROM volume_magazines WHERE magazine_id = ? AND child_id = ?',
      [req.params.id, req.params.childId]
    );
    res.json({ message: 'Том видалено з журналу' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ── Хронологія / зв'язки між томами ──────────────────────────────────────

// Повертає:
//   chain : масив томів типу 'continuation', відсортованих за order_num
//           з позначкою current:true для поточного тому
//   other : { sequel:[...], prequel:[...], spinoff:[...], related:[...] }
//           кожен елемент містить поля тому + rel_id для видалення
router.get('/:id/relations', (req, res) => {
  const volId = parseInt(req.params.id);

  // ── 1. Ланцюжок continuation (рекурсивний CTE) ────────────────────────────
  const chainRaw = getAll(`
    WITH RECURSIVE chain(id, visited) AS (
      SELECT ?, ',' || ? || ','

      UNION ALL

      SELECT
        CASE WHEN vr.from_vol_id = c.id THEN vr.to_vol_id ELSE vr.from_vol_id END,
        c.visited || CASE WHEN vr.from_vol_id = c.id THEN vr.to_vol_id ELSE vr.from_vol_id END || ','
      FROM volume_relations vr
      JOIN chain c ON (vr.from_vol_id = c.id OR vr.to_vol_id = c.id)
      WHERE vr.rel_type = 'continuation'
        AND c.visited NOT LIKE '%,' || CASE WHEN vr.from_vol_id = c.id THEN vr.to_vol_id ELSE vr.from_vol_id END || ',%'
    )
    SELECT DISTINCT v.id, v.cv_id, v.name, v.cv_img, v.start_year, v.lang
    FROM chain ch
    JOIN volumes v ON v.id = ch.id
  `, [volId, volId]);

  // Дедуплікація
  const seen = new Set();
  const uniqueChain = chainRaw.filter(v => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  // Для кожного тому в ланцюжку шукаємо його виходячий зв'язок continuation
  // (from_vol_id = цей том) — саме там зберігається order_num і rel_id
  const chain = uniqueChain.map(v => {
    const rel = getOne(
      `SELECT id AS rel_id, order_num
       FROM volume_relations
       WHERE from_vol_id = ? AND rel_type = 'continuation'`,
      [v.id]
    );
    return {
      ...v,
      rel_id:    rel?.rel_id    ?? null,
      order_num: rel?.order_num ?? null,
      current:   v.id === volId,
    };
  });

  // Сортуємо: спочатку ті що мають order_num, потім за start_year
  chain.sort((a, b) => {
    if (a.order_num !== null && b.order_num !== null) return a.order_num - b.order_num;
    if (a.order_num !== null) return -1;
    if (b.order_num !== null) return 1;
    return (a.start_year || 9999) - (b.start_year || 9999);
  });

  // ── 2. Інші зв'язки (sequel / prequel / spinoff / related) ───────────────
  const otherRows = getAll(`
      SELECT
        vr.id       AS rel_id,
        vr.rel_type,
        vr.to_vol_id AS other_id
      FROM volume_relations vr
      WHERE vr.from_vol_id = ?
        AND vr.rel_type != 'continuation'
    `, [volId]);

  const other = { sequel: [], prequel: [], spinoff: [], related: [] };

  for (const row of otherRows) {
    const vol = getOne(`
      SELECT v.id, v.cv_id, v.name, v.cv_img, v.start_year, v.lang, p.name AS publisher_name
      FROM volumes v
      LEFT JOIN publishers p ON p.id = v.publisher
      WHERE v.id = ?
    `, [row.other_id]);

    if (vol && other[row.rel_type] !== undefined) {
      other[row.rel_type].push({ ...vol, rel_id: row.rel_id });
    }
  }

  res.json({ chain, other });
});

// POST /volumes/:id/relations — створити зв'язок
router.post('/:id/relations', (req, res) => {
  const fromId = parseInt(req.params.id);
  const { to_vol_id, rel_type, order_num = 0 } = req.body;

  if (!to_vol_id) return res.status(400).json({ error: 'to_vol_id обов\'язковий' });
  if (!rel_type)  return res.status(400).json({ error: 'rel_type обов\'язковий' });
  if (parseInt(to_vol_id) === fromId) return res.status(400).json({ error: 'Том не може посилатися на себе' });

  const validTypes = ['continuation','sequel','prequel'];
  if (!validTypes.includes(rel_type)) return res.status(400).json({ error: 'Невалідний тип зв\'язку' });

  const mirrorType = { sequel:'prequel', prequel:'sequel' };

  try {
    const existing = getOne(
      'SELECT id FROM volume_relations WHERE from_vol_id = ? AND to_vol_id = ? AND rel_type = ?',
      [fromId, to_vol_id, rel_type]
    );
    if (existing) return res.status(400).json({ error: 'Такий зв\'язок вже існує' });

    if (rel_type === 'continuation') {
      const reverse = getOne(
        'SELECT id FROM volume_relations WHERE from_vol_id = ? AND to_vol_id = ? AND rel_type = ?',
        [to_vol_id, fromId, 'continuation']
      );
      if (reverse) return res.status(400).json({ error: 'Зворотній зв\'язок вже існує' });
    }

    runQuery(
      'INSERT INTO volume_relations (from_vol_id, to_vol_id, rel_type, order_num) VALUES (?, ?, ?, ?)',
      [fromId, to_vol_id, rel_type, order_num]
    );

    // Автоматично створюємо дзеркальний зв'язок (для всіх крім continuation)
    if (mirrorType[rel_type]) {
      const mirrorExists = getOne(
        'SELECT id FROM volume_relations WHERE from_vol_id = ? AND to_vol_id = ? AND rel_type = ?',
        [to_vol_id, fromId, mirrorType[rel_type]]
      );
      if (!mirrorExists) {
        runQuery(
          'INSERT INTO volume_relations (from_vol_id, to_vol_id, rel_type, order_num) VALUES (?, ?, ?, ?)',
          [to_vol_id, fromId, mirrorType[rel_type], 0]
        );
      }
    }

    res.json({ message: 'Зв\'язок додано' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /volumes/:id/relations/:relId — оновити order_num зв'язку
router.put('/:id/relations/:relId', (req, res) => {
  const { order_num, rel_type } = req.body;

  try {
    const rel = getOne('SELECT * FROM volume_relations WHERE id = ?', [req.params.relId]);
    if (!rel) return res.status(404).json({ error: 'Зв\'язок не знайдено' });

    if (order_num !== undefined) {
      runQuery('UPDATE volume_relations SET order_num = ? WHERE id = ?',
        [parseInt(order_num), req.params.relId]);
    }

    if (rel_type !== undefined) {
      const mirrorType = { sequel:'prequel', prequel:'sequel' };

      runQuery('UPDATE volume_relations SET rel_type = ? WHERE id = ?',
        [rel_type, req.params.relId]);

      if (mirrorType[rel_type]) {
        const mirror = getOne(
          'SELECT id FROM volume_relations WHERE from_vol_id = ? AND to_vol_id = ?',
          [rel.to_vol_id, rel.from_vol_id]
        );
        if (mirror) {
          // Дзеркальний існує — оновлюємо його тип
          runQuery('UPDATE volume_relations SET rel_type = ? WHERE id = ?',
            [mirrorType[rel_type], mirror.id]);
        } else {
          // Дзеркального немає (старий запис) — створюємо
          runQuery(
            'INSERT INTO volume_relations (from_vol_id, to_vol_id, rel_type, order_num) VALUES (?, ?, ?, ?)',
            [rel.to_vol_id, rel.from_vol_id, mirrorType[rel_type], 0]
          );
        }
      }
    }

    res.json({ message: 'Зв\'язок оновлено' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /volumes/:id/relations/:relId — видалити зв'язок
router.delete('/:id/relations/:relId', (req, res) => {
  try {
    const rel = getOne('SELECT * FROM volume_relations WHERE id = ?', [req.params.relId]);
    if (!rel) return res.status(404).json({ error: 'Зв\'язок не знайдено' });

    const mirrorType = {
      sequel:  'prequel',
      prequel: 'sequel',
    };

    // Видаляємо основний
    runQuery('DELETE FROM volume_relations WHERE id = ?', [req.params.relId]);

    // Видаляємо дзеркальний (якщо є і якщо це не continuation)
    if (mirrorType[rel.rel_type]) {
      runQuery(
        'DELETE FROM volume_relations WHERE from_vol_id = ? AND to_vol_id = ? AND rel_type = ?',
        [rel.to_vol_id, rel.from_vol_id, mirrorType[rel.rel_type]]
      );
    }

    res.json({ message: 'Зв\'язок видалено' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;