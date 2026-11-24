// Phí vận chuyển theo vùng (bảng shipping_zones, quản lý trong CMS).
const db = require('../db');
const { httpError } = require('../utils');

// "TP. Hồ Chí Minh" / "Thành phố Hồ Chí Minh" / "ho chi minh" -> "ho chi minh". Bỏ dấu, bỏ "tỉnh", "thành phố", "tp".
function normProvince(s) {
  return String(s ?? '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/\b(thanh pho|tinh|tp)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseProvinces(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : null; } catch { return null; }
}

// exec: pool hoặc connection trong transaction
async function loadZones(exec = db, { onlyActive = true } = {}) {
  const [rows] = await exec.query(`SELECT * FROM shipping_zones ${onlyActive ? 'WHERE is_active = 1' : ''} ORDER BY id`);
  return rows.map((z) => ({ ...z, provinces: parseProvinces(z.provinces) }));
}

// Vùng áp dụng cho một tỉnh: vùng nêu đích danh tỉnh đó trước, không có thì vùng mặc định, không có nữa thì null (không giao tới)
function pickZone(zones, province) {
  const key = normProvince(province);
  if (key) {
    const hit = zones.find((z) => !z.is_default && (z.provinces || []).some((p) => normProvince(p) === key));
    if (hit) return hit;
  }
  return zones.find((z) => z.is_default) || null;
}

const zoneInfo = (z, fee) => ({
  zone_id: z.id, zone_name: z.name, fee, base_fee: z.fee, free_over: z.free_over,
  eta_min_days: z.eta_min_days, eta_max_days: z.eta_max_days,
});

// Phí ship của một đơn: miễn phí khi tạm tính >= free_over của vùng. province rỗng -> dùng vùng mặc định.
async function feeFor(exec, province, subtotal) {
  const zones = await loadZones(exec);
  const zone = pickZone(zones, province);
  if (!zone) throw httpError(400, 'Cửa hàng chưa hỗ trợ giao hàng đến khu vực này');
  const fee = zone.free_over !== null && subtotal >= zone.free_over ? 0 : zone.fee;
  return zoneInfo(zone, fee);
}

// ---- Kiểm tra dữ liệu vùng khi tạo/sửa (CMS) ----
const intIn = (v, label, min, max) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw httpError(400, `${label} phải là số nguyên từ ${min} đến ${max}`);
  return n;
};

// Trả bản ghi sạch sẵn sàng ghi DB. others = các vùng khác (để chặn một tỉnh nằm ở hai vùng).
function validateZone(body, others) {
  const name = String(body.name ?? '').trim();
  if (!name || name.length > 120) throw httpError(400, 'Tên vùng bắt buộc, tối đa 120 ký tự');
  const fee = Number(body.fee);
  if (!Number.isFinite(fee) || fee < 0 || fee > 100000000) throw httpError(400, 'Phí vận chuyển không hợp lệ');
  let freeOver = null;
  if (body.free_over !== undefined && body.free_over !== null && body.free_over !== '') {
    freeOver = Number(body.free_over);
    if (!Number.isFinite(freeOver) || freeOver < 0 || freeOver > 1000000000) throw httpError(400, 'Ngưỡng miễn phí vận chuyển không hợp lệ');
  }
  const etaMin = intIn(body.eta_min_days ?? 2, 'Số ngày giao nhanh nhất', 0, 60);
  const etaMax = intIn(body.eta_max_days ?? 5, 'Số ngày giao chậm nhất', 0, 60);
  if (etaMin > etaMax) throw httpError(400, 'Số ngày giao nhanh nhất không được lớn hơn số ngày chậm nhất');
  const isDefault = body.is_default === true || body.is_default === 1 || body.is_default === '1';

  let provinces = null;
  if (!isDefault) {
    const raw = Array.isArray(body.provinces) ? body.provinces : [];
    provinces = [...new Set(raw.map((p) => String(p).trim()).filter(Boolean))];
    if (!provinces.length) throw httpError(400, 'Vùng không phải mặc định cần ít nhất một tỉnh/thành');
    if (provinces.length > 70 || provinces.some((p) => p.length > 100)) throw httpError(400, 'Danh sách tỉnh/thành không hợp lệ');
    for (const p of provinces) {
      const clash = others.find((z) => z.is_active && (z.provinces || []).some((q) => normProvince(q) === normProvince(p)));
      if (clash) throw httpError(400, `"${p}" đã thuộc vùng "${clash.name}"`);
    }
  }
  return { name, provinces, is_default: isDefault, fee, free_over: freeOver, eta_min_days: etaMin, eta_max_days: etaMax,
    is_active: body.is_active === undefined ? true : !!body.is_active };
}

module.exports = { feeFor, loadZones, pickZone, validateZone, normProvince, zoneInfo };
