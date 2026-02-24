// routes/stats.js
const { Router } = require('express');
const { getOne } = require('../db');

const router = Router();

function safeCount(table) {
  try { return getOne(`SELECT COUNT(*) as count FROM ${table}`, [])?.count || 0; }
  catch(e) { return 0; }
}

const MANGA_THEME_ID = 36;

router.get('/', (req, res) => {
  const manga = (() => {
    try {
      const { getAll } = require('../db');
      return getAll(`
        SELECT COUNT(DISTINCT i.id) as count
        FROM issues i
        JOIN volumes v ON i.cv_vol_id = v.cv_id
        JOIN volume_themes vt ON v.cv_id = vt.cv_vol_id
        WHERE vt.theme_id = ?
      `, [MANGA_THEME_ID])[0]?.count || 0;
    } catch(e) { return 0; }
  })();

  res.json({
    volumes:      safeCount('volumes'),
    issues:       safeCount('issues'),
    characters:   safeCount('characters'),
    collections:  safeCount('collections'),
    series:       safeCount('series'),
    manga,
    readingOrders: safeCount('reading_orders'),
    personnel:    safeCount('personnel'),
    events:       safeCount('events'),
  });
});

module.exports = router;