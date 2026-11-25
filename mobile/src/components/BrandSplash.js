import { ActivityIndicator, StyleSheet, View } from 'react-native';
import BrandLogo from '@/components/BrandLogo';
import { colors } from '@/utils/theme';

// Màn hình chờ trong app lúc mở (khôi phục phiên đăng nhập). Cùng nền kem + logo cùng cỡ với màn hình chờ gốc
// (expo-splash-screen, xem app.json) nên chuyển cảnh liền mạch. Expo Go không hiện màn hình chờ gốc (chỉ hiện icon app),
// nên màn này là thứ duy nhất hiện logo đầy đủ khi thử bằng Expo Go.
// 218 = 211dp chữ/biểu tượng (240dp * 900/1024 của ảnh splash) + lề trong suốt 12/760 mỗi bên của logo-full.png.
export default function BrandSplash() {
  return (
    <View style={styles.box}>
      <BrandLogo variant="full" width={218} />
      {/* Vòng quay đặt tuyệt đối để logo luôn nằm đúng giữa màn hình, khớp vị trí màn hình chờ gốc */}
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.splash },
  spinner: { position: 'absolute', bottom: '12%' },
});
