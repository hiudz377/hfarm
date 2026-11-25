import { Image } from 'expo-image';

// Logo HFarm (PNG trong suốt, tách từ bản thiết kế). Chỉ cần đặt width, chiều cao tự theo tỉ lệ ảnh.
//   full     biểu tượng + chữ HFarm + THỜI TRANG (màn hình chờ, màn đăng nhập lớn)
//   compact  biểu tượng + chữ HFarm (chỗ vừa; dòng THỜI TRANG nhỏ quá sẽ không đọc được)
//   mark     chỉ biểu tượng HF + dây leo
//   wordmark chỉ chữ HFarm
// ratio = rộng / cao của từng tệp trong assets/.
const LOGOS = {
  full: { source: require('../../assets/logo-full.png'), ratio: 760 / 710 },
  compact: { source: require('../../assets/logo-compact.png'), ratio: 560 / 465 },
  mark: { source: require('../../assets/logo-mark.png'), ratio: 480 / 369 },
  wordmark: { source: require('../../assets/logo-wordmark.png'), ratio: 480 / 114 },
};

export default function BrandLogo({ variant = 'full', width = 160, style }) {
  const { source, ratio } = LOGOS[variant] || LOGOS.full;
  return <Image source={source} style={[{ width, aspectRatio: ratio }, style]} contentFit="contain" alt="HFarm Thời trang" />;
}
