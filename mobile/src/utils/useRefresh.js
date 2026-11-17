import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

// Làm mới dữ liệu mỗi khi màn hình được focus lại: dữ liệu có thể đã đổi ở nơi khác
// (CMS đổi trạng thái đơn, tồn kho đổi...). Bỏ qua lần focus đầu vì lúc đó query vừa tự tải khi mount.
export function useFocusRefresh(queryKey) {
  const queryClient = useQueryClient();
  const first = useRef(true);
  const keyText = JSON.stringify(queryKey);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      queryClient.invalidateQueries({ queryKey: JSON.parse(keyText) });
    }, [queryClient, keyText]),
  );
}

// Trạng thái "đang kéo để làm mới" chỉ bật khi NGƯỜI DÙNG kéo, không bật khi dữ liệu tự tải lại ngầm
// (dùng `isRefetching` của react-query sẽ làm vòng quay hiện lên mỗi lần mở tab hoặc sau khi đặt hàng).
export function usePullRefresh(refetch) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  return { refreshing, onRefresh };
}
