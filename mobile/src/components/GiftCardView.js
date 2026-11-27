import { StyleSheet, Text, View } from 'react-native';
import { serif } from '@/utils/giftTheme';

// Vẽ một tấm thiệp từ mẫu do backend quyết định (backend/src/services/gifts.js, CARDS): màu nền, màu chữ, màu viền/trang trí,
// kiểu viền, ký tự trang trí, kiểu chữ. CMS vẽ lại đúng mẫu này để IN thiệp giấy (web/src/pages/Orders.jsx), nên sửa kiểu vẽ ở đây
// thì xem lại cả bản in.
// width: chiều rộng thiệp (px), mọi kích thước khác tự co theo. compact: bản nhỏ trong danh sách chọn mẫu.
export default function GiftCardView({ card, message, sender, width = 280, compact = false }) {
  if (!card) return null;
  const scale = width / 280;
  const height = Math.round(width * 1.18);
  const fontFamily = card.font === 'serif' ? serif : undefined;
  const text = String(message ?? '').trim();
  const len = [...text].length;
  const base = len < 70 ? 17 : len < 150 ? 15 : len < 230 ? 13.5 : 12;
  const size = base * scale;
  const inset = 10 * scale;
  const frame = card.border === 'none' ? null : {
    borderWidth: Math.max(1, 2 * scale),
    borderColor: card.accent,
    borderStyle: card.border === 'dashed' ? 'dashed' : 'solid',
  };
  const ornament = card.ornament === '—' ? '———' : `${card.ornament}  ${card.ornament}  ${card.ornament}`;
  const placeholder = compact ? 'Lời nhắn của bạn' : 'Lời nhắn của bạn sẽ hiện ở đây';

  return (
    <View
      role="img"
      aria-label={`Thiệp ${card.name}${text ? `: ${text}` : ''}`}
      style={[styles.card, { width, height, backgroundColor: card.bg, borderRadius: 6 * scale + 2 }]}
    >
      {frame ? <View pointerEvents="none" style={[styles.frame, { margin: inset }, frame]} /> : null}
      {card.border === 'double' ? (
        <View
          pointerEvents="none"
          style={[styles.frame, { margin: inset + 5 * scale, borderWidth: Math.max(1, scale), borderColor: card.accent }]}
        />
      ) : null}
      <View style={[styles.body, { padding: 26 * scale, gap: 10 * scale }]}>
        <Text style={{ color: card.accent, fontSize: 15 * scale, letterSpacing: 2 * scale }}>{ornament}</Text>
        <Text
          numberOfLines={compact ? 3 : undefined}
          style={{
            color: card.ink, fontFamily, fontSize: size, lineHeight: size * 1.45, textAlign: 'center',
            opacity: text ? 1 : 0.5, fontStyle: text ? 'normal' : 'italic',
          }}
        >
          {text || placeholder}
        </Text>
        {sender ? (
          <Text numberOfLines={1} style={{ color: card.accent, fontFamily, fontStyle: 'italic', fontWeight: '700', fontSize: 14 * scale }}>
            {`— ${sender}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    shadowColor: '#2B1620',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  frame: { ...StyleSheet.absoluteFillObject },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
