// Kiểm tra database đã áp dụng các migration cần thiết chưa (database/migrations/*.sql).
// Thiếu thì dừng ngay với hướng dẫn rõ ràng, thay vì để khách gặp lỗi SQL giữa chừng khi đặt hàng.
const db = require('./db');

const REQUIRED = [
  { file: '001_payment_shipping.sql', tables: ['bank_transactions', 'shipping_zones', 'shipment_events'], columns: [['orders', 'payment_expires_at']] },
  { file: '002_banners.sql', tables: ['banners'], columns: [] },
  { file: '003_outfit_stylist.sql', tables: [], columns: [['products', 'outfit_role'], ['products', 'gender'], ['products', 'styles'], ['products', 'occasions']] },
  { file: '004_group_buy.sql', tables: ['product_group_tiers', 'buy_groups', 'buy_group_members'], columns: [['products', 'group_buy_enabled'], ['products', 'group_buy_hours']] },
  { file: '005_gift_orders.sql', tables: ['order_gifts'], columns: [] },
];

// Trả danh sách file migration còn thiếu. Không kết nối được database thì trả null (backend vẫn khởi động như trước).
async function missingMigrations() {
  let tables;
  let cols;
  try {
    [tables] = await db.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()');
    [cols] = await db.query('SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE()');
  } catch (e) {
    console.warn(`Không kiểm tra được migration (chưa nối được database: ${e.code || e.message})`);
    return null;
  }
  const have = new Set(tables.map((r) => r.t.toLowerCase()));
  const haveCols = new Set(cols.map((r) => `${r.t.toLowerCase()}.${r.c.toLowerCase()}`));
  return REQUIRED.filter((m) => m.tables.some((t) => !have.has(t)) || m.columns.some(([t, c]) => !haveCols.has(`${t}.${c}`))).map((m) => m.file);
}

module.exports = { missingMigrations };
