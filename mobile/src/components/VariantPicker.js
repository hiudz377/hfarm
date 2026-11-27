import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Chip from './Chip';
import { colors, space } from '@/utils/theme';

// Chọn màu + size để ra một mẫu mã (variant). variants: mảng của GET /products/:id; value: mã mẫu mã đang chọn (hoặc null);
// onChange(variantId | null): null khi chưa đủ (đã chọn màu mà chưa chọn size...). Tùy chọn hết hàng bị làm mờ nhưng vẫn bấm được
// (người dùng thấy ngay vì sao nút bị khóa).
const uniq = (list, key, map) => {
  const seen = new Set();
  const out = [];
  for (const v of list) {
    if (!seen.has(v[key])) { seen.add(v[key]); out.push(map(v)); }
  }
  return out;
};

export default function VariantPicker({ variants, value, onChange }) {
  const current = variants.find((v) => v.id === value) ?? null;
  const colorOptions = useMemo(() => uniq(variants, 'color_id', (v) => ({ id: v.color_id, name: v.color_name, hex: v.hex_code })), [variants]);
  const sizeOptions = useMemo(() => uniq(variants, 'size_id', (v) => ({ id: v.size_id, name: v.size_name })), [variants]);
  const [color, setColor] = useState(current?.color_id ?? (colorOptions.length === 1 ? colorOptions[0].id : null));
  const [size, setSize] = useState(current?.size_id ?? (sizeOptions.length === 1 ? sizeOptions[0].id : null));

  const inStock = (c, s) => variants.some((v) => (c == null || v.color_id === c) && (s == null || v.size_id === s) && Number(v.stock) > 0);
  const emit = (c, s) => onChange(variants.find((v) => v.color_id === c && v.size_id === s)?.id ?? null);

  return (
    <View style={styles.box}>
      {colorOptions.length ? (
        <View style={styles.group}>
          <Text style={styles.label}>Màu sắc</Text>
          <View style={styles.row}>
            {colorOptions.map((c) => (
              <Chip key={c.id} label={c.name} swatch={c.hex} selected={color === c.id} dimmed={!inStock(c.id, size)} onPress={() => { setColor(c.id); emit(c.id, size); }} />
            ))}
          </View>
        </View>
      ) : null}
      {sizeOptions.length ? (
        <View style={styles.group}>
          <Text style={styles.label}>Size</Text>
          <View style={styles.row}>
            {sizeOptions.map((s) => (
              <Chip key={s.id} label={s.name} selected={size === s.id} dimmed={!inStock(color, s.id)} onPress={() => { setSize(s.id); emit(color, s.id); }} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md },
  group: { gap: space.sm },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
