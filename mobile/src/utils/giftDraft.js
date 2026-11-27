import { useSyncExternalStore } from 'react';

// Bản nháp của đơn quà đang làm dở: dịp, các món đã chọn qua màn Quà tặng, thiệp, lời nhắn, tùy chọn.
// Chỉ nằm trong bộ nhớ (tắt app là mất), chia sẻ giữa các màn gift -> gift-card -> checkout -> order-success.
const INITIAL = {
  occasion: null,
  picked: [], // mã mẫu mã (variant_id) đã chọn làm quà qua màn Quà tặng
  templateId: null,
  message: '',
  sender: '',
  noCard: false, // true = không kèm thiệp
  hidePrices: true,
  wrap: false,
};

let state = INITIAL;
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

export const getGiftDraft = () => state;
export function setGiftDraft(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  emit();
}
export function resetGiftDraft() {
  state = INITIAL;
  emit();
}
export const useGiftDraft = () => useSyncExternalStore(subscribe, getGiftDraft, getGiftDraft);

// Phần "gift" gửi cho POST /gifts/checkout (backend kiểm tra lại toàn bộ)
export function giftPayload(draft) {
  const withCard = !draft.noCard;
  return {
    occasion: draft.occasion || undefined,
    card_template: withCard ? draft.templateId || undefined : undefined,
    card_message: withCard ? draft.message.trim() || undefined : undefined,
    sender_name: withCard ? draft.sender.trim() || undefined : undefined,
    hide_prices: draft.hidePrices,
  };
}
