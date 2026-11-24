import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/theme';

const STAR = colors.gold;

// Hiển thị điểm (làm tròn tới nửa sao). Truyền onChange để thành ô chọn số sao (chạm vào sao thứ i = i sao).
export default function Stars({ value = 0, size = 14, onChange }) {
  return (
    <View style={styles.row} role={onChange ? 'radiogroup' : 'img'} aria-label={onChange ? 'Chọn số sao' : `${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
        const icon = <Ionicons name={name} size={size} color={STAR} />;
        return onChange ? (
          <Pressable key={i} onPress={() => onChange(i)} hitSlop={6} role="radio" aria-checked={value === i} aria-label={`${i} sao`}>
            {icon}
          </Pressable>
        ) : (
          <View key={i}>{icon}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 2, alignItems: 'center' } });
