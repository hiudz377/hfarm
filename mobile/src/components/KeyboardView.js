import { useContext } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';

// Bọc màn hình có ô nhập.
// - Expo mặc định edge-to-edge trên Android nên KeyboardAvoidingView PHẢI có `behavior` ở cả hai nền tảng,
//   nếu không màn hình nằm dưới bàn phím (https://docs.expo.dev/guides/keyboard-handling).
// - keyboardVerticalOffset = chiều cao header: KeyboardAvoidingView đo vị trí so với màn hình, mà nội dung màn
//   nằm dưới header; thiếu offset thì phần đệm hụt đúng bằng chiều cao header và thanh nút dưới vẫn bị che.
//   (dùng useContext thay vì useHeaderHeight để màn không có header cũng không bị ném lỗi)
export default function KeyboardView({ children, style }) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  return (
    <KeyboardAvoidingView style={[styles.fill, style]} behavior="padding" keyboardVerticalOffset={headerHeight}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
