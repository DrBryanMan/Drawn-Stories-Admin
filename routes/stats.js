// routes/stats.js
const { Router } = require('express');
const { getOne, getAll } = require('../db');

const router = Router();

function safeCount(table) {
  try { return getOne(`SELECT COUNT(*) as count FROM ${table}`, [])?.count || 0; }
  catch(e) { return 0; }
}

const MANGA_THEME_ID     = 36;
const COLLECTED_THEME_ID = 44;

function countVolumesByTheme(themeId) {
  try {
    return getAll(`
      SELECT COUNT(DISTINCT v.id) as count
      FROM volumes v
      JOIN volume_themes vt ON v.cv_id = vt.cv_vol_id
      WHERE vt.theme_id = ?
    `, [themeId])[0]?.count || 0;
  } catch(e) { return 0; }
}

function countVolumesComics() {
  try {
    return getAll(`
      SELECT COUNT(*) as count FROM volumes v
      WHERE NOT EXISTS (
        SELECT 1 FROM volume_themes vt
        WHERE vt.cv_vol_id = v.cv_id AND vt.theme_id IN (?, ?)
      )
    `, [MANGA_THEME_ID, COLLECTED_THEME_ID])[0]?.count || 0;
  } catch(e) { return 0; }
}

function countIssuesByVolumeTheme(themeId) {
  try {
    return getAll(`
      SELECT COUNT(DISTINCT i.id) as count
      FROM issues i
      JOIN volumes v ON i.cv_vol_id = v.cv_id
      JOIN volume_themes vt ON v.cv_id = vt.cv_vol_id
      WHERE vt.theme_id = ?
    `, [themeId])[0]?.count || 0;
  } catch(e) { return 0; }
}

function countIssuesComics() {
  try {
    return getAll(`
      SELECT COUNT(*) as count FROM issues i
      JOIN volumes v ON i.cv_vol_id = v.cv_id
      WHERE NOT EXISTS (
        SELECT 1 FROM volume_themes vt
        WHERE vt.cv_vol_id = v.cv_id AND vt.theme_id IN (?, ?)
      )
    `, [MANGA_THEME_ID, COLLECTED_THEME_ID])[0]?.count || 0;
  } catch(e) { return 0; }
}

function countChapters() {
  try {
    return getOne(
      `SELECT COUNT(*) as count FROM issues WHERE ds_vol_id IS NOT NULL`,
      []
    )?.count || 0;
  } catch(e) { return 0; }
}

router.get('/', (req, res) => {
  res.json({
    volumes:          safeCount('volumes'),
    volumesComics:    countVolumesComics(),
    volumesManga:     countVolumesByTheme(MANGA_THEME_ID),
    volumesCollected: countVolumesByTheme(COLLECTED_THEME_ID),

    issues:           safeCount('issues'),
    issuesComics:     countIssuesComics(),
    issuesManga:      countIssuesByVolumeTheme(MANGA_THEME_ID),
    issuesCollected:  countIssuesByVolumeTheme(COLLECTED_THEME_ID),
    chapters:         countChapters(),

    characters:    safeCount('characters'),
    collections:   safeCount('collections'),
    series:        safeCount('series'),
    readingOrders: safeCount('reading_orders'),
    personnel:     safeCount('personnel'),
    events:        safeCount('events'),
  });
});

module.exports = router;