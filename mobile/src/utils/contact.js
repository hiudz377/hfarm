import { Alert, Linking } from 'react-native';

// Mở ứng dụng khác (gọi điện, Zalo, thư). Không dùng canOpenURL (Android 11+ cần khai báo thêm); cứ mở và bắt lỗi.
// Không mở được (máy không có SIM, chưa cài ứng dụng thư...) thì hiện thông tin để khách tự liên hệ.
async function open(url, failTitle, failMessage) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(failTitle, failMessage);
  }
}

const digits = (v) => String(v ?? '').replace(/[^\d+]/g, '');

export const callStore = (phone) => {
  const n = digits(phone);
  return open(`tel:${n}`, 'Không mở được cuộc gọi', `Vui lòng gọi số ${n}.`);
};

// zalo.me/<số điện thoại>: mở thẳng ứng dụng Zalo nếu đã cài, không thì mở trang web Zalo
export const zaloStore = (zalo) => {
  const n = digits(zalo).replace(/^\+/, '');
  return open(`https://zalo.me/${n}`, 'Không mở được Zalo', `Vui lòng mở Zalo và nhắn tới số ${n}.`);
};

// orderCode (nếu có) được điền sẵn vào tiêu đề và nội dung thư để cửa hàng tra đơn nhanh
export const emailStore = (email, { storeName = 'HFarm', orderCode } = {}) => {
  const subject = orderCode ? `Hỗ trợ đơn hàng ${orderCode}` : 'Cần hỗ trợ';
  const body = orderCode
    ? `Xin chào ${storeName},\n\nTôi cần hỗ trợ về đơn hàng ${orderCode}.\n\n`
    : `Xin chào ${storeName},\n\n`;
  return open(
    `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    'Không mở được thư',
    `Vui lòng gửi thư tới ${email}.`,
  );
};
