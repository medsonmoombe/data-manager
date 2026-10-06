import { Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Typography.Title level={4} style={{ fontWeight: 700, color: '#111827' }}>Page Not Found</Typography.Title>
      <Typography.Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>The page you're looking for doesn't exist.</Typography.Text>
      <Button type="primary" onClick={() => navigate('/dashboard')} style={{ borderRadius: 6, background: '#111827', fontSize: 12 }}>Go to Dashboard</Button>
    </div>
  );
}