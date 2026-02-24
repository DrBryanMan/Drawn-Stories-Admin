// routes/personnel.js
const { Router } = require('express');
const { runQuery, getAll, getOne } = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const { search, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM personnel', params = [], searchParams = [];
  if (search) {
    query += ' WHERE name LIKE ?';
    searchParams = [`%${search}%`];
    params = [...searchParams];
  }
  query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const data = getAll(query, params);
  let countQuery = 'SELECT COUNT(*) as count FROM personnel';
  if (search) countQuery += ' WHERE name LIKE ?';
  const total = getOne(countQuery, searchParams);
  res.json({ data, total: total?.count || 0 });
});

router.get('/:id', (req, res) => {
  const person = getOne('SELECT * FROM personnel WHERE id = ?', [req.params.id]);
  if (!person) return res.status(404).json({ error: 'Не знайдено' });
  res.json(person);
});

router.post('/', (req, res) => {
  const { name, bio, cv_img, cv_id, cv_slug } = req.body;
  if (!name) return res.status(400).json({ error: "Ім'я обов'язкове" });
  try {
    runQuery(
      'INSERT INTO personnel (name, bio, cv_img, cv_id, cv_slug) VALUES (?, ?, ?, ?, ?)',
      [name, bio || null, cv_img || null, cv_id || null, cv_slug || null]
    );
    res.json({ message: 'Персону створено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', (req, res) => {
  const { name, bio, cv_img, cv_id, cv_slug } = req.body;
  if (!name) return res.status(400).json({ error: "Ім'я обов'язкове" });
  try {
    runQuery(
      'UPDATE personnel SET name = ?, bio = ?, cv_img = ?, cv_id = ?, cv_slug = ? WHERE id = ?',
      [name, bio || null, cv_img || null, cv_id || null, cv_slug || null, req.params.id]
    );
    res.json({ message: 'Персону оновлено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    runQuery('DELETE FROM personnel WHERE id = ?', [req.params.id]);
    res.json({ message: 'Персону видалено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;