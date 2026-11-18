#!/usr/bin/env node
// Cấu hình Keycloak MỘT LẦN để đăng nhập + đăng ký chạy ngay trong app (không nhảy sang trang Keycloak):
//   1. client `hfarm-mobile`: bật "Direct access grants" (cho phép đăng nhập bằng email + mật khẩu từ app)
//   2. role `customer` (tạo nếu chưa có)
//   3. client `hfarm-backend` (có tài khoản dịch vụ) + quyền quản lý người dùng, để backend tạo tài khoản khách
//   4. in ra KEYCLOAK_ADMIN_CLIENT_ID / KEYCLOAK_ADMIN_CLIENT_SECRET để đặt vào backend/.env
// Chạy được nhiều lần (không tạo trùng, không đổi những gì đã đúng).
//
// Cách dùng (trong thư mục backend; KEYCLOAK_URL và KEYCLOAK_REALM lấy từ backend/.env):
//   npm run setup:keycloak                 hỏi tên + mật khẩu quản trị Keycloak (mật khẩu không hiện khi gõ, không lưu)
//   npm run setup:keycloak -- --write-env  như trên và ghi luôn 2 biến vào backend/.env
// Hoặc đặt sẵn KC_ADMIN_USER và KC_ADMIN_PASSWORD trong môi trường (PowerShell: $env:KC_ADMIN_PASSWORD = '...').
const fs = require('fs');
const path = require('path');
const readline = require('readline');
// ENV_FILE: đường dẫn file .env khác (mặc định backend/.env), chủ yếu để kiểm thử
const ENV_PATH = process.env.ENV_FILE || path.join(__dirname, '..', '.env');
require('dotenv').config({ path: ENV_PATH });

const trimSlash = (s) => String(s || '').trim().replace(/\/+$/, '');
const KC = trimSlash(process.env.KEYCLOAK_URL);
const REALM = String(process.env.KEYCLOAK_REALM || '').trim();
const MOBILE_CLIENT = process.env.KEYCLOAK_MOBILE_CLIENT_ID || 'hfarm-mobile';
const BACKEND_CLIENT = process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'hfarm-backend';
const WRITE_ENV = process.argv.includes('--write-env');

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); };
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer); });
  });
}

const fail = (msg) => { console.error(`\nLỖI: ${msg}`); process.exit(1); };
const ok = (msg) => console.log(`  ✓ ${msg}`);
const info = (msg) => console.log(`  - ${msg}`);

