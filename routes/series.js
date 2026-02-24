// routes/series.js
const { Router } = require('express');
const { runQuery, getAll, getOne } = require('../db');

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
           COUNT(i.id) as issue_count,
           MIN(CASE WHEN i.cover_date != '' AND i.cover_date IS NOT NULL THEN SUBSTR(i.cover_date, 1, 4) ELSE NULL END) as start_year
    FROM volumes v
    JOIN series_volumes sv ON v.id = sv.volume_id
    LEFT JOIN issues i ON i.cv_vol_id = v.cv_id
    WHERE sv.series_id = ?
    GROUP BY v.id
    ORDER BY v.name ASC
  `, [req.params.id]);

  const collections = (() => {
    try {
      return getAll(`
        SELECT c.*, v.name as volume_name
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

router.post('/:id/volumes', (req, res) => {
  const { volume_id } = req.body;
  try {
    const exists = getOne('SELECT id FROM series_volumes WHERE series_id = ? AND volume_id = ?', [req.params.id, volume_id]);
    if (exists) return res.status(400).json({ error: 'Том вже є у серії' });
    runQuery('INSERT INTO series_volumes (series_id, volume_id) VALUES (?, ?)', [req.params.id, volume_id]);
    res.json({ message: 'Том додано до серії' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/:id/volumes/:volume_id', (req, res) => {
  try {
    runQuery('DELETE FROM series_volumes WHERE series_id = ? AND volume_id = ?', [req.params.id, req.params.volume_id]);
    res.json({ message: 'Том видалено із серії' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/:id/collections', (req, res) => {
  const { collection_id } = req.body;
  try {
    const exists = getOne('SELECT id FROM series_collections WHERE series_id = ? AND collection_id = ?', [req.params.id, collection_id]);
    if (exists) return res.status(400).json({ error: 'Збірник вже є у серії' });
    runQuery('INSERT INTO series_collections (series_id, collection_id) VALUES (?, ?)', [req.params.id, collection_id]);
    res.json({ message: 'Збірник додано до серії' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/:id/collections/:collection_id', (req, res) => {
  try {
    runQuery('DELETE FROM series_collections WHERE series_id = ? AND collection_id = ?', [req.params.id, req.params.collection_id]);
    res.json({ message: 'Збірник видалено із серії' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

module.exports = router;