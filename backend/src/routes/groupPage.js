// Trang web mời mua nhóm: GET /g/<mã> (công khai, không phải API). Link này gửi được qua Zalo / Messenger (link http bấm được,
// còn link hfarm:// thì nhiều ứng dụng chat không bấm được). Trang cho xem nhóm và có nút "Mở trong ứng dụng" (hfarm://group/<mã>).
// Muốn bạn bè ngoài mạng nhà mở được thì đặt PUBLIC_URL trong backend/.env thành địa chỉ backend mà họ truy cập được.
const router = require('express').Router();
const { rateLimit } = require('../middleware/rateLimit');
const { getGroup, groupPrice } = require('../services/groupBuy');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫`;

const duration = (seconds) => {
  const m = Math.max(Math.floor(seconds / 60), 0);
  if (m >= 60 * 24) return `${Math.floor(m / (60 * 24))} ngày ${Math.floor((m % (60 * 24)) / 60)} giờ`;
  if (m >= 60) return `${Math.floor(m / 60)} giờ ${m % 60} phút`;
  return `${m} phút`;
};

const STATUS_TEXT = (g) => ({
  OPEN: `Đang mở: ${g.member_count}/${g.capacity} người, còn ${duration(g.seconds_left)} để rủ thêm bạn.`,
  SUCCESS: `Nhóm đã chốt thành công với ${g.final_members} người, mỗi người giảm ${g.final_percent}%.`,
  FAILED: 'Nhóm đã hết hạn mà chưa đủ người.',
  CANCELLED: 'Nhóm đã bị hủy.',
})[g.status];

function page(title, body) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
body{margin:0;background:#f7f6f2;color:#17201a;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:480px;margin:0 auto;padding:20px 16px 40px}
.card{background:#fff;border:1px solid #e5e7e1;border-radius:16px;padding:16px;margin-top:14px}
h1{font-size:22px;margin:8px 0 4px;color:#14432a}h2{font-size:15px;margin:0 0 8px}
img{width:100%;max-height:320px;object-fit:contain;background:#edebe4;border-radius:12px}
.tier{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #eee}.tier:last-child{border:0}
.pill{display:inline-block;background:#e8f0ea;color:#14432a;border-radius:999px;padding:4px 12px;font-weight:700;font-size:13px}
.btn{display:block;text-align:center;background:#1e5b3a;color:#fff;text-decoration:none;font-weight:700;border-radius:12px;padding:14px;margin-top:14px}
.code{font:700 26px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:4px;text-align:center;background:#e8f0ea;border-radius:12px;padding:12px;margin-top:8px;user-select:all}
.muted{color:#6c756e;font-size:14px}</style></head><body><main>${body}</main></body></html>`;
}

router.get('/:code', rateLimit({ windowMs: 60 * 1000, max: 60 }), async (req, res) => {
  res.set({ 'Content-Security-Policy': "default-src 'none'; img-src * data:; style-src 'unsafe-inline'", 'X-Content-Type-Options': 'nosniff' });
  try {
    const g = await getGroup(req.params.code);
    const base = g.product.price_from;
    const img = g.product.thumbnail ? `<img src="${esc(g.product.thumbnail)}" alt="">` : '';
    const tiers = g.tiers.map((t) => `<div class="tier"><span>Đủ ${t.min_members} người, giảm ${t.discount_percent}%</span><b>${money(groupPrice(base, t.discount_percent))}</b></div>`).join('');
    res.type('html').send(page(`Mua nhóm ${g.product.name}`, `
<p class="muted">HFarm Thời trang</p>
<h1>Bạn được mời mua nhóm</h1>
<div class="card">${img}<h2 style="margin-top:12px">${esc(g.product.name)}</h2>
<p class="muted" style="margin:0 0 8px">Giá thường từ ${money(base)}. Càng đông người, mỗi người càng được giảm nhiều:</p>${tiers}
<p style="margin:12px 0 0"><span class="pill">${esc(STATUS_TEXT(g))}</span></p></div>
${g.status === 'OPEN' ? `<a class="btn" href="hfarm://group/${esc(g.code)}">Mở trong ứng dụng HFarm</a>` : ''}
<div class="card"><h2>Mã nhóm</h2><div class="code">${esc(g.code)}</div>
<p class="muted" style="margin-bottom:0">Chưa bấm mở được? Mở ứng dụng HFarm, vào Tài khoản &gt; Mua nhóm của tôi và nhập mã này. Bạn chọn size, màu khi tham gia và chỉ trả tiền khi nhóm chốt thành công.</p></div>`));
  } catch (e) {
    res.status(e.status === 404 ? 404 : 500).type('html').send(page('Không tìm thấy nhóm', `<h1>${e.status === 404 ? 'Không tìm thấy nhóm' : 'Có lỗi xảy ra'}</h1>
<p class="muted">${e.status === 404 ? 'Mã nhóm không đúng hoặc nhóm không còn. Hãy kiểm tra lại link bạn nhận được.' : 'Vui lòng thử lại sau.'}</p>`));
    if (!e.status) console.error(e);
  }
});

module.exports = router;