async function main() {
  if (!KC || !REALM) fail('Thiếu KEYCLOAK_URL / KEYCLOAK_REALM trong backend/.env');
  console.log(`Keycloak: ${KC}  |  realm: ${REALM}\n`);

  const user = process.env.KC_ADMIN_USER || (await ask('Tên quản trị Keycloak: '));
  const password = process.env.KC_ADMIN_PASSWORD || (await ask('Mật khẩu quản trị Keycloak: ', true));
  if (!user || !password) fail('Cần tên và mật khẩu quản trị Keycloak');

  let res;
  try {
    res = await fetch(`${KC}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: user, password }).toString(),
    });
  } catch (e) {
    fail(`Không kết nối được Keycloak (${e.message}). Keycloak đã chạy chưa?`);
  }
  const tokenBody = await res.json().catch(() => null);
  if (!res.ok) fail(`Đăng nhập quản trị thất bại: ${tokenBody?.error_description || tokenBody?.error || `HTTP ${res.status}`}`);
  const H = { Authorization: `Bearer ${tokenBody.access_token}`, 'Content-Type': 'application/json' };
  const api = (p, options = {}) => fetch(`${KC}/admin/realms/${REALM}${p}`, { ...options, headers: { ...H, ...(options.headers || {}) } });
  const body = async (r) => r.json().catch(() => null);
  const must = async (r, what) => { if (!r.ok) fail(`${what} (HTTP ${r.status}) ${JSON.stringify(await body(r))}`); return r; };

  // Realm có tồn tại không
  if ((await api('')).status === 404) fail(`Không có realm "${REALM}"`);

  console.log('1. Client ứng dụng di động');
  const mobiles = await body(await must(await api(`/clients?clientId=${encodeURIComponent(MOBILE_CLIENT)}`), 'Không đọc được client'));
  if (!mobiles.length) {
    info(`Chưa có client "${MOBILE_CLIENT}": tạo theo hướng dẫn ở README (mục Keycloak) rồi chạy lại script này.`);
  } else if (mobiles[0].directAccessGrantsEnabled) {
    ok(`"${MOBILE_CLIENT}" đã bật Direct access grants`);
  } else {
    await must(await api(`/clients/${mobiles[0].id}`, { method: 'PUT', body: JSON.stringify({ ...mobiles[0], directAccessGrantsEnabled: true }) }), 'Không bật được Direct access grants');
    ok(`Đã bật Direct access grants cho "${MOBILE_CLIENT}"`);
  }

  console.log('2. Role customer');
  const roleRes = await api('/roles/customer');
  if (roleRes.ok) ok('Role "customer" đã có');
  else if (roleRes.status === 404) {
    await must(await api('/roles', { method: 'POST', body: JSON.stringify({ name: 'customer', description: 'Khách hàng' }) }), 'Không tạo được role customer');
    ok('Đã tạo role "customer"');
  } else fail(`Không đọc được role customer (HTTP ${roleRes.status})`);

  console.log(`3. Client dịch vụ "${BACKEND_CLIENT}" (backend tạo tài khoản khách)`);
  let clients = await body(await must(await api(`/clients?clientId=${encodeURIComponent(BACKEND_CLIENT)}`), 'Không đọc được client'));
  let backendId = clients[0]?.id;
  if (!backendId) {
    const created = await must(await api('/clients', {
      method: 'POST',
      body: JSON.stringify({
        clientId: BACKEND_CLIENT,
        name: 'HFarm backend (tạo tài khoản khách)',
        protocol: 'openid-connect',
        enabled: true,
        publicClient: false,
        clientAuthenticatorType: 'client-secret',
        serviceAccountsEnabled: true,
        standardFlowEnabled: false,
        implicitFlowEnabled: false,
        directAccessGrantsEnabled: false,
      }),
    }), 'Không tạo được client dịch vụ');
    backendId = String(created.headers.get('location')).split('/').pop();
    ok(`Đã tạo client "${BACKEND_CLIENT}"`);
  } else {
    if (!clients[0].serviceAccountsEnabled || clients[0].publicClient) {
      await must(await api(`/clients/${backendId}`, { method: 'PUT', body: JSON.stringify({ ...clients[0], serviceAccountsEnabled: true, publicClient: false }) }), 'Không bật được tài khoản dịch vụ');
      ok(`Đã bật tài khoản dịch vụ cho "${BACKEND_CLIENT}"`);
    } else ok(`Client "${BACKEND_CLIENT}" đã có`);
  }

  console.log('4. Quyền quản lý người dùng cho tài khoản dịch vụ');
  const sa = await body(await must(await api(`/clients/${backendId}/service-account-user`), 'Không đọc được tài khoản dịch vụ'));
  const rms = await body(await must(await api('/clients?clientId=realm-management'), 'Không đọc được client realm-management'));
  if (!rms.length) fail('Không thấy client realm-management trong realm');
  const roles = [];
  // view-realm (chỉ đọc) cần để backend đọc được role customer trước khi gán cho người dùng mới
for (const name of ['manage-users', 'view-users', 'query-users', 'view-realm']) {
    roles.push(await body(await must(await api(`/clients/${rms[0].id}/roles/${name}`), `Không đọc được quyền ${name}`)));
  }
  const have = await body(await must(await api(`/users/${sa.id}/role-mappings/clients/${rms[0].id}`), 'Không đọc được quyền hiện có'));
  const missing = roles.filter((r) => !have.some((h) => h.id === r.id));
  if (missing.length) {
    await must(await api(`/users/${sa.id}/role-mappings/clients/${rms[0].id}`, { method: 'POST', body: JSON.stringify(missing) }), 'Không gán được quyền');
    ok(`Đã cấp quyền: ${missing.map((r) => r.name).join(', ')}`);
  } else ok('Tài khoản dịch vụ đã đủ quyền (manage-users, view-users, query-users, view-realm)');

  console.log('5. Mật khẩu (secret) của client dịch vụ');
  let secret = (await body(await must(await api(`/clients/${backendId}/client-secret`), 'Không đọc được secret')))?.value;
  if (!secret) secret = (await body(await must(await api(`/clients/${backendId}/client-secret`, { method: 'POST' }), 'Không tạo được secret')))?.value;
  if (!secret) fail('Không lấy được secret của client');
  ok('Đã lấy secret');

  const lines = [`KEYCLOAK_ADMIN_CLIENT_ID=${BACKEND_CLIENT}`, `KEYCLOAK_ADMIN_CLIENT_SECRET=${secret}`];
  if (WRITE_ENV) {
    const envPath = ENV_PATH;
    let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    for (const line of lines) {
      const key = line.split('=')[0];
      const re = new RegExp(`^${key}=.*$`, 'm');
      text = re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith('\n') ? eol : ''}${line}${eol}`;
    }
    fs.writeFileSync(envPath, text);
    console.log(`\nĐã ghi KEYCLOAK_ADMIN_CLIENT_ID và KEYCLOAK_ADMIN_CLIENT_SECRET vào ${path.basename(ENV_PATH)}. Khởi động lại backend để áp dụng.`);
  } else {
    console.log('\nThêm 2 dòng sau vào backend/.env rồi khởi động lại backend (hoặc chạy lại với --write-env để script tự ghi):\n');
    console.log(lines.join('\n'));
  }
  console.log('\nXong. Đăng nhập + đăng ký trong app đã sẵn sàng.');
}

main().catch((e) => fail(e.message));
