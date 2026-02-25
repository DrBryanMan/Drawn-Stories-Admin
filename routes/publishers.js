// routes/publishers.js
const { Router } = require('express');
const { getAll, getOne } = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const { search, limit = 30, offset = 0 } = req.query;
  let query = 'SELECT id, cv_id, name, cv_slug FROM publishers';
  let params = [], searchParams = [];
  if (search) {
    query += ' WHERE name LIKE ?';
    searchParams = [`%${search}%`];
    params = [...searchParams];
  }
  query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const data = getAll(query, params);
  let countQuery = 'SELECT COUNT(*) as count FROM publishers';
  if (search) countQuery += ' WHERE name LIKE ?';
  const total = getOne(countQuery, searchParams);
  res.json({ data, total: total?.count || 0 });
});

router.get('/:id', (req, res) => {
  const pub = getOne('SELECT id, cv_id, name, cv_slug FROM publishers WHERE id = ?', [req.params.id]);
  if (!pub) return res.status(404).json({ error: 'Видавництво не знайдено' });
  res.json(pub);
});

module.exports = router;