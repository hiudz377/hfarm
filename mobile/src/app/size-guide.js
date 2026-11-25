import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '@/components/Button';
import Card from '@/components/Card';
import ContactActions from '@/components/ContactActions';
import Field from '@/components/Field';
import KeyboardView from '@/components/KeyboardView';
import { LETTER_SIZES, MEASURE_TIPS, NUMBER_SIZES, normSize, rangeText, suggestSize } from '@/content/sizeGuide';
import { colors, radius, space } from '@/utils/theme';

// Bảng đơn giản: dòng tiêu đề + các dòng; dòng `on` được tô nền (size đang chọn / size gợi ý).
function Table({ columns, rows }) {
  return (
    <Card clip>
      <View style={[styles.tr, styles.thead]}>
        {columns.map((c, i) => (
          <Text key={c.label} style={[styles.th, i === 0 ? styles.cellFirst : styles.cell]}>{c.label}</Text>
        ))}
      </View>
      {rows.map((r, idx) => (
        <View key={r.key} style={[styles.tr, idx < rows.length - 1 && styles.rowBorder, r.on && styles.rowOn]}>
          {r.cells.map((text, i) => (
            <Text key={columns[i].label} style={[styles.td, i === 0 ? [styles.cellFirst, styles.tdFirst] : styles.cell, r.on && styles.tdOn]}>{text}</Text>
          ))}
        </View>
      ))}
    </Card>
  );
}

// Hướng dẫn chọn size (modal, mở từ trang sản phẩm). ?size=<tên size đang chọn> để tô sẵn dòng tương ứng.
// Số đo là tham khảo, sửa ở src/content/sizeGuide.js.
export default function SizeGuide() {
  const params = useLocalSearchParams();
  const picked = normSize(Array.isArray(params.size) ? params.size[0] : params.size);
  const insets = useSafeAreaInsets();

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [result, setResult] = useState(null);

  const onSuggest = () => {
    Keyboard.dismiss();
    setResult(suggestSize(height, weight));
  };

  const highlight = result?.size ?? picked;

  return (
    <KeyboardView>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: space.xl + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Card style={styles.finder}>
          <Text style={styles.h}>Tìm size của bạn</Text>
          <Text style={styles.sub}>Nhập chiều cao và cân nặng, chúng tôi gợi ý size chữ phù hợp.</Text>
          <View style={styles.inputs}>
            <View style={styles.flex}>
              <Field label="Chiều cao (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="165" maxLength={5} returnKeyType="next" aria-label="Chiều cao tính bằng cm" />
            </View>
            <View style={styles.flex}>
              <Field label="Cân nặng (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="55" maxLength={5} returnKeyType="done" onSubmitEditing={onSuggest} aria-label="Cân nặng tính bằng kg" />
            </View>
          </View>
          <Button title="Gợi ý size" variant="soft" onPress={onSuggest} />
          {result?.error ? <Text style={styles.error} role="alert">{result.error}</Text> : null}
          {result?.tooBig ? (
            <Text style={styles.note} role="alert">Số đo của bạn vượt bảng size bên dưới. Hãy liên hệ cửa hàng để được tư vấn riêng.</Text>
          ) : null}
          {result?.size ? (
            <View style={styles.result} role="alert">
              <Text style={styles.resultLabel}>Size gợi ý cho bạn</Text>
              <Text style={styles.resultSize}>{result.size}</Text>
              <Text style={styles.resultHint}>Thích mặc ôm có thể chọn nhỏ hơn 1 size, thích mặc rộng thì chọn lớn hơn 1 size.</Text>
            </View>
          ) : null}
        </Card>

        <View style={styles.block}>
          <Text style={styles.h}>Bảng size chữ (áo, quần)</Text>
          <Table
            columns={[{ label: 'Size' }, { label: 'Cao (cm)' }, { label: 'Nặng (kg)' }, { label: 'Ngực' }, { label: 'Eo' }, { label: 'Mông' }]}
            rows={LETTER_SIZES.map((s) => ({
              key: s.size,
              on: normSize(s.size) === highlight,
              cells: [s.size, rangeText(s.height), rangeText(s.weight), rangeText(s.chest), rangeText(s.waist), rangeText(s.hip)],
            }))}
          />
          <Text style={styles.unit}>Ngực, eo, mông tính bằng cm.</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.h}>Bảng size số (quần)</Text>
          <Table
            columns={[{ label: 'Size' }, { label: 'Vòng eo (inch)' }, { label: 'Vòng eo (cm)' }]}
            rows={NUMBER_SIZES.map((s) => ({ key: s.size, on: s.size === picked, cells: [s.size, String(s.inch), `≈ ${s.waistCm}`] }))}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.h}>Cách đo</Text>
          {MEASURE_TIPS.map((tip) => (
            <View key={tip} style={styles.li}>
              <Text style={styles.bullet}>•</Text>
              <Text style={[styles.p, styles.flex]}>{tip}</Text>
            </View>
          ))}
        </View>

        <Card style={styles.finder}>
          <Text style={styles.h}>Cần tư vấn thêm?</Text>
          <Text style={styles.sub}>Số đo trong bảng mang tính tham khảo, có thể chênh 1 đến 2 cm tùy mẫu. Nếu còn phân vân, hãy hỏi cửa hàng trước khi đặt.</Text>
          <ContactActions />
        </Card>
      </ScrollView>
    </KeyboardView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.lg },
  flex: { flex: 1 },
  finder: { padding: space.md, gap: space.sm },
  h: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  inputs: { flexDirection: 'row', gap: space.md },
  error: { fontSize: 13, color: colors.danger },
  note: { fontSize: 13, color: colors.text, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md, lineHeight: 18, overflow: 'hidden' },
  result: { alignItems: 'center', gap: 2, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md },
  resultLabel: { fontSize: 13, color: colors.muted },
  resultSize: { fontSize: 34, fontWeight: '800', color: colors.primary },
  resultHint: { fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 17 },
  block: { gap: space.sm },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: space.sm },
  thead: { backgroundColor: colors.primarySoft },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowOn: { backgroundColor: colors.primary },
  th: { fontSize: 11, fontWeight: '700', color: colors.primaryDark, textAlign: 'center' },
  td: { fontSize: 12, color: colors.text, textAlign: 'center' },
  tdFirst: { fontWeight: '800' },
  tdOn: { color: colors.white },
  cellFirst: { flex: 0.8 },
  cell: { flex: 1.15 },
  unit: { fontSize: 12, color: colors.muted },
  li: { flexDirection: 'row', gap: space.sm, paddingRight: space.sm },
  bullet: { fontSize: 14, color: colors.primary, lineHeight: 20, width: 10 },
  p: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
