// Bảng màu: xanh rừng đậm (thay cho xanh lá tươi trước đây), nền kem ấm, chữ gần đen. Mọi màn hình lấy màu từ đây.
export const colors = {
  primary: '#1E5B3A',
  primaryDark: '#14432A',
  primarySoft: '#E8F0EA',
  bg: '#F7F6F2',
  splash: '#F5F5EE', // nền kem của logo; trùng "backgroundColor" của expo-splash-screen trong app.json
  surface: '#FFFFFF',
  text: '#17201A',
  muted: '#6C756E',
  border: '#E5E7E1',
  danger: '#C0392B',
  dangerSoft: '#FBEAE7',
  sale: '#D2402F',
  gold: '#C9962F',
  white: '#FFFFFF',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

// Bóng nhẹ cho thẻ. Trên iOS bóng không hiện nếu view có overflow: 'hidden' (xem Card).
export const shadow = {
  card: {
    shadowColor: '#1B2A20',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};

// Header trắng, chữ đậm, không viền: dùng chung cho tab và stack
export const screenHeader = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700', fontSize: 17 },
  headerShadowVisible: false,
};
