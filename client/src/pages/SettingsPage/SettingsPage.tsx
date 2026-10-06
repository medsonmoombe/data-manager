import React, { useEffect, useState } from 'react';
import {
  Card, Tabs, Input, Button, Switch, Space, Table, Tag, Typography, message,
  Select, Modal, Row, Col, Statistic, Skeleton, Result, Tooltip,
  Descriptions, Divider, Badge, Avatar,
} from 'antd';
import {
  SaveOutlined, PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined,
  SafetyOutlined, BellOutlined, ApiOutlined, LinkOutlined,
  GlobalOutlined, InfoCircleOutlined, CheckCircleOutlined,
  KeyOutlined, UserOutlined, TeamOutlined,
  ExperimentOutlined, DatabaseOutlined, LockOutlined,
} from '@ant-design/icons';
import { usersApi, notificationsApi, connectorsApi } from '../../api';
import SecurityTab from './SecurityTab';
import { useAuthStore } from '../../stores/auth.store';
import MatchingRulesTab from './MatchingRulesTab';
import IpWhitelistTab from './IpWhitelistTab';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;

const C = {
  green: '#009B3A', greenBg: 'rgba(0,155,58,0.08)',
  red: '#CE1126', redBg: 'rgba(206,17,38,0.08)',
  orange: '#E8611D', orangeBg: 'rgba(232,97,29,0.08)',
  black: '#444', blackBg: 'rgba(0,0,0,0.05)',
  blue: '#2563EB', blueBg: 'rgba(37,99,235,0.08)',
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<'loading' | 'error' | 'success'>('loading');

  const [roles, setRoles] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [supportedTypes, setSupportedTypes] = useState<string[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [showNewRole, setShowNewRole] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] as string[] });
  const [newChannel, setNewChannel] = useState({ channel: 'email', provider: 'smtp', config: {} });
  const [orgName, setOrgName] = useState('');
  const [editingRole, setEditingRole] = useState<any>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const storeOrgName = useAuthStore((s) => s.orgName);

  useEffect(() => {
    if (storeOrgName) setOrgName(storeOrgName);
  }, [storeOrgName]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    setState('loading');
    try {
      const [rolesRes, channelsRes, prefRes, typesRes, permsRes] = await Promise.all([
        usersApi.getRoles().catch(() => []),
        notificationsApi.listChannels().catch(() => []),
        notificationsApi.getPreferences().catch(() => []),
        connectorsApi.getSupportedTypes().catch(() => ({ types: [] })),
        usersApi.getAvailablePermissions().catch(() => ({ permissions: [] })),
      ]);

      setRoles((rolesRes as any)?.data || rolesRes || []);
      setChannels((channelsRes as any)?.data || channelsRes || []);
      setPreferences((prefRes as any)?.data || prefRes || []);
      setSupportedTypes(((typesRes as any)?.data || typesRes as any)?.types || []);
      setAllPermissions(((permsRes as any)?.data || permsRes as any)?.permissions || []);
      setState('success');
    } catch (err) {
      console.error(err);
      setState('error');
    } finally {
      setLoading(false);
    }
  };

  const createRole = async () => {
    if (!newRole.name.trim()) { message.warning('Role name is required'); return; }
    setSaving('createRole');
    try {
      await usersApi.createRole(newRole);
      message.success('Role created');
      setShowNewRole(false);
      setNewRole({ name: '', description: '', permissions: [] });
      loadAll();
    } catch {
      message.error('Failed to create role');
    } finally {
      setSaving(null);
    }
  };

  const updateRole = async () => {
    if (!editingRole) return;
    setSaving('updateRole');
    try {
      await usersApi.updateRole(editingRole.id, {
        permissions: editingRole.permissions,
        description: editingRole.description,
      });
      message.success('Role updated');
      setEditingRole(null);
      loadAll();
    } catch {
      message.error('Failed to update role');
    } finally {
      setSaving(null);
    }
  };

  const deleteRole = async (id: string) => {
    Modal.confirm({
      title: 'Delete this role?',
      content: 'This action cannot be undone. Users with this role will lose its permissions.',
      okText: 'Delete',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await usersApi.deleteRole(id);
          message.success('Role deleted');
          loadAll();
        } catch {
          message.error('Failed to delete role');
        }
      },
    });
  };

  const createChannel = async () => {
    setSaving('createChannel');
    try {
      await notificationsApi.createChannel(newChannel);
      message.success('Channel added');
      setShowNewChannel(false);
      setNewChannel({ channel: 'email', provider: 'smtp', config: {} });
      loadAll();
    } catch {
      message.error('Failed to add channel');
    } finally {
      setSaving(null);
    }
  };

  const togglePermission = (perm: string) => {
    if (!editingRole) return;
    const has = editingRole.permissions.includes(perm);
    setEditingRole({
      ...editingRole,
      permissions: has
        ? editingRole.permissions.filter((p: string) => p !== perm)
        : [...editingRole.permissions, perm],
    });
  };

  const handleSaveGeneral = () => {
    message.success('General settings saved');
  };

  const totalPermissions = allPermissions.length;
  const channelCount = channels.length;
  const customRoles = roles.filter((r: any) => !r.isSystemRole).length;
  const systemRoles = roles.filter((r: any) => r.isSystemRole).length;

  if (state === 'loading') {
    return (
      <div>
        <PageHeader title="Settings" subtitle="Manage organization, roles, and system configuration">
          <Skeleton.Button active size="small" />
        </PageHeader>
        <Row gutter={12}>
          {Array(4).fill(0).map((_, i) => (
            <Col span={6} key={i}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div>
        <PageHeader title="Settings" subtitle="System configuration and management">
          <Button size="small" icon={<ReloadOutlined />} onClick={loadAll}>Retry</Button>
        </PageHeader>
        <Result
          status="warning"
          title="Failed to load settings"
          extra={<Button type="primary" onClick={loadAll} icon={<ReloadOutlined />} className="!bg-[#009B3A]">Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage organization, roles, notification channels, and system configuration">
        <Badge count={roles.length} size="small" offset={[-5, 0]}>
          <Button size="small" icon={<ReloadOutlined />} onClick={loadAll}>Refresh</Button>
        </Badge>
      </PageHeader>

      <Row gutter={12} className="mb-4">
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}
            style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Statistic title={<span className="text-[10px]">Roles</span>}
              value={roles.length} valueStyle={{ fontSize: 22, color: C.green }}
              prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}
            style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Statistic title={<span className="text-[10px]">Custom Roles</span>}
              value={customRoles} valueStyle={{ fontSize: 22, color: C.blue }}
              prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}
            style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Statistic title={<span className="text-[10px]">Channels</span>}
              value={channelCount} valueStyle={{ fontSize: 22, color: C.orange }}
              prefix={<BellOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}
            style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Statistic title={<span className="text-[10px]">Permissions</span>}
              value={totalPermissions} valueStyle={{ fontSize: 22, color: '#7C3AED' }}
              prefix={<KeyOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}
            style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Statistic title={<span className="text-[10px]">Connectors</span>}
              value={supportedTypes.length} valueStyle={{ fontSize: 22, color: '#059669' }}
              prefix={<ApiOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}
            style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Statistic title={<span className="text-[10px]">System Roles</span>}
              value={systemRoles} valueStyle={{ fontSize: 22, color: '#6B7280' }}
              prefix={<LockOutlined />} />
          </Card>
        </Col>
      </Row>

      <Tabs size="small" defaultActiveKey="general" items={[
        {
          key: 'general',
          label: <span><GlobalOutlined className="mr-1" />General</span>,
          children: (
            <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
              <div className="mb-4">
                <h4 className="text-[13px] font-bold m-0 text-[#1A1F2E]">Organization Settings</h4>
                <Text className="text-[11px] text-[#99A1B3]">Configure your organization's basic information</Text>
              </div>
              <Divider className="!my-3" />
              <div className="flex flex-col gap-4 max-w-[520px]">
                <div>
                  <Text className="text-[11px] font-semibold text-[#374151] block mb-1">Organization Name</Text>
                  <Input size="large" value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="!rounded-lg" placeholder="Enter organization name" />
                </div>
                <div>
                  <Text className="text-[11px] font-semibold text-[#374151] block mb-1">Current User</Text>
                  <Input size="large" disabled
                    value={`${user?.given_name || ''} ${user?.family_name || ''}${user?.email ? ` (${user.email})` : ''}`}
                    className="!rounded-lg !bg-[#F9FAFB]" />
                </div>
                <Row gutter={12}>
                  <Col span={12}>
                    <Text className="text-[11px] font-semibold text-[#374151] block mb-1">Language</Text>
                    <Select size="large" defaultValue="en" className="!w-full"
                      options={[{ label: 'English', value: 'en' }]} />
                  </Col>
                  <Col span={12}>
                    <Text className="text-[11px] font-semibold text-[#374151] block mb-1">Timezone</Text>
                    <Select size="large" defaultValue="Africa/Lusaka" className="!w-full"
                      options={[{ label: 'Africa/Lusaka (CAT)', value: 'Africa/Lusaka' }]} />
                  </Col>
                </Row>
                <div className="flex items-center justify-between pt-2 border-t border-[#F3F4F6]">
                  <Text className="text-[10px] text-[#9CA3AF]">Changes are applied immediately</Text>
                  <Button type="primary" size="small" icon={<SaveOutlined />}
                    onClick={handleSaveGeneral}
                    className="!bg-[#009B3A] !rounded-lg">
                    Save Changes
                  </Button>
                </div>
              </div>
            </Card>
          ),
        },
        {
          key: 'roles',
          label: <span><SafetyOutlined className="mr-1" />Roles ({roles.length})</span>,
          children: (
            <div>
              <div className="flex items-center justify-between mb-3">
                <Text className="text-[11px] text-[#6B7280]">
                  Roles control what users can access and modify in the system
                </Text>
                <Button type="primary" size="small" icon={<PlusOutlined />}
                  onClick={() => setShowNewRole(true)}
                  className="!bg-[#009B3A] !rounded-lg">
                  Create Role
                </Button>
              </div>
              <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                <Table
                  dataSource={roles}
                  rowKey="id"
                  size="small"
                  loading={loading}
                  pagination={{ size: 'small', pageSize: 15 }}
                  columns={[
                    {
                      title: 'NAME', dataIndex: 'name', key: 'name',
                      render: (v: string) => (
                        <Space>
                          <Avatar size={24} className="!bg-[rgba(0,155,58,0.1)] !text-[#009B3A] !text-[11px]">
                            {v.charAt(0).toUpperCase()}
                          </Avatar>
                          <span className="text-[12px] font-semibold text-[#111827]">{v}</span>
                        </Space>
                      ),
                    },
                    {
                      title: 'DESCRIPTION', dataIndex: 'description', key: 'desc',
                      ellipsis: true,
                      render: (v: string) => <span className="text-[11px] text-[#6B7280]">{v || '-'}</span>,
                    },
                    {
                      title: 'USERS', key: 'users',
                      render: (_: any, r: any) => (
                        <span className="text-[12px] font-semibold">{r._count?.userRoles || 0}</span>
                      ),
                    },
                    {
                      title: 'PERMISSIONS', key: 'perms',
                      render: (_: any, r: any) => {
                        const perms = r.permissions as string[];
                        return (
                          <Space size={2}>
                            {(perms || []).slice(0, 3).map((p: string) => (
                              <Tag key={p} className="!text-[9px] !m-0">{p}</Tag>
                            ))}
                            {(perms || []).length > 3 &&
                              <Tag className="!text-[9px] !m-0">+{perms.length - 3}</Tag>}
                          </Space>
                        );
                      },
                    },
                    {
                      title: 'TYPE', key: 'system',
                      render: (_: any, r: any) => r.isSystemRole
                        ? <Tag className="!text-[9px]">System</Tag>
                        : <Tag color="blue" className="!text-[9px]">Custom</Tag>,
                    },
                    {
                      title: '', key: 'actions', width: 100,
                      render: (_: any, r: any) => (
                        <Space size={4}>
                          <Tooltip title="Edit role">
                            <Button size="small" type="link" icon={<EditOutlined />}
                              onClick={() => setEditingRole(r)}
                              className="!text-[10px]" />
                          </Tooltip>
                          {!r.isSystemRole && (
                            <Tooltip title="Delete role">
                              <Button size="small" type="link" danger icon={<DeleteOutlined />}
                                onClick={() => deleteRole(r.id)}
                                className="!text-[10px]" />
                            </Tooltip>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            </div>
          ),
        },
        {
          key: 'channels',
          label: <span><BellOutlined className="mr-1" />Channels ({channels.length})</span>,
          children: (
            <div>
              <div className="flex items-center justify-between mb-3">
                <Text className="text-[11px] text-[#6B7280]">
                  Configure notification delivery channels (email, SMS, WhatsApp, in-app)
                </Text>
                <Button type="primary" size="small" icon={<PlusOutlined />}
                  onClick={() => setShowNewChannel(true)}
                  className="!bg-[#009B3A] !rounded-lg">
                  Add Channel
                </Button>
              </div>
              <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                <Table
                  dataSource={channels}
                  rowKey="id"
                  size="small"
                  loading={loading}
                  pagination={{ size: 'small', pageSize: 15 }}
                  columns={[
                    {
                      title: 'CHANNEL', dataIndex: 'channel', key: 'channel',
                      render: (v: string) => {
                        const colors: Record<string, string> = {
                          email: C.green, sms: C.blue, whatsapp: C.green,
                          in_app: C.orange, push: C.orange,
                        };
                        return (
                          <Tag color={colors[v] || 'default'} className="!text-[10px] !font-semibold">
                            {v?.toUpperCase()}
                          </Tag>
                        );
                      },
                    },
                    {
                      title: 'PROVIDER', dataIndex: 'provider', key: 'provider',
                      render: (v: string) => <span className="text-[12px] font-semibold text-[#111827]">{v}</span>,
                    },
                    {
                      title: 'DEFAULT', dataIndex: 'isDefault', key: 'default',
                      render: (v: boolean) => v
                        ? <Tag color="green" className="!text-[9px]">Default</Tag>
                        : <span className="text-[10px] text-[#9CA3AF]">-</span>,
                    },
                    {
                      title: 'ACTIVE', dataIndex: 'isActive', key: 'active',
                      render: (v: boolean) => <Switch size="small" checked={v} />,
                    },
                    {
                      title: 'CONFIG', key: 'config',
                      render: (_: any, r: any) => {
                        const cfg = r.config || {};
                        const keys = Object.keys(cfg).filter(k => k !== 'password' && k !== 'authToken');
                        return (
                          <Space size={2} wrap>
                            {keys.slice(0, 2).map(k => (
                              <Tag key={k} className="!text-[8px]">{k}: {String(cfg[k]).substring(0, 12)}</Tag>
                            ))}
                            {keys.length > 2 && <Tag className="!text-[8px]">+{keys.length - 2}</Tag>}
                          </Space>
                        );
                      },
                    },
                  ]}
                />
              </Card>
            </div>
          ),
        },
        {
          key: 'preferences',
          label: <span><BellOutlined className="mr-1" />Preferences</span>,
          children: (
            <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
              {preferences.length > 0 ? (
                <Table
                  dataSource={preferences}
                  rowKey="id"
                  size="small"
                  loading={loading}
                  pagination={false}
                  columns={[
                    {
                      title: 'CHANNEL', dataIndex: 'channel', key: 'channel',
                      render: (v: string) => <Tag className="!text-[10px]">{v}</Tag>,
                    },
                    {
                      title: 'CATEGORY', dataIndex: 'category', key: 'category',
                      render: (v: string) => <span className="text-[12px] text-[#6B7280]">{v}</span>,
                    },
                    {
                      title: 'ENABLED', dataIndex: 'isEnabled', key: 'enabled',
                      render: (v: boolean) => <Switch size="small" checked={v} />,
                    },
                  ]}
                />
              ) : (
                <div className="text-center py-10">
                  <BellOutlined className="text-[24px] text-[#D1D5DB] mb-2" />
                  <div className="text-[12px] text-[#9CA3AF]">No notification preferences configured</div>
                  <div className="text-[10px] text-[#D1D5DB] mt-1">Preferences appear after receiving notifications</div>
                </div>
              )}
            </Card>
          ),
        },
        {
          key: 'connectors',
          label: <span><ApiOutlined className="mr-1" />Connectors</span>,
          children: (
            <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
              <div className="mb-4">
                <h4 className="text-[13px] font-bold m-0 text-[#1A1F2E]">Supported Connector Types</h4>
                <Text className="text-[11px] text-[#99A1B3]">
                  These connector types are available for data integration.
                </Text>
              </div>
              <Divider className="!my-3" />
              {supportedTypes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {supportedTypes.map((type) => {
                    const colors: Record<string, string> = {
                      csv: C.green, rest_api: C.blue, odbc: C.orange,
                      jdbc: C.orange, soap: C.red, ftp: C.black,
                      s3: '#7C3AED', bigquery: '#4285F4',
                    };
                    return (
                      <div key={type}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white"
                        style={{ borderLeft: `3px solid ${colors[type] || '#6B7280'}` }}>
                        <DatabaseOutlined style={{ color: colors[type] || '#6B7280', fontSize: 13 }} />
                        <span className="text-[11px] font-semibold text-[#374151]">{type.toUpperCase()}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10">
                  <ApiOutlined className="text-[24px] text-[#D1D5DB] mb-2" />
                  <div className="text-[12px] text-[#9CA3AF]">No connectors configured</div>
                </div>
              )}
            </Card>
          ),
        },
        {
          key: 'matching-rules',
          label: <span><ExperimentOutlined className="mr-1" />Matching Rules</span>,
          children: (
            <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
              <MatchingRulesTab />
            </Card>
          ),
        },
        {
          key: 'ip-whitelist',
          label: <span><LockOutlined className="mr-1" />IP Whitelist</span>,
          children: (
            <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
              <IpWhitelistTab />
            </Card>
          ),
        },
        {
          key: 'security',
          label: <span><SafetyOutlined className="mr-1" />Security</span>,
          children: (
            <SecurityTab />
          ),
        },
        {
          key: 'about',
          label: <span><InfoCircleOutlined className="mr-1" />About</span>,
          children: (
            <Row gutter={16}>
              <Col span={12}>
                <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-[rgba(0,155,58,0.1)] flex items-center justify-center">
                      <span className="text-[20px] font-bold text-[#009B3A]">OC</span>
                    </div>
                    <div>
                      <h4 className="text-[16px] font-bold m-0 text-[#111827]">OmniCore Africa</h4>
                      <Text className="text-[11px] text-[#9CA3AF]">Enterprise Data Platform</Text>
                    </div>
                  </div>
                  <Descriptions size="small" column={1}
                    labelStyle={{ fontSize: 11, color: '#9CA3AF' }}
                    contentStyle={{ fontSize: 12 }}>
                    <Descriptions.Item label="Version">1.0.0</Descriptions.Item>
                    <Descriptions.Item label="Organization">{orgName || user?.orgName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="User">{user?.email || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Platform">NestJS + React + Postgres</Descriptions.Item>
                    <Descriptions.Item label="Auth Provider">Native (JWT)</Descriptions.Item>
                  </Descriptions>
                  <Divider className="!my-3" />
                  <div className="p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
                    <div className="flex items-center gap-2 text-[12px] text-[#16A34A] font-semibold">
                      <CheckCircleOutlined /> All Systems Operational
                    </div>
                    <div className="text-[10px] text-[#6B7280] mt-1">
                      TLS 1.3 - AES-256 Encryption - Daily Backups - SOC 2 Compliant
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-[#9CA3AF] text-center">
                    Built for government, NGOs, and enterprise across Africa.
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                  <h4 className="text-[13px] font-bold m-0 text-[#1A1F2E] mb-3">Security & Compliance</h4>
                  <Divider className="!my-3" />
                  <div className="flex flex-col gap-3">
                    {[
                      { icon: <LockOutlined />, label: 'Encryption at Rest', desc: 'AES-256 encryption for all stored data' },
                      { icon: <LinkOutlined />, label: 'Encryption in Transit', desc: 'TLS 1.3 for all API communications' },
                      { icon: <KeyOutlined />, label: 'Authentication', desc: 'Native JWT auth with bcrypt password hashing' },
                      { icon: <SafetyOutlined />, label: 'IP Whitelisting', desc: 'Restrict access by IP address or CIDR range' },
                      { icon: <UserOutlined />, label: 'Role-Based Access', desc: 'Granular permissions with custom roles' },
                      { icon: <CheckCircleOutlined />, label: 'Audit Trail', desc: 'Complete activity logging for compliance' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#F9FAFB] transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-[rgba(0,155,58,0.08)] flex items-center justify-center text-[#009B3A] text-sm flex-shrink-0">
                          {item.icon}
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold text-[#374151]">{item.label}</div>
                          <div className="text-[10px] text-[#9CA3AF]">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </Col>
            </Row>
          ),
        },
      ]} />

      <Modal
        title={<span className="text-[14px] font-bold">Create Role</span>}
        open={showNewRole}
        onOk={createRole}
        onCancel={() => { setShowNewRole(false); setNewRole({ name: '', description: '', permissions: [] }); }}
        okText="Create"
        width={520}
        okButtonProps={{ loading: saving === 'createRole', className: '!bg-[#009B3A]' }}
      >
        <div className="flex flex-col gap-3 mt-3">
          <div>
            <Text className="text-[11px] font-semibold text-[#374151] block mb-1">Role Name *</Text>
            <Input size="large" placeholder="e.g. Data Analyst" value={newRole.name}
              onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
          </div>
          <div>
            <Text className="text-[11px] font-semibold text-[#374151] block mb-1">Description</Text>
            <Input size="large" placeholder="Describe what this role can do" value={newRole.description}
              onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} />
          </div>
          <div>
            <Text className="text-[11px] font-semibold text-[#374151] block mb-1">Permissions</Text>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] max-h-[240px] overflow-auto">
              {allPermissions.length > 0 ? allPermissions.map((perm: any) => {
                const key = `${perm.resource}:*`;
                const selected = newRole.permissions.includes(key);
                return (
                  <Tag
                    key={perm.resource}
                    className={`!cursor-pointer !text-[10px] !px-2 !py-1 !rounded-md !border !m-0 transition-all ${
                      selected ? '!bg-[rgba(0,155,58,0.1)] !text-[#009B3A] !border-[#009B3A]' : '!bg-white !text-[#6B7280] !border-[#D1D5DB]'
                    }`}
                    onClick={() => {
                      setNewRole({
                        ...newRole,
                        permissions: selected
                          ? newRole.permissions.filter((p) => p !== key)
                          : [...newRole.permissions, key],
                      });
                    }}
                  >
                    {selected && <CheckCircleOutlined className="mr-1 text-[10px]" />}
                    {perm.resource}:*
                  </Tag>
                );
              }) : (
                <div className="text-[11px] text-[#9CA3AF] w-full text-center py-4">No permissions available</div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title={<span className="text-[14px] font-bold">Edit: {editingRole?.name || ''}</span>}
        open={!!editingRole}
        onOk={updateRole}
        onCancel={() => setEditingRole(null)}
        okText="Save Changes"
        width={560}
        okButtonProps={{ loading: saving === 'updateRole', className: '!bg-[#009B3A]' }}
      >
        {editingRole && (
          <div className="flex flex-col gap-3 mt-3">
            <div>
              <Text className="text-[11px] font-semibold text-[#374151] block mb-1">
                Role: <span className="text-[#009B3A]">{editingRole.name}</span>
              </Text>
              {editingRole.isSystemRole && (
                <div className="p-2 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-[10px] text-[#92400E] mb-2">
                  This is a system role. Some properties cannot be changed.
                </div>
              )}
            </div>
            <div>
              <Text className="text-[11px] font-semibold text-[#374151] block mb-1">Description</Text>
              <Input size="large" value={editingRole.description || ''}
                onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                placeholder="Role description" />
            </div>
            <div>
              <Text className="text-[11px] font-semibold text-[#374151] block mb-1">Permissions</Text>
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] max-h-[280px] overflow-auto">
                {allPermissions.map((perm: any) => {
                  const key = `${perm.resource}:*`;
                  const selected = editingRole.permissions?.includes(key);
                  return (
                    <Tag
                      key={perm.resource}
                      className={`!cursor-pointer !text-[10px] !px-2 !py-1 !rounded-md !border !m-0 transition-all ${
                        selected ? '!bg-[rgba(0,155,58,0.1)] !text-[#009B3A] !border-[#009B3A]' : '!bg-white !text-[#6B7280] !border-[#D1D5DB]'
                      }`}
                      onClick={() => togglePermission(key)}
                    >
                      {selected && <CheckCircleOutlined className="mr-1 text-[10px]" />}
                      {perm.resource}:*
                    </Tag>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={<span className="text-[14px] font-bold">Add Notification Channel</span>}
        open={showNewChannel}
        onOk={createChannel}
        onCancel={() => { setShowNewChannel(false); setNewChannel({ channel: 'email', provider: 'smtp', config: {} }); }}
        okText="Add Channel"
        width={480}
        okButtonProps={{ loading: saving === 'createChannel', className: '!bg-[#009B3A]' }}
      >
        <div className="flex flex-col gap-3 mt-3">
          <Row gutter={12}>
            <Col span={12}>
              <Text className="text-[11px] font-semibold text-[#374151] block mb-1">Channel Type</Text>
              <Select size="large" value={newChannel.channel} className="!w-full"
                onChange={(v) => setNewChannel({ ...newChannel, channel: v })}
                options={[
                  { label: 'Email', value: 'email' },
                  { label: 'SMS', value: 'sms' },
                  { label: 'WhatsApp', value: 'whatsapp' },
                  { label: 'In-App', value: 'in_app' },
                ]} />
            </Col>
            <Col span={12}>
              <Text className="text-[11px] font-semibold text-[#374151] block mb-1">Provider</Text>
              <Select size="large" value={newChannel.provider} className="!w-full"
                onChange={(v) => setNewChannel({ ...newChannel, provider: v })}
                options={[
                  { label: 'SMTP', value: 'smtp' },
                  { label: 'Twilio', value: 'twilio' },
                  { label: 'Baileys (WhatsApp)', value: 'baileys' },
                  { label: 'In-App', value: 'in_app' },
                ]} />
            </Col>
          </Row>
          <Divider className="!my-1">Provider Configuration</Divider>
          {newChannel.provider === 'smtp' && (
            <>
              <Input size="large" placeholder="SMTP Host (e.g. smtp.gmail.com)"
                onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, host: e.target.value } })} />
              <Row gutter={12}>
                <Col span={8}>
                  <Input size="large" placeholder="Port (e.g. 587)"
                    onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, port: e.target.value } })} />
                </Col>
                <Col span={16}>
                  <Input size="large" placeholder="Username"
                    onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, username: e.target.value } })} />
                </Col>
              </Row>
              <Input.Password size="large" placeholder="Password"
                onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, password: e.target.value } })} />
            </>
          )}
          {newChannel.provider === 'twilio' && (
            <>
              <Input size="large" placeholder="Account SID"
                onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, accountSid: e.target.value } })} />
              <Input.Password size="large" placeholder="Auth Token"
                onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, authToken: e.target.value } })} />
              <Input size="large" placeholder="From Number (e.g. +260970000000)"
                onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, fromNumber: e.target.value } })} />
            </>
          )}
          {newChannel.provider === 'baileys' && (
            <div className="p-3 rounded-lg bg-[#FEF3C7] text-[10px] text-[#92400E]">
              WhatsApp requires QR code authentication. You will receive a QR code after saving.
            </div>
          )}
          {newChannel.provider === 'in_app' && (
            <div className="p-3 rounded-lg bg-[#F0FDF4] text-[10px] text-[#16A34A]">
              In-app notifications require no additional configuration.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
