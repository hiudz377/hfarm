import { Space, Typography } from 'antd';

export default function PageHeader({ title, description, extra }) {
  return (
    <div className="page-header">
      <div>
        <Typography.Title level={3} className="page-title">{title}</Typography.Title>
        {description && <Typography.Paragraph className="page-description">{description}</Typography.Paragraph>}
      </div>
      {extra && <Space wrap>{extra}</Space>}
    </div>
  );
}
