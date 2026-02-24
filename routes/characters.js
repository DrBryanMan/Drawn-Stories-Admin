// routes/characters.js
const { Router } = require('express');
const { runQuery, getAll, getOne } = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const { search, exact, limit = 50, offset = 0 } = req.query;
  const isExact = exact === 'true';
  let query = 'SELECT * FROM characters', params = [], searchParams = [];
  if (search) {
    query += isExact
      ? ' WHERE LOWER(name) = LOWER(?)'
      : ' WHERE name LIKE ? OR real_name LIKE ? OR cv_slug LIKE ?';
    searchParams = isExact ? [search] : [`%${search}%`, `%${search}%`, `%${search}%`];
    params = [...searchParams];
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const characters = getAll(query, params);
  let countQuery = 'SELECT COUNT(*) as count FROM characters';
  if (search) countQuery += isExact ? ' WHERE LOWER(name) = LOWER(?)' : ' WHERE name LIKE ? OR real_name LIKE ? OR cv_slug LIKE ?';
  const total = getOne(countQuery, searchParams);
  res.json({ data: characters, total: total?.count || 0 });
});

router.get('/:id', (req, res) => {
  const c = getOne('SELECT * FROM characters WHERE id = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Персонажа не знайдено' });
  res.json(c);
});

router.post('/', (req, res) => {
  const { cv_id, cv_slug, name, real_name, cv_img, description } = req.body;
  try {
    runQuery(
      'INSERT INTO characters (cv_id, cv_slug, name, real_name, cv_img, description) VALUES (?, ?, ?, ?, ?, ?)',
      [cv_id, cv_slug, name, real_name, cv_img, description]
    );
    res.json({ message: 'Персонажа створено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/:id', (req, res) => {
  const { cv_id, cv_slug, name, real_name, cv_img, description } = req.body;
  try {
    runQuery(
      'UPDATE characters SET cv_id = ?, cv_slug = ?, name = ?, real_name = ?, cv_img = ?, description = ? WHERE id = ?',
      [cv_id, cv_slug, name, real_name, cv_img, description, req.params.id]
    );
    res.json({ message: 'Персонажа оновлено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    runQuery('DELETE FROM characters WHERE id = ?', [req.params.id]);
    res.json({ message: 'Персонажа видалено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

module.exports = router;