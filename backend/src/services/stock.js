const { httpError } = require('../utils');

// Đổi tồn kho của 1 mẫu mã và ghi lịch sử. PHẢI gọi trong transaction (conn).
// IMPORT / ORDER_RESTOCK: cộng | EXPORT / ORDER_DEDUCT: trừ | ADJUSTMENT: đặt thẳng về số lượng
async function changeStock(conn, { variantId, type, quantity, userId = null, refType = null, refId = null, note = null, label = '' }) {
  quantity = Number(quantity);
  if (!Number.isInteger(quantity) || quantity < 0) throw httpError(400, 'Số lượng không hợp lệ');

  let [rows] = await conn.query('SELECT quantity FROM inventories WHERE variant_id = ? FOR UPDATE', [variantId]);
  if (!rows.length) {
    await conn.query('INSERT INTO inventories (variant_id, quantity) VALUES (?, 0)', [variantId]);
    rows = [{ quantity: 0 }];
  }
  const before = rows[0].quantity;
  let after;
  if (type === 'ADJUSTMENT') after = quantity;
  else if (type === 'IMPORT' || type === 'ORDER_RESTOCK') after = before + quantity;
  else after = before - quantity;
  if (after < 0) throw httpError(400, `Không đủ tồn kho${label ? ` cho ${label}` : ''} (còn ${before})`);

  await conn.query('UPDATE inventories SET quantity = ? WHERE variant_id = ?', [after, variantId]);
  await conn.query(
    `INSERT INTO inventory_movements
     (variant_id, created_by, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, note)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [variantId, userId, type, after - before, before, after, refType, refId, note]
  );
  return after;
}

module.exports = { changeStock };
