import { useState } from 'react';
import { Button, Popconfirm, Tooltip } from 'antd';

// Nút biểu tượng có hộp xác nhận. Chú thích (tooltip) tự ẩn khi hộp xác nhận đang mở,
// nếu không nó sẽ nằm đè lên nút Hủy / Đồng ý và che mất chúng.
export default function ConfirmButton({
  tip, confirmTitle, description, okText, cancelText = 'Hủy', okDanger, onConfirm, ...buttonProps
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popconfirm
      title={confirmTitle}
      description={description}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={okDanger ? { danger: true } : {}}
      onConfirm={onConfirm}
      onOpenChange={setOpen}
    >
      <Tooltip title={tip} open={open ? false : undefined}>
        <Button type="text" {...buttonProps} />
      </Tooltip>
    </Popconfirm>
  );
}
