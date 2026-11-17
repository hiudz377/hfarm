// CRUD cho: categories, brands, sizes, colors
const express = require('express');
const db = require('../../db');
const { wrap, httpError, pick, uniqueSlug } = require('../../utils');

function makeCrud(table, cols, { slug = false, orderBy = 'id' } = {}) {
  const r = express.Router();

  r.get('/', wrap(async (req, res) => {
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
    res.json(rows);
  }));

  r.post('/', wrap(async (req, res) => {
    const data = pick(req.body, cols);
    if (!data.name) throw httpError(400, 'Thiếu tên');
    if (slug) data.slug = uniqueSlug(data.name);
    const [result] = await db.query(`INSERT INTO ${table} SET ?`, [data]);
    res.status(201).json({ id: result.insertId });
  }));

  r.put('/:id', wrap(async (req, res) => {
    const data = pick(req.body, cols);
    if (!Object.keys(data).length) throw httpError(400, 'Không có dữ liệu để cập nhật');
    await db.query(`UPDATE ${table} SET ? WHERE id = ?`, [data, req.params.id]);
    res.json({ message: 'Đã cập nhật' });
  }));

  r.delete('/:id', wrap(async (req, res) => {
    await db.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Đã xóa' });
  }));
  return r;
}

const router = express.Router();
router.use('/categories', makeCrud('categories', ['name', 'description', 'parent_id', 'is_active'], { slug: true }));
router.use('/brands', makeCrud('brands', ['name', 'description', 'logo_url', 'is_active']));
router.use('/sizes', makeCrud('sizes', ['name', 'sort_order'], { orderBy: 'sort_order, id' }));
router.use('/colors', makeCrud('colors', ['name', 'hex_code']));

module.exports = router;
