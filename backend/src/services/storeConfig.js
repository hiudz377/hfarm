// Thông tin cửa hàng hiển thị trong app (liên hệ, đổi trả), đọc từ biến môi trường STORE_*.
// KHÔNG ghi số điện thoại / email thật vào code hay docs: kho GitHub là công khai.
// Đọc mỗi lần gọi (không cache) để đổi .env + restart là đủ và test đổi được biến.
// Giá trị sai định dạng được bỏ qua (null) thay vì gửi rác xuống app.

const clean = (v) => String(v ?? '').trim();

// Số điện thoại: bỏ khoảng trắng, dấu chấm, gạch ngang, ngoặc; còn lại phải là 8-15 chữ số (cho phép dấu + đầu)
function phoneOf(v) {
  const p = clean(v).replace(/[\s.\-()]/g, '');
  return /^\+?\d{8,15}$/.test(p) ? p : null;
}

const emailOf = (v) => {
  const e = clean(v);
  return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
};

const textOf = (v, max) => clean(v).slice(0, max) || null;

// Số ngày khách được yêu cầu đổi trả kể từ khi nhận hàng (1 - 90, mặc định 7)
function returnDays() {
  const n = parseInt(process.env.RETURN_DAYS, 10);
  return Number.isFinite(n) && n >= 1 && n <= 90 ? n : 7;
}

function storeInfo() {
  return {
    name: textOf(process.env.STORE_NAME, 60) || 'HFarm',
    phone: phoneOf(process.env.STORE_PHONE),
    zalo: phoneOf(process.env.STORE_ZALO), // số điện thoại đăng ký Zalo (mở https://zalo.me/<số>)
    email: emailOf(process.env.STORE_EMAIL),
    address: textOf(process.env.STORE_ADDRESS, 200),
    hours: textOf(process.env.STORE_HOURS, 100),
    return_days: returnDays(),
  };
}

module.exports = { storeInfo };
