import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Input, Space, Tag, message, Popconfirm, Switch,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { ipWhitelistApi } from '../../api';

interface IpWhitelistEntry {
  id: string;
  ipAddress: string;
  cidr?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export default function IpWhitelistTab() {
  const [entries, setEntries] = useState<IpWhitelistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newEntry, setNewEntry] = useState({ ipAddress: '', cidr: '', description: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await ipWhitelistApi.list();
      setEntries(res?.data || res || []);
    } catch {
      message.error('Failed to load IP whitelist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      await ipWhitelistApi.create({
        ipAddress: newEntry.ipAddress,
        cidr: newEntry.cidr || undefined,
        description: newEntry.description || undefined,
      });
      message.success('IP added to whitelist');
      setShowCreate(false);
      setNewEntry({ ipAddress: '', cidr: '', description: '' });
      load();
    } catch {
      message.error('Failed to add IP');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await ipWhitelistApi.delete(id);
      message.success('IP removed from whitelist');
      load();
    } catch {
      message.error('Failed to remove IP');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await ipWhitelistApi.toggle(id, isActive);
      load();
    } catch {
      message.error('Failed to toggle');
    }
  };

  const columns = [
    { title: 'IP Address', dataIndex: 'ipAddress', key: 'ip', render: (v: string) => <Tag style={{ fontFamily: 'monospace' }}>{v}</Tag> },
    { title: 'CIDR', dataIndex: 'cidr', key: 'cidr', render: (v: string | null) => v ? <Tag style={{ fontFamily: 'monospace' }}>{v}</Tag> : '-' },
    { title: 'Description', dataIndex: 'description', key: 'description', render: (v: string | null) => v || '-' },
    {
      title: 'Active', dataIndex: 'isActive', key: 'active',
      render: (v: boolean, r: IpWhitelistEntry) => <Switch size="small" checked={v} onChange={(checked) => handleToggle(r.id, checked)} />,
    },
    {
      title: 'Actions', key: 'actions',
      render: (_: any, r: IpWhitelistEntry) => (
        <Popconfirm title="Remove this IP from whitelist?" onConfirm={() => handleDelete(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#6B7280' }}>Restrict access to specific IP addresses or CIDR ranges</span>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>Add IP</Button>
      </div>

      <Table dataSource={entries} columns={columns} rowKey="id" loading={loading} pagination={false} size="small" />

      <Modal title="Add IP Address" open={showCreate} onOk={handleCreate} onCancel={() => setShowCreate(false)} okText="Add" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <Input size="small" placeholder="IP Address (e.g. 192.168.1.100)" value={newEntry.ipAddress} onChange={(e) => setNewEntry({ ...newEntry, ipAddress: e.target.value })} />
          <Input size="small" placeholder="CIDR (optional, e.g. 192.168.1.0/24)" value={newEntry.cidr} onChange={(e) => setNewEntry({ ...newEntry, cidr: e.target.value })} />
          <Input size="small" placeholder="Description (optional)" value={newEntry.description} onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
