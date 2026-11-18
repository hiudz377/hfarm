import { Avatar, Typography } from 'antd';
import { avatarColor, initials } from '../utils';

// Avatar chữ cái đầu (màu cố định theo tên) + tên + dòng phụ (email...). size: kích thước avatar.
export default function PersonCell({ name, sub, size = 36 }) {
  const label = name || sub || 'Khách hàng';
  return (
    <div className="person-cell">
      <Avatar size={size} style={{ background: avatarColor(label), flex: '0 0 auto', fontWeight: 600 }}>{initials(label)}</Avatar>
      <div className="person-text">
        <Typography.Text strong ellipsis className="person-name">{name || 'Chưa đặt tên'}</Typography.Text>
        {sub && <Typography.Text type="secondary" ellipsis className="person-sub">{sub}</Typography.Text>}
      </div>
    </div>
  );
}
