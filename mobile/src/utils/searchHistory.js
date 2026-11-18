import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addTerm, parseHistory, removeTerm } from './searchTerms';

// Lịch sử tìm kiếm lưu trên máy (không phải dữ liệu nhạy cảm nên dùng AsyncStorage, không dùng SecureStore).
// Mọi lỗi đọc/ghi đều bị nuốt: không có lịch sử thì tính năng tìm kiếm vẫn chạy bình thường.
const KEY = 'hfarm.search.history';

const load = async () => {
  try {
    return parseHistory(await AsyncStorage.getItem(KEY));
  } catch {
    return [];
  }
};
const save = async (list) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // bỏ qua: chỉ mất lịch sử, không ảnh hưởng chức năng
  }
};

export function useSearchHistory() {
  const [terms, setTerms] = useState([]);
  const latest = useRef([]);
  const apply = useCallback((next) => {
    latest.current = next;
    setTerms(next);
    save(next);
  }, []);

  useEffect(() => {
    let active = true;
    load().then((list) => {
      if (!active) return;
      // đã thêm từ khóa trong lúc đang đọc thì giữ cả hai
      const merged = latest.current.reduce((acc, t) => addTerm(acc, t), list);
      latest.current = merged;
      setTerms(merged);
    });
    return () => {
      active = false;
    };
  }, []);

  const add = useCallback((term) => apply(addTerm(latest.current, term)), [apply]);
  const remove = useCallback((term) => apply(removeTerm(latest.current, term)), [apply]);
  const clear = useCallback(() => apply([]), [apply]);
  return { terms, add, remove, clear };
}
