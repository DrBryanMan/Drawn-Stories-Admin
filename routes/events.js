// routes/events.js
const { Router } = require('express');
const { runQuery, getAll, getOne, rawRun, saveDatabase } = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const { search, limit = 50, offset = 0 } = req.query;
  let query = `
    SELECT e.*,
      (SELECT COUNT(*) FROM event_items WHERE event_id = e.id AND item_type = 'issue') as issue_count,
      (SELECT COUNT(*) FROM event_items WHERE event_id = e.id AND item_type = 'collection') as collection_count
    FROM events e
  `;
  let params = [], searchParams = [];
  if (search) {
    query += ' WHERE e.name LIKE ?';
    searchParams = [`%${search}%`];
    params = [...searchParams];
  }
  query += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const data = getAll(query, params);
  let countQuery = 'SELECT COUNT(*) as count FROM events';
  if (search) countQuery += ' WHERE name LIKE ?';
  const total = getOne(countQuery, searchParams);
  res.json({ data, total: total?.count || 0 });
});

router.get('/:id/issues', (req, res) => {
  const items = getAll(`
    SELECT ei.id as link_id, ei.order_num, ei.importance,
           i.id, i.cv_id, i.cv_slug, i.name, i.cv_img, i.issue_number, i.cover_date, i.release_date,
           v.name as volume_name, v.cv_id as volume_cv_id, v.cv_slug as volume_cv_slug
    FROM event_items ei
    JOIN issues i ON ei.item_id = i.id
    LEFT JOIN volumes v ON i.cv_vol_id = v.cv_id
    WHERE ei.event_id = ? AND ei.item_type = 'issue'
    ORDER BY ei.order_num ASC, ei.id ASC
  `, [req.params.id]);
  res.json({ data: items });
});

router.get('/:id/collections', (req, res) => {
  const items = getAll(`
    SELECT ei.id as link_id, ei.order_num, ei.importance,
           c.id, c.name, c.cv_img, c.description
    FROM event_items ei
    JOIN collections c ON ei.item_id = c.id
    WHERE ei.event_id = ? AND ei.item_type = 'collection'
    ORDER BY ei.order_num ASC, ei.id ASC
  `, [req.params.id]);
  res.json({ data: items });
});

router.get('/:id', (req, res) => {
  const event = getOne('SELECT * FROM events WHERE id = ?', [req.params.id]);
  if (!event) return res.status(404).json({ error: 'Подію не знайдено' });
  res.json(event);
});

