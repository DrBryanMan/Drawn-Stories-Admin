// routes/readingOrders.js
const { Router } = require('express');
const { runQuery, getAll, getOne, rawRun, saveDatabase } = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const { search, limit = 50, offset = 0 } = req.query;
  let query = `SELECT ro.*, COUNT(roi.id) as issue_count
               FROM reading_orders ro
               LEFT JOIN reading_order_issues roi ON ro.id = roi.reading_order_id`;
  let params = [], searchParams = [];
  if (search) {
    query += ' WHERE ro.name LIKE ?';
    searchParams = [`%${search}%`];
    params = [...searchParams];
  }
  query += ' GROUP BY ro.id ORDER BY ro.name DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const orders = getAll(query, params);
  let countQuery = 'SELECT COUNT(*) as count FROM reading_orders';
  if (search) countQuery += ' WHERE name LIKE ?';
  const total = getOne(countQuery, searchParams);
  res.json({ data: orders, total: total?.count || 0 });
});

router.get('/:id', (req, res) => {
  const order = getOne('SELECT * FROM reading_orders WHERE id = ?', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Порядок читання не знайдено' });
  const issues = getAll(`
    SELECT i.*, v.name as volume_name, roi.order_num
    FROM issues i
    JOIN reading_order_issues roi ON i.id = roi.issue_id
    LEFT JOIN volumes v ON i.cv_vol_id = v.cv_id
    WHERE roi.reading_order_id = ?
    ORDER BY roi.order_num DESC
  `, [req.params.id]);
  res.json({ ...order, issues });
});

router.post('/', (req, res) => {
  const { name, description, cv_img } = req.body;
  if (!name) return res.status(400).json({ error: "Назва обов'язкова" });
  try {
    runQuery('INSERT INTO reading_orders (name, description, cv_img) VALUES (?, ?, ?)', [name, description || null, cv_img || null]);
    res.json({ message: 'Порядок читання створено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/:id', (req, res) => {
  const { name, description, cv_img } = req.body;
  if (!name) return res.status(400).json({ error: "Назва обов'язкова" });
  try {
    runQuery('UPDATE reading_orders SET name = ?, description = ?, cv_img = ? WHERE id = ?', [name, description || null, cv_img || null, req.params.id]);
    res.json({ message: 'Оновлено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    runQuery('DELETE FROM reading_order_issues WHERE reading_order_id = ?', [req.params.id]);
    runQuery('DELETE FROM reading_orders WHERE id = ?', [req.params.id]);
    res.json({ message: 'Видалено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/:id/issues', (req, res) => {
  const { issue_id, order_num: requestedPos } = req.body;
  const orderId = req.params.id;
  try {
    const exists = getOne('SELECT id FROM reading_order_issues WHERE reading_order_id = ? AND issue_id = ?', [orderId, issue_id]);
    if (exists) return res.status(400).json({ error: 'Випуск вже є у порядку читання' });

    const totalRow = getOne('SELECT COUNT(*) as cnt FROM reading_order_issues WHERE reading_order_id = ?', [orderId]);
    const total = totalRow?.cnt || 0;
    let insertPos;
    if (requestedPos != null && requestedPos !== '') {
      insertPos = Math.max(1, Math.min(parseInt(requestedPos), total + 1));
      rawRun('UPDATE reading_order_issues SET order_num = order_num + 1 WHERE reading_order_id = ? AND order_num >= ?', [orderId, insertPos]);
    } else {
      insertPos = total + 1;
    }
    rawRun('INSERT INTO reading_order_issues (reading_order_id, issue_id, order_num) VALUES (?, ?, ?)', [orderId, issue_id, insertPos]);
    saveDatabase();
    res.json({ message: 'Додано', order_num: insertPos });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/:id/issues/:issue_id', (req, res) => {
  const orderId = req.params.id;
  const issueId = req.params.issue_id;
  try {
    const item = getOne('SELECT order_num FROM reading_order_issues WHERE reading_order_id = ? AND issue_id = ?', [orderId, issueId]);
    if (item) {
      rawRun('DELETE FROM reading_order_issues WHERE reading_order_id = ? AND issue_id = ?', [orderId, issueId]);
      rawRun('UPDATE reading_order_issues SET order_num = order_num - 1 WHERE reading_order_id = ? AND order_num > ?', [orderId, item.order_num]);
      saveDatabase();
    }
    res.json({ message: 'Видалено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/:id/issues/:issue_id/reorder', (req, res) => {
  const orderId = req.params.id;
  const issueId = req.params.issue_id;
  const new_order = parseInt(req.body.new_order);
  try {
    const item = getOne('SELECT order_num FROM reading_order_issues WHERE reading_order_id = ? AND issue_id = ?', [orderId, issueId]);
    if (!item) return res.status(404).json({ error: 'Не знайдено' });
    const old_order = item.order_num;
    if (old_order === new_order) return res.json({ message: 'Без змін' });
    const total = getOne('SELECT COUNT(*) as cnt FROM reading_order_issues WHERE reading_order_id = ?', [orderId]);
    const clampedNew = Math.max(1, Math.min(new_order, total?.cnt || 1));
    if (old_order < clampedNew) {
      rawRun('UPDATE reading_order_issues SET order_num = order_num - 1 WHERE reading_order_id = ? AND order_num > ? AND order_num <= ?', [orderId, old_order, clampedNew]);
    } else {
      rawRun('UPDATE reading_order_issues SET order_num = order_num + 1 WHERE reading_order_id = ? AND order_num >= ? AND order_num < ?', [orderId, clampedNew, old_order]);
    }
    rawRun('UPDATE reading_order_issues SET order_num = ? WHERE reading_order_id = ? AND issue_id = ?', [clampedNew, orderId, issueId]);
    saveDatabase();
    res.json({ message: 'Порядок оновлено' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

module.exports = router;