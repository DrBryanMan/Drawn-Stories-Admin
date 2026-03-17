// routes/volumes.js
const { Router } = require('express');
const { runQuery, getAll, getOne, rawRun, saveDatabase } = require('../db');

const COLLECTION_THEME_ID = 44; // Collection
const TRANSLATED_THEME_ID = 51; // Translated
const MAGAZINE_THEME_ID   = 35; // Magazine
const MANGA_THEME_ID = 36;
const router = Router();

router.get('/', (req, res) => {
  const { search, exact, cv_id, hikka_slug, mal_id, limit = 50, offset = 0, publisher_ids, theme_ids } = req.query;
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
    conditions.push(isExact
        ? '(LOWER(v.name) = LOWER(?) OR ULOWER(v.name_uk) = ULOWER(?))'
        : '(v.name LIKE ? OR v.cv_slug LIKE ? OR ULOWER(v.name_uk) LIKE ULOWER(?))');
    searchParams = isExact
        ? [search, search]
        : [`%${search}%`, `%${search}%`, `%${search}%`];
  }
  if (cv_id) {
    conditions.push('v.cv_id = ?');
    searchParams.push(parseInt(cv_id));
  }
  if (hikka_slug) {
      // Якщо немає дефісу — це лише ID-частина слагу, шукаємо як суфікс
      if (!hikka_slug.includes('-')) {
          conditions.push('v.hikka_slug LIKE ?');
          searchParams.push(`%-${hikka_slug}`);
      } else {
          conditions.push('v.hikka_slug = ?');
          searchParams.push(hikka_slug);
      }
  }
  if (mal_id) {
    conditions.push('v.mal_id = ?');
    searchParams.push(parseInt(mal_id));
  }
  if (req.query.db_id) {
    conditions.push('v.id = ?');
    searchParams.push(parseInt(req.query.db_id));
  }
  if (pubIds.length) {
    conditions.push(`v.publisher IN (${pubIds.map(() => '?').join(',')})`);
    searchParams.push(...pubIds);
  }
  if (pubIds.length) {
    conditions.push(`v.publisher IN (${pubIds.map(() => '?').join(',')})`);
    searchParams.push(...pubIds);
  }
  // Кожна тема — окрема умова AND (том повинен мати ВСІ обрані теми)
  themeIds.forEach(tid => {
    conditions.push('EXISTS (SELECT 1 FROM volume_themes _vt WHERE _vt.volume_id = v.id AND _vt.theme_id = ?)');
    searchParams.push(tid);
  });

  const whereClause = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  params = [...searchParams, parseInt(limit), parseInt(offset)];

  const volumes = getAll(`
    SELECT v.*,
           p.name as publisher_name,
           (SELECT COUNT(*) FROM issues i WHERE i.cv_vol_id = v.cv_id) as issue_count,
          CASE WHEN EXISTS (
            SELECT 1 FROM volume_themes vt WHERE vt.volume_id = v.id AND vt.theme_id = 44
          ) THEN 1 ELSE 0 END as has_collection_theme
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
  const volumeId = parseInt(req.params.id);
  const data = getAll(
    `SELECT t.* FROM themes t JOIN volume_themes vt ON t.id = vt.theme_id WHERE vt.volume_id = ?`,
    [volumeId]
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
    const { rawDb } = require('../db');
    const result = rawDb.prepare(
      'INSERT INTO volumes (cv_id, cv_slug, name, cv_img, lang, locg_id, locg_slug, publisher, start_year, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run([cv_id || null, cv_slug || null, name, cv_img || null, lang || null, locg_id || null, locg_slug || null, publisher || null, start_year || null, description || null]);

    if (lang) {
      rawRun(
        'INSERT OR IGNORE INTO volume_themes (volume_id, theme_id) VALUES (?, ?)',
        [newId, TRANSLATED_THEME_ID]
      );
    }
    res.json({ message: 'Том створено', id: newId });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/:id', (req, res) => {
  const { cv_id, cv_slug, name, cv_img, lang, locg_id, locg_slug, publisher, start_year, description, hikka_slug, mal_id, theme_ids } = req.body;
  try {
    runQuery(
      'UPDATE volumes SET cv_id = ?, cv_slug = ?, name = ?, cv_img = ?, lang = ?, locg_id = ?, locg_slug = ?, publisher = ?, start_year = ?, description = ?, hikka_slug = ?, mal_id = ? WHERE id = ?',
      [cv_id || null, cv_slug || null, name, cv_img || null, lang || null, locg_id || null, locg_slug || null, publisher || null, start_year || null, description || null, hikka_slug || null, mal_id || null, req.params.id]
    );
    if (Array.isArray(theme_ids)) {
      const volumeId = parseInt(req.params.id);
      rawRun('DELETE FROM volume_themes WHERE volume_id = ?', [volumeId]);
      theme_ids.forEach(themeId =>
        rawRun('INSERT OR IGNORE INTO volume_themes (volume_id, theme_id) VALUES (?, ?)', [volumeId, themeId])
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

// Визначаємо тип тому: манґа (ds_vol_id) чи комікс (cv_vol_id)
    const isMangaVol = !volume.cv_id && !!volume.hikka_slug;
    const collections = isMangaVol
      ? getAll(`
          SELECT DISTINCT c.*,
            pv.id   AS parent_vol_id,
            pv.name AS parent_vol_name,
            pv.lang AS parent_vol_lang
          FROM collections c
          JOIN collection_issues ci ON c.id = ci.collection_id
          JOIN issues i ON ci.issue_id = i.id
          LEFT JOIN volumes pv ON c.cv_vol_id = pv.cv_id
          WHERE i.ds_vol_id = ?
          ORDER BY pv.name ASC, CAST(c.issue_number AS REAL) ASC, c.name ASC
        `, [volume.id])
      : getAll(`
          SELECT DISTINCT c.*,
            pv.id   AS parent_vol_id,
            pv.name AS parent_vol_name,
            pv.lang AS parent_vol_lang
          FROM collections c
          JOIN collection_issues ci ON c.id = ci.collection_id
          JOIN issues i ON ci.issue_id = i.id
          LEFT JOIN volumes pv ON c.cv_vol_id = pv.cv_id
          WHERE i.cv_vol_id = ?
          ORDER BY pv.name ASC, CAST(c.issue_number AS REAL) ASC, c.name ASC
        `, [volume.cv_id]);

    // Для кожного збірника визначаємо номери розділів/випусків з цього тому
    const result = collections.map(col => {
      const issueNumbers = isMangaVol
        ? getAll(`
            SELECT i.issue_number
            FROM collection_issues ci
            JOIN issues i ON ci.issue_id = i.id
            WHERE ci.collection_id = ? AND i.ds_vol_id = ? AND i.issue_number IS NOT NULL
            ORDER BY CAST(i.issue_number AS REAL) ASC
          `, [col.id, volume.id]).map(r => r.issue_number)
        : getAll(`
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
    rawRun('INSERT OR IGNORE INTO volume_themes (volume_id, theme_id) VALUES (?, ?)', [volumeId, COLLECTION_THEME_ID]);

    // Якщо том належить до журналу — прибираємо тему Translated
    const hasMagazineParent = getOne('SELECT id FROM volume_magazines WHERE child_id = ?', [volumeId]);
    if (hasMagazineParent) {
      rawRun('DELETE FROM volume_themes WHERE volume_id = ? AND theme_id = ?', [volumeId, TRANSLATED_THEME_ID]);
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
    rawRun('DELETE FROM volume_themes WHERE volume_id = ? AND theme_id = ?', [volumeId, COLLECTION_THEME_ID]);

    saveDatabase();
    res.json({ message: `Конвертовано: ${converted}, пропущено: ${skipped}`, converted, skipped });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/:id/themes', (req, res) => {
  const { theme_ids } = req.body;
  if (!Array.isArray(theme_ids)) return res.status(400).json({ error: 'theme_ids має бути масивом' });
  try {
    const volumeId = parseInt(req.params.id);
    const vol = getOne('SELECT id FROM volumes WHERE id = ?', [volumeId]);
    if (!vol) return res.status(404).json({ error: 'Том не знайдено' });
    rawRun('DELETE FROM volume_themes WHERE volume_id = ?', [volumeId]);
    theme_ids.forEach(themeId =>
      rawRun('INSERT OR IGNORE INTO volume_themes (volume_id, theme_id) VALUES (?, ?)', [volumeId, themeId])
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
  rawRun(
    'INSERT OR IGNORE INTO volume_themes (volume_id, theme_id) VALUES (?, ?)',
    [volumeDbId, themeId]
  );
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

// POST /volumes/manga-volume — створити том манґи (без CV, з hikka_slug + mal_id)
// Автоматично прив'язується до збірника через collection_id (опційно)
router.post('/manga-volume', async (req, res) => {
  const { name, name_uk, hikka_slug, mal_id, publisher, start_year, description } = req.body;
  if (!hikka_slug) return res.status(400).json({ error: 'hikka_slug обов\'язковий' });

  try {
    const { rawDb } = require('../db');

    // Перевірка дублікату
    const existing = getOne(`
      SELECT v.id FROM volumes v
      WHERE v.hikka_slug = ?
        AND NOT EXISTS (
          SELECT 1 FROM volume_themes vt WHERE vt.volume_id = v.id AND vt.theme_id = ?
        )
    `, [hikka_slug, COLLECTION_THEME_ID]);
    if (existing) return res.status(400).json({ error: 'Том-джерело розділів з таким hikka_slug вже існує', id: existing.id });

    // ── Запит до Hikka API ────────────────────────────────────────────────
    let hikkaName        = name || null;
    let hikkaImg         = null;
    let hikkaStartYear   = start_year || null;
    let hikkaDescription = description || null;
    let hikkaMalId       = mal_id || null;
    let hikkaNameUk      = null;

    try {
      const hikkaRes = await fetch(`https://api.hikka.io/manga/${hikka_slug}`);
      if (hikkaRes.ok) {
        const hikkaData = await hikkaRes.json();

        if (!hikkaName) {
          hikkaName   = hikkaData.title_original || null;
        }
        hikkaNameUk   = hikkaData.title_ua || null;
        hikkaImg = hikkaData.image || null;

        // Рік початку
        if (!hikkaStartYear && hikkaData.start_date) {
          hikkaStartYear = new Date(hikkaData.start_date).getFullYear() || null;
        } else if (!hikkaStartYear && hikkaData.year) {
          hikkaStartYear = hikkaData.year;
        }

        // Опис
        if (!hikkaDescription && hikkaData.synopsis_ua) {
          hikkaDescription = hikkaData.synopsis_ua;
        } else if (!hikkaDescription && hikkaData.synopsis_en) {
          hikkaDescription = hikkaData.synopsis_en;
        }

        // MAL ID
        if (!hikkaMalId && hikkaData.mal_id) {
          hikkaMalId = hikkaData.mal_id;
        }
      }
    } catch (hikkaErr) {
      // Hikka недоступна — продовжуємо з тим що є
      console.warn('Hikka API недоступна:', hikkaErr.message);
    }

    if (!hikkaName) return res.status(400).json({ error: 'name обов\'язковий (Hikka також не повернула назву)' });

    // ── Вставка в БД ──────────────────────────────────────────────────────
    const result = rawDb.prepare(
      `INSERT INTO volumes (cv_id, cv_slug, name, name_uk, hikka_slug, mal_id, hikka_img, publisher, start_year, description, lang)
       VALUES (NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'ja')`
    ).run([hikkaName, hikkaNameUk || null, hikka_slug, hikkaMalId || null, hikkaImg || null, publisher || null, hikkaStartYear || null, hikkaDescription || null]);

    const newId = result.lastInsertRowid;

    // Додаємо тему Manga (36)
    rawRun(
      'INSERT OR IGNORE INTO volume_themes (volume_id, theme_id) VALUES (?, ?)',
      [newId, MANGA_THEME_ID]
    );

    res.json({
      message: 'Том манґи створено',
      id: newId,
      name: hikkaName,
      hikka_img: hikkaImg,
    });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// POST /volumes/:id/generate-chapters
// Генерує (або догенеровує) розділи манґи для тому.
// Якщо count передано явно — використовуємо його (онгоінг / ручний режим).
// Якщо не передано — запитуємо Hikka API і беремо chapters_released.
// Відповідь { needsManualCount: true } означає що Hikka не знає кількість → фронт питає юзера.
router.post('/:id/generate-chapters', async (req, res) => {
  const volumeId = parseInt(req.params.id);
  const { count: manualCount } = req.body;

  try {
    const volume = getOne('SELECT * FROM volumes WHERE id = ?', [volumeId]);
    if (!volume)           return res.status(404).json({ error: 'Том не знайдено' });
    if (!volume.hikka_slug) return res.status(400).json({ error: 'Том не має hikka_slug' });

    // ── Визначаємо кількість розділів ─────────────────────────────────────
    let totalChapters = manualCount ? parseInt(manualCount) : null;

    if (!totalChapters) {
      // Запит до Hikka API
      const hikkaRes = await fetch(`https://api.hikka.io/manga/${volume.hikka_slug}`);
      if (!hikkaRes.ok) return res.status(502).json({ error: `Hikka API: ${hikkaRes.status}` });
      const hikkaData = await hikkaRes.json();

      totalChapters = hikkaData.chapters || null;
      if (!totalChapters) {
        // Hikka не знає кількість → повертаємо сигнал фронту
        return res.json({ needsManualCount: true, manga_name: hikkaData.title_ua || hikkaData.title_en });
      }
    }

    if (totalChapters < 1 || totalChapters > 5000) {
      return res.status(400).json({ error: 'Некоректна кількість розділів' });
    }

    // ── Знаходимо вже існуючі номери розділів для цього тому ──────────────
    const existingNums = new Set(
      getAll('SELECT issue_number FROM issues WHERE ds_vol_id = ?', [volumeId])
        .map(r => parseInt(r.issue_number))
        .filter(n => !isNaN(n))
    );

    // ── Генеруємо тільки відсутні розділи ─────────────────────────────────
    const { rawDb } = require('../db');
    const insert = rawDb.prepare(
      `INSERT INTO issues (cv_id, cv_slug, name, ds_vol_id, issue_number) VALUES (NULL, NULL, ?, ?, ?)`
    );

    let created = 0;
    const insertMany = rawDb.transaction(() => {
      for (let ch = 1; ch <= totalChapters; ch++) {
        if (existingNums.has(ch)) continue;
        insert.run([`Розділ ${ch}`, volumeId, String(ch)]);
        created++;
      }
    });
    insertMany();

    res.json({
      message: `Готово. Створено: ${created}, вже існувало: ${existingNums.size}`,
      created,
      existed: existingNums.size,
      total: totalChapters,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /volumes/:id/chapters — розділи манґа-тому (issues з ds_vol_id)
router.get('/:id/chapters', (req, res) => {
  const volumeId = parseInt(req.params.id);
  const chapters = getAll(
    `SELECT i.id, i.issue_number, i.name, i.release_date, i.cv_img,
            (SELECT COUNT(*) FROM collection_issues ci WHERE ci.issue_id = i.id) as in_collections_count
     FROM issues i
     WHERE i.ds_vol_id = ?
     ORDER BY CAST(i.issue_number AS REAL) ASC`,
    [volumeId]
  );
  res.json({ data: chapters, total: chapters.length });
});

module.exports = router;