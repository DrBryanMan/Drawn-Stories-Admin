// routes/series.js
const { Router } = require('express');
const { runQuery, getAll, getOne, rawRun, saveDatabase } = require('../db');

const COLLECTION_THEME_ID = 44;

const router = Router();

router.get('/', (req, res) => {
  const { search, exact, limit = 50, offset = 0 } = req.query;
  const isExact = exact === 'true';
  let query = 'SELECT * FROM series', params = [], searchParams = [];
  if (search) {
    query += isExact ? ' WHERE LOWER(name) = LOWER(?)' : ' WHERE name LIKE ?';
    searchParams = [isExact ? search : `%${search}%`];
    params = [...searchParams];
  }
  query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const seriesList = getAll(query, params);
  let countQuery = 'SELECT COUNT(*) as count FROM series';
  if (search) countQuery += isExact ? ' WHERE LOWER(name) = LOWER(?)' : ' WHERE name LIKE ?';
  const total = getOne(countQuery, searchParams);
  res.json({ data: seriesList, total: total?.count || 0 });
});

router.get('/:id', (req, res) => {
  const series = getOne('SELECT * FROM series WHERE id = ?', [req.params.id]);
  if (!series) return res.status(404).json({ error: 'Серію не знайдено' });

  const volumes = getAll(`
    SELECT v.*,
          COUNT(DISTINCT i.id) as issue_count,
          COUNT(DISTINCT col.id) as collection_count,       -- ← НОВЕ
          MIN(CASE WHEN i.cover_date != '' AND i.cover_date IS NOT NULL 
              THEN SUBSTR(i.cover_date, 1, 4) ELSE NULL END) as start_year,
          CASE WHEN vt44.cv_vol_id IS NOT NULL THEN 1 ELSE 0 END as has_collection_theme
    FROM volumes v
    JOIN series_volumes sv ON v.id = sv.volume_id
    LEFT JOIN issues i ON i.cv_vol_id = v.cv_id
    LEFT JOIN collections col ON col.cv_vol_id = v.cv_id    -- ← НОВЕ
    LEFT JOIN (
      SELECT cv_vol_id FROM volume_themes WHERE theme_id = ?
    ) vt44 ON v.cv_id = vt44.cv_vol_id
    WHERE sv.series_id = ?
    GROUP BY v.id
    ORDER BY v.name ASC
  `, [COLLECTION_THEME_ID, req.params.id]);

  const collections = (() => {
    try {
      return getAll(`
        SELECT c.*,
              v.name as volume_name,
              (SELECT COUNT(*) FROM collection_issues ci WHERE ci.collection_id = c.id) as issue_count  -- ← НОВЕ
        FROM collections c
        JOIN series_collections sc ON c.id = sc.collection_id
        LEFT JOIN volumes v ON c.cv_vol_id = v.cv_id
        WHERE sc.series_id = ?
        ORDER BY c.name ASC
      `, [req.params.id]);
    } catch(e) { return []; }
  })();

  res.json({ ...series, volumes, collections });
});

router.post('/', (req, res) => {
  const { name, description, cv_img } = req.body;
  if (!name) return res.status(400).json({ error: "Назва обов'язкова" });
  try {
    runQuery('INSERT INTO series (name, description, cv_img) VALUES (?, ?, ?)', [name, description || null, cv_img || null]);
    res.json({ message: 'Серію створено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/:id', (req, res) => {
  const { name, description, cv_img } = req.body;
  if (!name) return res.status(400).json({ error: "Назва обов'язкова" });
  try {
    runQuery('UPDATE series SET name = ?, description = ?, cv_img = ? WHERE id = ?', [name, description || null, cv_img || null, req.params.id]);
    res.json({ message: 'Серію оновлено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    runQuery('DELETE FROM series_volumes WHERE series_id = ?', [req.params.id]);
    runQuery('DELETE FROM series WHERE id = ?', [req.params.id]);
    res.json({ message: 'Серію видалено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ── Томи серії ──────────────────────────────────────────────────────────

router.post('/:id/volumes', (req, res) => {
  const { volume_id } = req.body;
  if (!volume_id) return res.status(400).json({ error: 'volume_id обов\'язковий' });
  try {
    const seriesId = parseInt(req.params.id);

    const existing = getOne('SELECT id FROM series_volumes WHERE series_id = ? AND volume_id = ?', [seriesId, volume_id]);
    if (existing) return res.status(400).json({ error: 'Цей том вже в серії' });
    rawRun('INSERT INTO series_volumes (series_id, volume_id) VALUES (?, ?)', [seriesId, volume_id]);

    // Автоматично додаємо всі збірники цього тому
    const volume = getOne('SELECT cv_id FROM volumes WHERE id = ?', [volume_id]);
    let addedCollections = 0;
    if (volume?.cv_id) {
      const collections = getAll('SELECT id FROM collections WHERE cv_vol_id = ?', [volume.cv_id]);
      for (const col of collections) {
        const colExists = getOne('SELECT id FROM series_collections WHERE series_id = ? AND collection_id = ?', [seriesId, col.id]);
        if (!colExists) {
          rawRun('INSERT INTO series_collections (series_id, collection_id) VALUES (?, ?)', [seriesId, col.id]);
          addedCollections++;
        }
      }
    }

    saveDatabase();
    res.json({ message: 'Том додано до серії', auto_added_collections: addedCollections });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/:id/volumes/:volumeId', (req, res) => {
  try {
    runQuery('DELETE FROM series_volumes WHERE series_id = ? AND volume_id = ?', [req.params.id, req.params.volumeId]);
    res.json({ message: 'Том видалено з серії' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// ── Збірники серії ──────────────────────────────────────────────────────

router.post('/:id/collections', (req, res) => {
  const { collection_id } = req.body;
  if (!collection_id) return res.status(400).json({ error: 'collection_id обов\'язковий' });
  try {
    const seriesId = parseInt(req.params.id);

    const existing = getOne('SELECT id FROM series_collections WHERE series_id = ? AND collection_id = ?', [seriesId, collection_id]);
    if (existing) return res.status(400).json({ error: 'Цей збірник вже в серії' });
    rawRun('INSERT INTO series_collections (series_id, collection_id) VALUES (?, ?)', [seriesId, collection_id]);

    // Автоматично додаємо том цього збірника
    let addedVolume = false;
    const collection = getOne('SELECT cv_vol_id FROM collections WHERE id = ?', [collection_id]);
    if (collection?.cv_vol_id) {
      const volume = getOne('SELECT id FROM volumes WHERE cv_id = ?', [collection.cv_vol_id]);
      if (volume) {
        const volExists = getOne('SELECT id FROM series_volumes WHERE series_id = ? AND volume_id = ?', [seriesId, volume.id]);
        if (!volExists) {
          rawRun('INSERT INTO series_volumes (series_id, volume_id) VALUES (?, ?)', [seriesId, volume.id]);
          addedVolume = true;
        }
      }
    }

    saveDatabase();
    res.json({ message: 'Збірник додано до серії', auto_added_volume: addedVolume });
  } catch (error) { res.status(400).json({ error: error.message }); }
});


router.delete('/:id/collections/:collectionId', (req, res) => {
  try {
    runQuery('DELETE FROM series_collections WHERE series_id = ? AND collection_id = ?', [req.params.id, req.params.collectionId]);
    res.json({ message: 'Збірник видалено з серії' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

module.exports = router;