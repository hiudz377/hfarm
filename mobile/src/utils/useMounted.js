import { useEffect, useRef } from 'react';

// Ref cho biết màn hình còn đang hiển thị không. Callback `onSuccess` đặt ở mức useMutation vẫn chạy sau khi màn
// đã đóng; dùng ref này để KHÔNG điều hướng / hiện hộp thoại lần nữa (nếu không sẽ lùi thêm một màn ngoài ý muốn).
export function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
