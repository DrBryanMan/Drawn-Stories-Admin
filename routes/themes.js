// routes/themes.js
const { Router } = require('express');
const { getAll } = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM themes', params = [];
  if (search) { query += ' WHERE name LIKE ?'; params.push(`%${search}%`); }
  query += ' ORDER BY name ASC';
  res.json({ data: getAll(query, params) });
});

module.exports = router;