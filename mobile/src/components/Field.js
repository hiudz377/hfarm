import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '@/utils/theme';

// Ô nhập có nhãn + thông báo lỗi bên dưới. `right`: nút nhỏ đặt bên phải trong ô (ví dụ hiện/ẩn mật khẩu).
const Field = forwardRef(function Field({ label, error, style, right, ...inputProps }, ref) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.muted}
          {...inputProps}
          style={[styles.input, !!error && styles.inputError, !!right && styles.inputWithRight, style]}
        />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

export default Field;

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputWithRight: { paddingRight: 46 },
  inputError: { borderColor: colors.danger },
  right: { position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center' },
  error: { fontSize: 12, color: colors.danger },
});
