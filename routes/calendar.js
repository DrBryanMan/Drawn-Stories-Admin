const { Router } = require('express');
const { getAll, getOne } = require('../db');

const router = Router();

const MANGA_THEME     = 36;
const MAGAZINE_THEME  = 35;
const COLLECTION_THEME = 44;

function getWeekBounds(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - day);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
  };
}

function buildDayMap(start, end) {
  const map = {};
  const cur  = new Date(start + 'T00:00:00Z');
  const last = new Date(end   + 'T00:00:00Z');
  while (cur <= last) {
    map[cur.toISOString().slice(0, 10)] = [];
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return map;
}

router.get('/', (req, res) => {
  try {
    const {
      date,
      type          = 'all',
      collections   = '1',
      manga_mode    = 'chapters',
    } = req.query;

    const today = new Date().toISOString().slice(0, 10);
    const { start, end } = getWeekBounds(date || today);
    const withCollections = collections !== '0';
    const days = buildDayMap(start, end);

    const push = (items, typeLabel) => {
      items.forEach(item => {
        if (days[item.release_date]) {
          days[item.release_date].push({ ...item, _type: typeLabel });
        }
      });
    };

    // ── Comics issues ─────────────────────────────────────────────────────
    if (type === 'all' || type === 'comics') {
      push(getAll(`
        SELECT i.id, i.name, i.cv_img, i.issue_number, i.release_date,
               v.name as volume_name, v.id as volume_db_id
        FROM issues i
        JOIN volumes v ON i.cv_vol_id = v.cv_id
        WHERE i.release_date BETWEEN ? AND ?
          AND i.ds_vol_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM volume_themes vt
            WHERE vt.volume_id = v.id AND vt.theme_id IN (?, ?)
          )
        ORDER BY i.release_date, v.name, CAST(i.issue_number AS REAL)
      `, [start, end, MANGA_THEME, MAGAZINE_THEME]), 'comic_issue');

      if (withCollections) {
        push(getAll(`
          SELECT c.id, c.name, c.cv_img, c.issue_number, c.release_date,
                 v.name as volume_name, v.id as volume_db_id
          FROM collections c
          LEFT JOIN volumes v ON c.cv_vol_id = v.cv_id
          WHERE c.release_date BETWEEN ? AND ?
            AND (v.id IS NULL OR NOT EXISTS (
              SELECT 1 FROM volume_themes vt WHERE vt.volume_id = v.id AND vt.theme_id = ?
            ))
          ORDER BY c.release_date, v.name, CAST(c.issue_number AS REAL)
        `, [start, end, MANGA_THEME]), 'comic_collection');
      }
    }

    // ── Manga ─────────────────────────────────────────────────────────────
    if (type === 'all' || type === 'manga') {

      if (manga_mode === 'chapters') {
        push(getAll(`
          SELECT i.id, i.name, i.cv_img, i.issue_number, i.release_date,
                 v.name as volume_name, v.id as volume_db_id,
                 v.hikka_slug, v.hikka_img
          FROM issues i
          JOIN volumes v ON i.ds_vol_id = v.id
          WHERE i.release_date BETWEEN ? AND ?
          ORDER BY i.release_date, v.name, CAST(i.issue_number AS REAL)
        `, [start, end]), 'manga_chapter');

      } else {
        // manga_mode === 'magazines'
        const rows = getAll(`
          SELECT
            mi.id           AS id,
            mi.issue_number AS issue_number,
            mi.name         AS name,
            mi.release_date,
            mi.cv_img,
            mv.name         AS magazine_name,
            mv.id           AS magazine_vol_id,
            i.id            AS ch_id,
            i.issue_number  AS ch_number,
            i.name          AS ch_name,
            i.cv_img        AS ch_cv_img,
            v.name          AS vol_name,
            v.id            AS vol_id,
            v.hikka_slug,
            mc.sort_order,
            mc.page_type
          FROM issues mi
          JOIN volumes mv ON mi.cv_vol_id = mv.cv_id
          JOIN volume_themes vt ON vt.volume_id = mv.id AND vt.theme_id = ?
          JOIN magazine_chapters mc ON mc.mag_issue_id = mi.id
          JOIN issues  i ON i.id  = mc.issue_id
          JOIN volumes v ON v.id  = i.ds_vol_id
          WHERE mi.release_date BETWEEN ? AND ?
          ORDER BY mi.release_date, mv.name,
                   CAST(mi.issue_number AS REAL),
                   mc.sort_order, v.name, CAST(i.issue_number AS REAL)
        `, [MAGAZINE_THEME, start, end]);

        const magMap = new Map();
        rows.forEach(row => {
          if (!magMap.has(row.id)) {
            magMap.set(row.id, {
              id: row.id, issue_number: row.issue_number,
              name: row.name, release_date: row.release_date,
              cv_img: row.cv_img, magazine_name: row.magazine_name,
              magazine_vol_id: row.magazine_vol_id,
              chapters: [], _type: 'manga_magazine',
            });
          }
          magMap.get(row.id).chapters.push({
            id: row.ch_id, issue_number: row.ch_number,
            name: row.ch_name, cv_img: row.ch_cv_img,
            vol_name: row.vol_name, vol_id: row.vol_id,
            hikka_slug: row.hikka_slug, page_type: row.page_type,
          });
        });
        magMap.forEach(mag => {
          if (days[mag.release_date]) days[mag.release_date].push(mag);
        });
      }

      if (withCollections) {
        push(getAll(`
          SELECT c.id, c.name, c.cv_img, c.issue_number, c.release_date,
                 v.name as volume_name, v.id as volume_db_id
          FROM collections c
          JOIN volumes v ON c.cv_vol_id = v.cv_id
          JOIN volume_themes vt ON vt.volume_id = v.id AND vt.theme_id = ?
          WHERE c.release_date BETWEEN ? AND ?
          ORDER BY c.release_date, v.name, CAST(c.issue_number AS REAL)
        `, [MANGA_THEME, start, end]), 'manga_collection');
      }
    }

    // ── Sort days ─────────────────────────────────────────────────────────
    const pri = { manga_magazine:0, manga_chapter:1, manga_collection:2, comic_issue:3, comic_collection:4 };
    Object.keys(days).forEach(d => {
      days[d].sort((a, b) => {
        const p = (pri[a._type] ?? 9) - (pri[b._type] ?? 9);
        if (p !== 0) return p;
        return (a.volume_name || a.magazine_name || a.name || '').localeCompare(b.volume_name || b.magazine_name || b.name || '');
      });
    });

    const total = Object.values(days).reduce((s, a) => s + a.length, 0);

    const nextRow = getOne(`
      SELECT MIN(d) as d FROM (
        SELECT release_date as d FROM issues      WHERE release_date > ? AND release_date != ''
        UNION ALL
        SELECT release_date as d FROM collections WHERE release_date > ? AND release_date != ''
      )
    `, [end, end]);

    const prevRow = getOne(`
      SELECT MAX(d) as d FROM (
        SELECT release_date as d FROM issues      WHERE release_date < ? AND release_date != ''
        UNION ALL
        SELECT release_date as d FROM collections WHERE release_date < ? AND release_date != ''
      )
    `, [start, start]);

    res.json({
      week_start: start, week_end: end, days, total,
      next_content_date: nextRow?.d || null,
      prev_content_date: prevRow?.d || null,
    });
  } catch (err) {
    console.error('calendar error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;