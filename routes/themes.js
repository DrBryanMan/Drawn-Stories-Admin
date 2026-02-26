// routes/themes.js
const { Router } = require('express');
const { getAll, runQuery, getOne } = require('../db');

const router = Router();

// GET /api/themes?search=...&type=genre|theme
router.get('/', (req, res) => {
  const { search, type } = req.query;
  let query = 'SELECT * FROM themes', params = [];
  const conditions = [];

  if (search) {
    conditions.push('name LIKE ?');
    params.push(`%${search}%`);
  }
  if (type && ['genre', 'theme'].includes(type)) {
    conditions.push('type = ?');
    params.push(type);
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY type ASC, name ASC'; // жанри першими

  res.json({ data: getAll(query, params) });
});

module.exports = router;