router.post('/', (req, res) => {
  const { name, description, cv_img, start_year, end_year } = req.body;
  if (!name) return res.status(400).json({ error: "Назва обов'язкова" });
  try {
    runQuery(
      'INSERT INTO events (name, description, cv_img, start_year, end_year) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, cv_img || null, start_year || null, end_year || null]
    );
    res.json({ message: 'Подію створено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', (req, res) => {
  const { name, description, cv_img, start_year, end_year } = req.body;
  if (!name) return res.status(400).json({ error: "Назва обов'язкова" });
  try {
    runQuery(
      'UPDATE events SET name = ?, description = ?, cv_img = ?, start_year = ?, end_year = ? WHERE id = ?',
      [name, description || null, cv_img || null, start_year || null, end_year || null, req.params.id]
    );
    res.json({ message: 'Подію оновлено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    rawRun('DELETE FROM event_items WHERE event_id = ?', [req.params.id]);
    runQuery('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({ message: 'Подію видалено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Додати випуск до події
router.post('/:id/issues', (req, res) => {
  const { issue_id, importance = 'main' } = req.body;
  if (!issue_id) return res.status(400).json({ error: "issue_id обов'язковий" });
  try {
    const maxOrder = getOne(
      "SELECT COALESCE(MAX(order_num), 0) as m FROM event_items WHERE event_id = ? AND item_type = 'issue'",
      [req.params.id]
    );
    runQuery(
      "INSERT INTO event_items (event_id, item_id, item_type, order_num, importance) VALUES (?, ?, 'issue', ?, ?)",
      [req.params.id, issue_id, (maxOrder?.m || 0) + 1, importance]
    );
    res.json({ message: 'Випуск додано до події' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Додати збірник до події
router.post('/:id/collections', (req, res) => {
  const { collection_id, importance = 'main' } = req.body;
  if (!collection_id) return res.status(400).json({ error: "collection_id обов'язковий" });
  try {
    const maxOrder = getOne(
      "SELECT COALESCE(MAX(order_num), 0) as m FROM event_items WHERE event_id = ? AND item_type = 'collection'",
      [req.params.id]
    );
    runQuery(
      "INSERT INTO event_items (event_id, item_id, item_type, order_num, importance) VALUES (?, ?, 'collection', ?, ?)",
      [req.params.id, collection_id, (maxOrder?.m || 0) + 1, importance]
    );
    res.json({ message: 'Збірник додано до події' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Оновити importance (і опційно order_num) елемента
router.patch('/:eventId/items/:linkId', (req, res) => {
  const { importance, order_num } = req.body;
  try {
    if (importance !== undefined) {
      runQuery(
        'UPDATE event_items SET importance = ? WHERE id = ? AND event_id = ?',
        [importance, req.params.linkId, req.params.eventId]
      );
    }
    if (order_num !== undefined) {
      runQuery(
        'UPDATE event_items SET order_num = ? WHERE id = ? AND event_id = ?',
        [parseInt(order_num), req.params.linkId, req.params.eventId]
      );
    }
    res.json({ message: 'Оновлено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Видалити елемент з події
router.delete('/:eventId/items/:linkId', (req, res) => {
  try {
    runQuery(
      'DELETE FROM event_items WHERE id = ? AND event_id = ?',
      [req.params.linkId, req.params.eventId]
    );
    res.json({ message: 'Видалено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Перемістити елемент (up/down) — залишаємо для сумісності
router.put('/:eventId/items/:linkId/move', (req, res) => {
  const { direction } = req.body;
  try {
    const item = getOne('SELECT * FROM event_items WHERE id = ? AND event_id = ?',
      [req.params.linkId, req.params.eventId]);
    if (!item) return res.status(404).json({ error: 'Не знайдено' });

    const neighbor = direction === 'up'
      ? getOne('SELECT * FROM event_items WHERE event_id = ? AND item_type = ? AND order_num < ? ORDER BY order_num DESC LIMIT 1',
          [req.params.eventId, item.item_type, item.order_num])
      : getOne('SELECT * FROM event_items WHERE event_id = ? AND item_type = ? AND order_num > ? ORDER BY order_num ASC LIMIT 1',
          [req.params.eventId, item.item_type, item.order_num]);

    if (!neighbor) return res.json({ message: 'Вже на краю' });

    rawRun('UPDATE event_items SET order_num = ? WHERE id = ?', [neighbor.order_num, item.id]);
    rawRun('UPDATE event_items SET order_num = ? WHERE id = ?', [item.order_num, neighbor.id]);
    saveDatabase();
    res.json({ message: 'Порядок оновлено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Перемістити елемент на конкретну позицію (1-based)
router.put('/:eventId/items/:linkId/reorder', (req, res) => {
  const { position } = req.body; // 1-based
  if (!position || isNaN(parseInt(position))) return res.status(400).json({ error: 'position обов\'язковий' });
  try {
    const item = getOne('SELECT * FROM event_items WHERE id = ? AND event_id = ?',
      [req.params.linkId, req.params.eventId]);
    if (!item) return res.status(404).json({ error: 'Не знайдено' });

    // Отримуємо всі елементи того ж типу, впорядковані
    const allItems = getAll(
      'SELECT id FROM event_items WHERE event_id = ? AND item_type = ? ORDER BY order_num ASC, id ASC',
      [req.params.eventId, item.item_type]
    );

    // Видаляємо поточний елемент з масиву
    const filtered = allItems.filter(i => i.id !== item.id);
    // Вставляємо на потрібну позицію (0-based)
    const targetIdx = Math.max(0, Math.min(parseInt(position) - 1, filtered.length));
    filtered.splice(targetIdx, 0, { id: item.id });

    // Оновлюємо order_num для всіх
    filtered.forEach((i, idx) => {
      rawRun('UPDATE event_items SET order_num = ? WHERE id = ?', [idx + 1, i.id]);
    });
    saveDatabase();
    res.json({ message: 'Порядок оновлено' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;