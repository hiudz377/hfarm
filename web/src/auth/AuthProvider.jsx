import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { App, Button, Result, Space, Spin, Typography } from 'antd';
import { AUTH_DISABLED, DEV_ROLE, initKeycloak, keycloak, missingConfig } from './keycloak';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function readUser() {
  if (AUTH_DISABLED) return { name: 'Chế độ dev', email: '', roles: [DEV_ROLE] };
  const t = keycloak.tokenParsed || {};
  return {
    name: t.name || t.preferred_username || t.email || 'Người dùng',
    email: t.email || '',
    roles: t.realm_access?.roles || [],
  };
}

const logout = () => (AUTH_DISABLED ? window.location.reload() : keycloak.logout({ redirectUri: window.location.origin }));
const accountUrl = () => (AUTH_DISABLED ? null : keycloak.createAccountUrl());

function FullScreen({ children }) {
  return <div className="auth-screen">{children}</div>;
}

export function AuthProvider({ children }) {
  const { message } = App.useApp();
  // status: loading -> ready | error
  const [state, setState] = useState(AUTH_DISABLED
    ? { status: 'ready', user: readUser() }
    : { status: 'loading', user: null });

  useEffect(() => {
    if (AUTH_DISABLED) return undefined;
    if (missingConfig.length) {
      setState({ status: 'error', error: `Thiếu cấu hình Keycloak trong web/.env: ${missingConfig.join(', ')}.` });
      return undefined;
    }
    let active = true;
    initKeycloak()
      .then((authenticated) => {
        if (!active) return;
        if (!authenticated) { keycloak.login(); return; }
        setState({ status: 'ready', user: readUser() });
      })
      .catch(() => {
        if (active) setState({ status: 'error', error: 'Không kết nối được máy chủ đăng nhập (Keycloak). Hãy kiểm tra Keycloak đã chạy chưa rồi thử lại.' });
      });
    // Sau mỗi lần làm mới token, cập nhật lại vai trò (ví dụ quản trị viên vừa đổi quyền)
    keycloak.onAuthRefreshSuccess = () => setState((s) => (s.status === 'ready' ? { ...s, user: readUser() } : s));
    return () => { active = false; };
  }, []);

  // api.js phát sự kiện này khi backend trả 403
  useEffect(() => {
    const onForbidden = (e) => message.warning({ key: 'forbidden', content: e.detail || 'Không đủ quyền' });
    window.addEventListener('hfarm:forbidden', onForbidden);
    return () => window.removeEventListener('hfarm:forbidden', onForbidden);
  }, [message]);

  const roles = state.user?.roles;
  const value = useMemo(() => {
    if (!state.user) return null;
    const isAdmin = roles.includes('admin');
    const isStaff = roles.includes('staff');
    return {
      user: state.user,
      isAdmin,
      isStaff,
      roleLabel: isAdmin ? 'Quản trị viên' : 'Nhân viên',
      logout,
      accountUrl: accountUrl(),
    };
  }, [state.user, roles]);

  if (state.status === 'loading') {
    return (
      <FullScreen>
        <Space direction="vertical" align="center" size={16}>
          <Spin size="large" />
          <Typography.Text type="secondary">Đang xác thực tài khoản...</Typography.Text>
        </Space>
      </FullScreen>
    );
  }

  if (state.status === 'error') {
    return (
      <FullScreen>
        <Result status="error" title="Không thể đăng nhập" subTitle={state.error}
          extra={<Button type="primary" onClick={() => { window.location.href = window.location.origin; }}>Thử lại</Button>} />
      </FullScreen>
    );
  }

  // Đăng nhập rồi nhưng không phải admin/staff (ví dụ chỉ có role customer): không hiện CMS
  if (!value.isAdmin && !value.isStaff) {
    return (
      <FullScreen>
        <Result status="403" title="Bạn không có quyền truy cập"
          subTitle={`Tài khoản ${value.user.name}${value.user.email ? ` (${value.user.email})` : ''} không có vai trò Quản trị viên hoặc Nhân viên. Hãy đăng xuất và dùng tài khoản khác, hoặc liên hệ quản trị viên.`}
          extra={<Button type="primary" onClick={value.logout}>Đăng xuất</Button>} />
      </FullScreen>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
