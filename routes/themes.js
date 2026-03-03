const { Router } = require('express');
const { getAll, runQuery, getOne } = require('../db');

const router = Router();

// GET /api/themes?search=...&type=genre|theme|type
router.get('/', (req, res) => {
  const { search, type } = req.query;
  let query = 'SELECT * FROM themes', params = [];
  const conditions = [];

  if (search) {
    conditions.push('(ua_name LIKE ? OR name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  // Підтримуємо всі три типи: theme, genre, type
  if (type && ['genre', 'theme', 'type'].includes(type)) {
    conditions.push('type = ?');
    params.push(type);
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  // Порядок: type → genre → theme
  query += ' ORDER BY CASE type WHEN \'type\' THEN 0 WHEN \'genre\' THEN 1 ELSE 2 END, name ASC';

  res.json({ data: getAll(query, params) });
});

module.exports = router;