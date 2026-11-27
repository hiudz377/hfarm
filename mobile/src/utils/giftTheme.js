import { Platform } from 'react-native';

// Bảng màu RIÊNG của Quà tặng (rượu vang + vàng + hồng nhạt), cố ý khác xanh rừng của Stylist để hai tính năng nhìn khác hẳn nhau.
// Chỉ các màn Quà tặng (gift, gift-card), thẻ quà và khối "Quà tặng" ở thanh toán / chi tiết đơn dùng bảng này.
export const giftColors = {
  wine: '#7A1F3D',
  wineDark: '#5A1530',
  rose: '#FBEFF2',
  roseLine: '#EBC9D2',
  gold: '#C9962F',
  goldSoft: '#F6EBCF',
  cream: '#FFF9F3',
  ink: '#2B1620',
  muted: '#7C6670',
  white: '#FFFFFF',
};

// Chữ có chân cho tiêu đề và thiệp (iOS có Georgia, Android dùng serif hệ thống)
export const serif = Platform.select({ ios: 'Georgia', default: 'serif' });

// Biểu tượng từng dịp (mã dịp do backend quyết định: backend/src/services/gifts.js)
export const OCCASION_EMOJI = {
  BIRTHDAY: '🎂', ANNIVERSARY: '💍', VALENTINE: '💝', WHITE_DAY: '🤍',
  MEN_DAY: '👔', CHRISTMAS: '🎄', TET: '🧧', SURPRISE: '🎁',
};

// Header rượu vang cho các màn Quà tặng (kèm <StatusBar style="light" /> trong màn)
export const giftHeader = {
  headerStyle: { backgroundColor: giftColors.wine },
  headerTintColor: giftColors.white,
  headerTitleStyle: { fontFamily: serif, fontWeight: '700', fontSize: 18, color: giftColors.white },
  headerShadowVisible: false,
};

// Dịp có ngày cố định và còn không quá chừng này ngày thì được nhắc ở Trang chủ / đánh dấu "Sắp tới"
export const SOON_DAYS = 45;
export const soonestOccasion = (occasions) => (occasions ?? [])
  .filter((o) => o.days_left !== null && o.days_left <= SOON_DAYS)
  .sort((a, b) => a.days_left - b.days_left)[0] ?? null;

export const daysLeftText = (n) => (n === 0 ? 'hôm nay' : n === 1 ? 'ngày mai' : `còn ${n} ngày`);
