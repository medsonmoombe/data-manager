import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Card, Typography, Tabs, message, Modal, Input, Select } from 'antd';
import { ReloadOutlined, CheckOutlined, MailOutlined, BellOutlined, SendOutlined, PlusOutlined } from '@ant-design/icons';
import { notificationsApi } from '../../api';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;

export default function NotificationsPage() {
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [showSend, setShowSend] = useState(false);
  const [sendForm, setSendForm] = useState({ channel: 'in_app', recipient: '', message: '', templateId: '' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [nRes, tRes, cRes, pRes]: any[] = await Promise.all([
        notificationsApi.list(),
        notificationsApi.listTemplates(),
        notificationsApi.listChannels(),
        notificationsApi.getPreferences(),
      ]);
      setNotifications(nRes.data?.data || nRes.data || []);
      setTemplates(tRes.data || tRes || []);
      setChannels(cRes.data || cRes || []);
      setPreferences(pRes.data || pRes || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    message.success('All marked as read');
    loadAll();
  };

  const sendNotification = async () => {
    try {
      await notificationsApi.send(sendForm);
      message.success('Notification sent');
      setShowSend(false);
      setSendForm({ channel: 'in_app', recipient: '', message: '', templateId: '' });
      loadAll();
    } catch (err) { message.error('Failed to send'); }
  };

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Manage notifications, templates, and channels">
        <Button size="small" icon={<CheckOutlined />} onClick={markAllRead}>Mark All Read</Button>
        <Button size="small" icon={<SendOutlined />} onClick={() => setShowSend(true)}>Send</Button>
        <Button size="small" icon={<ReloadOutlined />} onClick={loadAll}>Refresh</Button>
      </PageHeader>

      <Tabs size="small" defaultActiveKey="inbox" items={[
        {
          key: 'inbox',
          label: `Inbox (${notifications.length})`,
          children: (
            <Card bodyStyle={{ padding: 0 }}>
              <Table
                dataSource={notifications}
                rowKey="id"
                loading={loading}
                size="small"
                pagination={{ size: 'small', pageSize: 15 }}
                columns={[
                  {
                    title: '', key: 'icon', width: 30,
                    render: (_: any, r: any) => {
                      const icons: Record<string, any> = { email: <MailOutlined />, in_app: <BellOutlined />, sms: <MailOutlined />, whatsapp: <MailOutlined /> };
                      return icons[r.channel] || <BellOutlined />;
                    },
                  },
                  { title: 'SUBJECT', dataIndex: 'subject', key: 'subject', render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{v || '(No subject)'}</span> },
                  { title: 'CHANNEL', dataIndex: 'channel', key: 'channel', render: (v: string) => <Tag style={{ fontSize: 10 }}>{v}</Tag> },
                  {
                    title: 'STATUS', dataIndex: 'status', key: 'status',
                    render: (v: string) => {
                      const colors: Record<string, string> = { sent: 'green', delivered: 'blue', read: 'purple', failed: 'red', pending: 'orange' };
                      return <Tag color={colors[v] || 'default'} style={{ fontSize: 10 }}>{v}</Tag>;
                    },
                  },
                  { title: 'DATE', dataIndex: 'createdAt', key: 'date', render: (v: string) => <span style={{ fontSize: 11, color: '#9CA3AF' }}>{v ? new Date(v).toLocaleString() : '—'}</span> },
                  {
                    title: '', key: 'actions', width: 60,
                    render: (_: any, r: any) =>
                      r.status !== 'read' ? (
                        <Button size="small" type="link" onClick={() => notificationsApi.markRead(r.id).then(loadAll)} style={{ fontSize: 10, padding: 0 }}>Read</Button>
                      ) : null,
                  },
                ]}
              />
            </Card>
          ),
        },
        {
          key: 'templates',
          label: `Templates (${templates.length})`,
          children: (
            <Card bodyStyle={{ padding: 0 }}>
              <Table
                dataSource={templates}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: 'NAME', dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{v}</span> },
                  { title: 'CHANNEL', dataIndex: 'channel', key: 'channel', render: (v: string) => <Tag style={{ fontSize: 10 }}>{v}</Tag> },
                  { title: 'CATEGORY', dataIndex: 'category', key: 'category', render: (v: string) => <span style={{ fontSize: 11, color: '#6B7280' }}>{v}</span> },
                  { title: 'ACTIVE', dataIndex: 'isActive', key: 'active', render: (v: boolean) => <Tag color={v ? 'green' : 'red'} style={{ fontSize: 10 }}>{v ? 'Active' : 'Inactive'}</Tag> },
                ]}
              />
            </Card>
          ),
        },
        {
          key: 'channels',
          label: `Channels (${channels.length})`,
          children: (
            <Card bodyStyle={{ padding: 0 }}>
              <Table
                dataSource={channels}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: 'CHANNEL', dataIndex: 'channel', key: 'channel', render: (v: string) => <Tag style={{ fontSize: 11 }}>{v?.toUpperCase()}</Tag> },
                  { title: 'PROVIDER', dataIndex: 'provider', key: 'provider', render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{v}</span> },
                  { title: 'DEFAULT', dataIndex: 'isDefault', key: 'default', render: (v: boolean) => v ? <Tag color="green" style={{ fontSize: 10 }}>Default</Tag> : <span style={{ fontSize: 11, color: '#9CA3AF' }}>—</span> },
                  { title: 'STATUS', dataIndex: 'isActive', key: 'active', render: (v: boolean) => <Tag color={v ? 'green' : 'red'} style={{ fontSize: 10 }}>{v ? 'Active' : 'Inactive'}</Tag> },
                ]}
              />
            </Card>
          ),
        },
      ]} />

      {/* Send Notification Modal */}
      <Modal title="Send Notification" open={showSend} onOk={sendNotification} onCancel={() => setShowSend(false)} okText="Send" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <Select
            size="small"
            value={sendForm.channel}
            onChange={(v) => setSendForm({ ...sendForm, channel: v })}
            options={[
              { label: 'In-App', value: 'in_app' },
              { label: 'Email', value: 'email' },
              { label: 'SMS', value: 'sms' },
              { label: 'WhatsApp', value: 'whatsapp' },
            ]}
          />
          <Input size="small" placeholder="Recipient (user ID, email, or phone)" value={sendForm.recipient} onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })} />
          <Select
            size="small"
            placeholder="Template (optional)"
            allowClear
            value={sendForm.templateId || undefined}
            onChange={(v) => setSendForm({ ...sendForm, templateId: v || '' })}
            options={templates.map((t: any) => ({ label: t.name, value: t.id }))}
          />
          <Input.TextArea size="small" placeholder="Message" value={sendForm.message} onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })} rows={3} />
        </div>
      </Modal>
    </div>
  );
}