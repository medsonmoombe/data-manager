import React, { useEffect, useState } from 'react';
import {
  Table, Button, Card, Space, Tag, Typography, Modal, Drawer, message, Tabs,
  Descriptions, Row, Col, Input, InputNumber, Select, Switch, Popconfirm, Tooltip, Statistic,
} from 'antd';
import {
  ReloadOutlined, EyeOutlined, DeleteOutlined, PlusOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, CloudUploadOutlined, ApiOutlined,
  KeyOutlined, LinkOutlined, CopyOutlined, EditOutlined,
  PlayCircleOutlined, PauseCircleOutlined, SettingOutlined,
  CodeOutlined, GlobalOutlined, BarChartOutlined,
} from '@ant-design/icons';
import api from '../../api/axios';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;

// ============ CONFIGURATIONS ============
const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  success: { color: '#007d2e', icon: <CheckCircleOutlined />, label: 'Success' },
  failed: { color: '#991B1B', icon: <CloseCircleOutlined />, label: 'Failed' },
  partial: { color: '#92400E', icon: <ExclamationCircleOutlined />, label: 'Partial' },
  running: { color: '#1D4ED8', icon: <ClockCircleOutlined />, label: 'Running' },
  pending: { color: '#6B7280', icon: <ClockCircleOutlined />, label: 'Pending' },
};

export default function IntegrationsPage() {
  // ============ STATE ============
  const [loading, setLoading] = useState(false);
  const [connectors, setConnectors] = useState<any[]>([]);
  const [imports, setImports] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('history');

  // Modals
  const [showCreateConnector, setShowCreateConnector] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [editingConnector, setEditingConnector] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedImport, setSelectedImport] = useState<any>(null);
  const [runItems, setRunItems] = useState<any[]>([]);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // Forms
  const [newConnector, setNewConnector] = useState({
    name: '', connectorType: 'rest_api', configuration: { url: '', method: 'GET', headers: {} as Record<string, string>, dataPath: '' },
    schedule: '', isActive: true,
  });
  const [newApiKey, setNewApiKey] = useState({ name: '', scopes: ['records:read'], expiresAt: '', maxRequests: 10000 });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [apiKeyLimits, setApiKeyLimits] = useState<any>(null);

  // Usage drawer state
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageData, setUsageData] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // ============ LOAD ALL ============
  const loadAll = async () => {
    setLoading(true);
    try {
      const [connRes, apiKeyRes] = await Promise.all([
        api.get('/connectors'),
        api.get('/api-keys'),
      ]);
      console.log("API KEYS::", apiKeyRes)
      setConnectors(connRes.data?.data || connRes.data || []);
      const keyData = apiKeyRes.data || apiKeyRes;
      setApiKeys(keyData.keys || keyData || []);
      setApiKeyLimits(keyData.limits || null);
      await loadImportHistory();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadImportHistory = async () => {
    try {
      const res: any = await api.get('/connectors');
      const conns = res.data?.data || res.data || [];
      const allImports: any[] = [];

      for (const connector of conns) {
        try {
          const jobsRes: any = await api.get(`/connectors/${connector.id}/jobs`);
          const jobs = jobsRes.data?.data || jobsRes.data || [];
          for (const job of jobs) {
            try {
              const runsRes: any = await api.get(`/connectors/jobs/${job.id}/runs`);
              const runs = runsRes.data?.data || runsRes.data || [];
              runs.forEach((run: any) => {
                allImports.push({
                  ...run, connectorName: connector.name, connectorType: connector.connectorType,
                  connectorId: connector.id, jobName: job.name, targetEntity: job.targetEntity,
                  jobId: job.id, schedule: job.schedule, isActive: connector.isActive,
                });
              });
            } catch (err) { /* skip */ }
          }
        } catch (err) { /* skip */ }
      }

      allImports.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      setImports(allImports);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { loadAll(); }, []);

  // ============ CONNECTOR ACTIONS ============
  const createConnector = async () => {
    try {
      await api.post('/connectors', {
        name: newConnector.name,
        connectorType: newConnector.connectorType,
        configuration: newConnector.configuration,
        isActive: newConnector.isActive,
      });

      // If it's a REST API connector with a schedule, create a job
      if (newConnector.connectorType === 'rest_api' && newConnector.schedule) {
        const connRes = await api.get('/connectors');
        const conns = connRes.data?.data || connRes.data || [];
        const created = conns.find((c: any) => c.name === newConnector.name);
        if (created) {
          await api.post(`/connectors/${created.id}/jobs`, {
            name: `${newConnector.name} Job`,
            schedule: newConnector.schedule,
            targetEntity: 'person',
            transformationRules: [],
          });
        }
      }

      message.success('Connector created');
      setShowCreateConnector(false);
      setNewConnector({ name: '', connectorType: 'rest_api', configuration: { url: '', method: 'GET', headers: {}, dataPath: '' }, schedule: '', isActive: true });
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  const toggleConnector = async (id: string, isActive: boolean) => {
    try {
      await api.put(`/connectors/${id}`, { isActive: !isActive });
      message.success(isActive ? 'Connector paused' : 'Connector activated');
      loadAll();
    } catch (err) { message.error('Failed'); }
  };

  const deleteConnector = async (id: string) => {
    setDeleteLoading(id);
    try {
      await api.delete(`/connectors/${id}`);
      message.success('Connector deleted');
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
    finally { setDeleteLoading(null); }
  };

  // ============ API KEY ACTIONS ============
  const createApiKey = async () => {
    try {
      const res: any = await api.post('/api-keys', {
        name: newApiKey.name,
        scopes: newApiKey.scopes,
        expiresAt: newApiKey.expiresAt || undefined,
        maxRequests: newApiKey.maxRequests,
      });
      const keyData = res.data || res;
      setCreatedKey(keyData.key);
      setNewApiKey({ name: '', scopes: ['records:read'], expiresAt: '', maxRequests: 10000 });
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  const deleteApiKey = async (id: string) => {
    try {
      await api.delete(`/api-keys/${id}`);
      message.success('API key deleted');
      loadAll();
    } catch (err) { message.error('Failed'); }
  };

  const viewUsage = async (keyId: string) => {
    setUsageLoading(true);
    try {
      const res: any = await api.get(`/api-keys/${keyId}/usage?days=30`);
      setUsageData(res.data || res);
      setUsageOpen(true);
    } catch (err) { message.error('Failed to load usage'); }
    finally { setUsageLoading(false); }
  };

  // ============ VIEW DETAILS ============
  const viewRunDetails = async (run: any) => {
    setSelectedImport(run);
    setDetailOpen(true);
    setRunItems([]);
    try {
      const res: any = await api.get(`/connectors/runs/${run.id}/items`);
      setRunItems(res.data?.data || res.data || []);
    } catch (err) { setRunItems([]); }
  };

  // ============ COLUMNS ============
  const connectorColumns = [
    {
      title: 'NAME', dataIndex: 'name', key: 'name',
      render: (v: string, r: any) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{v}</div>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>{r.connectorType?.toUpperCase()}</div>
        </div>
      ),
    },
    {
      title: 'TYPE', dataIndex: 'connectorType', key: 'type',
      render: (v: string) => {
        const icons: Record<string, any> = { csv: <CloudUploadOutlined />, rest_api: <ApiOutlined />, mysql: <CodeOutlined /> };
        return <Tag icon={icons[v]} style={{ fontSize: 10 }}>{v?.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'STATUS', key: 'status',
      render: (_: any, r: any) => (
        <Switch
          size="medium"
          checked={r.isActive}
          onChange={() => toggleConnector(r.id, r.isActive)}
          checkedChildren="Active"
          unCheckedChildren="Paused"
        />
      ),
    },
    {
      title: 'LAST RUN', key: 'lastRun',
      render: (_: any, r: any) => {
        const runs = imports.filter(i => i.connectorId === r.id);
        const lastRun = runs[0];
        return <span style={{ fontSize: 11, color: '#6B7280' }}>{lastRun?.startedAt ? new Date(lastRun.startedAt).toLocaleDateString() : 'Never'}</span>;
      },
    },
    {
      title: '', key: 'actions', width: 100,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditingConnector(r); setShowCreateConnector(true); }} /></Tooltip>
          <Popconfirm title="Delete?" onConfirm={() => deleteConnector(r.id)}><Button type="text" size="small" danger icon={<DeleteOutlined />} loading={deleteLoading === r.id} /></Popconfirm>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: 'IMPORT', key: 'name', width: 180,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{r.connectorName || r.jobName}</div>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>{r.targetEntity?.replace(/_/g, ' ')}</div>
        </div>
      ),
    },
    {
      title: 'STATUS', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => {
        const cfg = statusConfig[v] || statusConfig.pending;
        return <Tag color={cfg.color} style={{ fontSize: 10 }}>{cfg.icon} {cfg.label}</Tag>;
      },
    },
    {
      title: 'RECORDS', key: 'records', width: 150,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
          <span>{r.recordsProcessed || 0} total</span>
          <span style={{ color: '#16A34A' }}>{r.recordsSucceeded || 0} ✓</span>
          {(r.recordsFailed || 0) > 0 && <span style={{ color: '#DC2626' }}>{r.recordsFailed} ✗</span>}
        </div>
      ),
    },
    {
      title: 'DATE', key: 'date', width: 140,
      render: (_: any, r: any) => (
        <span style={{ fontSize: 11, color: '#6B7280' }}>
          {r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}
        </span>
      ),
    },
    {
      title: '', key: 'actions', width: 60,
      render: (_: any, r: any) => (
        <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => viewRunDetails(r)} />
      ),
    },
  ];

  const apiKeyColumns = [
    { title: 'NAME', dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 500, fontSize: 12 }}>{v}</span> },
    {
      title: 'KEY', dataIndex: 'keyPrefix', key: 'key',
      render: (v: string) => <code style={{ fontSize: 10, background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>{v}...</code>,
    },
    {
      title: 'SCOPES', dataIndex: 'scopes', key: 'scopes',
      render: (v: string[]) => <Space size={2}>{v?.map(s => <Tag key={s} style={{ fontSize: 9 }}>{s}</Tag>)}</Space>,
    },
    {
      title: 'STATUS', dataIndex: 'isActive', key: 'status',
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'} style={{ fontSize: 10 }}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'USAGE', key: 'usage', width: 150,
      render: (_: any, r: any) => {
        const pct = r.maxRequests ? Math.round((r.requestCount / r.maxRequests) * 100) : 0;
        const isExhausted = r.maxRequests && r.requestCount >= r.maxRequests;
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
              <span>{r.requestCount?.toLocaleString() || 0}</span>
              <span style={{ color: '#9CA3AF' }}>/ {r.maxRequests?.toLocaleString() || '∞'}</span>
            </div>
            <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(pct, 100)}%`,
                background: isExhausted ? '#DC2626' : pct > 80 ? '#E8611D' : '#16A34A',
                borderRadius: 2,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        );
      },
    },
    {
      title: '', key: 'actions', width: 100,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Tooltip title="View Usage"><Button type="text" size="small" icon={<BarChartOutlined />} onClick={() => viewUsage(r.id)} /></Tooltip>
          <Popconfirm title="Revoke this key?" onConfirm={() => deleteApiKey(r.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ============ RENDER ============
  return (
    <div>
      <PageHeader title="Integrations" subtitle={`${connectors.length} connectors · ${apiKeys.length} API keys`}>
        <Button size="small" icon={<ReloadOutlined />} onClick={loadAll}>Refresh</Button>
        {activeTab === 'connectors' && (
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setShowCreateConnector(true); setEditingConnector(null); }} className="!bg-[#009B3A]">
            Add Connector
          </Button>
        )}
        {activeTab === 'api' && (
          <Button type="primary" size="small" icon={<KeyOutlined />} onClick={() => setShowApiKeyModal(true)} className="!bg-[#009B3A]">
            Generate API Key
          </Button>
        )}
      </PageHeader>

      {/* Tabs */}
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'history',
            label: `Import History (${imports.length})`,
            children: (
              <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                {imports.length > 0 ? (
                  <Table dataSource={imports} rowKey="id" loading={loading} size="small" columns={historyColumns}
                    pagination={{ size: 'small', pageSize: 20, showTotal: t => `${t} imports` }} />
                ) : (
                  <div style={{ padding: '60px 0', textAlign: 'center' }}>
                    <CloudUploadOutlined style={{ fontSize: 40, color: '#D1D5DB', marginBottom: 12 }} />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>No imports yet</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Import CSV files from the Records page.</div>
                  </div>
                )}
              </Card>
            ),
          },
          {
            key: 'connectors',
            label: `Connectors (${connectors.length})`,
            children: (
              <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                {connectors.length > 0 ? (
                  <Table dataSource={connectors} rowKey="id" loading={loading} size="small" columns={connectorColumns}
                    pagination={{ size: 'small', pageSize: 20 }} />
                ) : (
                  <div style={{ padding: '60px 0', textAlign: 'center' }}>
                    <ApiOutlined style={{ fontSize: 40, color: '#D1D5DB', marginBottom: 12 }} />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>No connectors</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Add a connector to pull data from external sources.</div>
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setShowCreateConnector(true)} style={{ marginTop: 12, background: '#009B3A' }}>
                      Add Connector
                    </Button>
                  </div>
                )}
              </Card>
            ),
          },
          {
            key: 'api',
            label: `API Keys (${apiKeys.length})`,
            children: (
              <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                {apiKeys.length > 0 ? (
                  <Table dataSource={apiKeys} rowKey="id" size="small" columns={apiKeyColumns} pagination={false} />
                ) : (
                  <div style={{ padding: '60px 0', textAlign: 'center' }}>
                    <KeyOutlined style={{ fontSize: 40, color: '#D1D5DB', marginBottom: 12 }} />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>No API keys</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Generate API keys for external system access.</div>
                    <Button type="primary" size="small" icon={<KeyOutlined />} onClick={() => setShowApiKeyModal(true)} style={{ marginTop: 12, background: '#009B3A' }}>
                      Generate API Key
                    </Button>
                  </div>
                )}
              </Card>
            ),
          },
        ]}
      />

      {/* ============ CREATE CONNECTOR MODAL ============ */}
      <Modal
        title={editingConnector ? 'Edit Connector' : 'Add Connector'}
        open={showCreateConnector}
        onOk={createConnector}
        onCancel={() => { setShowCreateConnector(false); setEditingConnector(null); }}
        okText={editingConnector ? 'Save' : 'Create'}
        width={560}
        okButtonProps={{ style: { background: '#009B3A' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <Input size="large" placeholder="Connector name" value={newConnector.name}
            onChange={e => setNewConnector({ ...newConnector, name: e.target.value })} />

          <Select size="large" value={newConnector.connectorType}
            onChange={v => setNewConnector({ ...newConnector, connectorType: v })}
            options={[
              { label: 'REST API', value: 'rest_api' },
              { label: 'CSV File', value: 'csv' },
              { label: 'MySQL', value: 'mysql' },
            ]} />

          {/* REST API Config */}
          {newConnector.connectorType === 'rest_api' && (
            <>
              <Input size="large" placeholder="API URL (e.g. https://api.example.com/data)"
                value={newConnector.configuration.url}
                onChange={e => setNewConnector({ ...newConnector, configuration: { ...newConnector.configuration, url: e.target.value } })} />
              <Select size="large" value={newConnector.configuration.method || 'GET'}
                onChange={v => setNewConnector({ ...newConnector, configuration: { ...newConnector.configuration, method: v } })}
                options={[{ label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' }]} />
              <Input size="large" placeholder="Data path (e.g. data.results)"
                value={newConnector.configuration.dataPath}
                onChange={e => setNewConnector({ ...newConnector, configuration: { ...newConnector.configuration, dataPath: e.target.value } })} />
              <Input size="large" placeholder="Auth header (e.g. Bearer token123)"
                value={newConnector.configuration.headers?.Authorization || ''}
                onChange={e => setNewConnector({
                  ...newConnector,
                  configuration: { ...newConnector.configuration, headers: { Authorization: e.target.value } },
                })} />
            </>
          )}

          {/* Schedule */}
          <div>
            <Text style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>Schedule (optional)</Text>
            <Select size="large" value={newConnector.schedule || undefined}
              onChange={v => setNewConnector({ ...newConnector, schedule: v || '' })}
              allowClear placeholder="No schedule (manual only)"
              options={[
                { label: 'Every hour', value: '0 * * * *' },
                { label: 'Every 6 hours', value: '0 */6 * * *' },
                { label: 'Daily at midnight', value: '0 0 * * *' },
                { label: 'Every Monday 8 AM', value: '0 8 * * 1' },
                { label: '1st of month', value: '0 0 1 * *' },
              ]} />
          </div>

          {/* Active toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch size="small" checked={newConnector.isActive}
              onChange={v => setNewConnector({ ...newConnector, isActive: v })} />
            <Text style={{ fontSize: 11 }}>Active</Text>
          </div>
        </div>
      </Modal>

      {/* ============ API KEY MODAL ============ */}
      <Modal
        title="Generate API Key"
        open={showApiKeyModal}
        onOk={createdKey ? () => setShowApiKeyModal(false) : createApiKey}
        onCancel={() => { setShowApiKeyModal(false); setCreatedKey(null); }}
        okText={createdKey ? 'Done' : 'Generate'}
        width={500}
        okButtonProps={{ style: { background: '#009B3A' } }}
      >
        {createdKey ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: 600, color: '#16A34A', display: 'block', marginBottom: 8 }}>
                ✅ API Key Generated Successfully
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 6, padding: '8px 12px', border: '1px solid #E5E7EB' }}>
                <code style={{ flex: 1, fontSize: 11, wordBreak: 'break-all' }}>{createdKey}</code>
                <Button size="small" icon={<CopyOutlined />}
                  onClick={() => { navigator.clipboard.writeText(createdKey); message.success('Copied!'); }} />
              </div>
              <Text style={{ fontSize: 10, color: '#DC2626', display: 'block', marginTop: 8 }}>
                ⚠️ Copy this key now. You won't be able to see it again.
              </Text>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            {apiKeyLimits && (
              <div style={{ background: '#F0FDF4', borderRadius: 8, padding: 10 }}>
                <Text style={{ fontSize: 11, color: '#16A34A', display: 'block' }}>
                  API Keys: {apiKeyLimits.currentKeys}/{apiKeyLimits.maxKeys} used ({apiKeyLimits.remainingSlots} remaining)
                </Text>
              </div>
            )}
            <Input size="large" placeholder="Key name (e.g. Mobile App)" value={newApiKey.name}
              onChange={e => setNewApiKey({ ...newApiKey, name: e.target.value })} />
            <Select size="large" mode="multiple" value={newApiKey.scopes}
              onChange={v => setNewApiKey({ ...newApiKey, scopes: v })}
              options={[
                { label: 'Read Records', value: 'records:read' },
                { label: 'Create Records', value: 'records:create' },
                { label: 'Update Records', value: 'records:update' },
                { label: 'Delete Records', value: 'records:delete' },
                { label: 'Read Forms', value: 'forms:read' },
                { label: 'Submit Forms', value: 'forms:submit' },
              ]} />

            <Input size="large" type="date" placeholder="Expires (optional)"
              value={newApiKey.expiresAt}
              onChange={e => setNewApiKey({ ...newApiKey, expiresAt: e.target.value })} />
          </div>
        )}
      </Modal>

      {/* ============ USAGE DRAWER ============ */}
      <Drawer title={<span style={{ fontWeight: 600 }}>API Key Usage: {usageData?.key?.name}</span>} open={usageOpen} onClose={() => setUsageOpen(false)} width={650}>
        {usageData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Descriptions size="small" column={2} labelStyle={{ fontSize: 10, color: '#9CA3AF' }} contentStyle={{ fontSize: 12 }}>
              <Descriptions.Item label="Key">{usageData.key?.prefix}...</Descriptions.Item>
              <Descriptions.Item label="Scopes">{(usageData.key?.scopes || []).join(', ')}</Descriptions.Item>
              <Descriptions.Item label="Created">{new Date(usageData.key?.createdAt).toLocaleDateString()}</Descriptions.Item>
              <Descriptions.Item label="Last Used">{usageData.key?.lastUsedAt ? new Date(usageData.key.lastUsedAt).toLocaleString() : 'Never'}</Descriptions.Item>
              <Descriptions.Item label="Expires">{usageData.key?.expiresAt ? new Date(usageData.key.expiresAt).toLocaleDateString() : 'Never'}</Descriptions.Item>
            </Descriptions>

            <Row gutter={12}>
              <Col span={6}>
                <Card size="small" bodyStyle={{ padding: 12, textAlign: 'center' }}>
                  <Statistic title="Total Requests" value={usageData.stats?.totalRequests || 0} valueStyle={{ fontSize: 20 }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" bodyStyle={{ padding: 12, textAlign: 'center' }}>
                  <Statistic title="Errors" value={usageData.stats?.errorCount || 0} valueStyle={{ fontSize: 20, color: '#DC2626' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" bodyStyle={{ padding: 12, textAlign: 'center' }}>
                  <Statistic title="Error Rate" value={`${usageData.stats?.errorRate || 0}%`} valueStyle={{ fontSize: 20 }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" bodyStyle={{ padding: 12, textAlign: 'center' }}>
                  <Statistic title="Period" value={`${usageData.stats?.period}`} valueStyle={{ fontSize: 14 }} />
                </Card>
              </Col>
            </Row>

            <Card size="small" title="Top Endpoints">
              <Table
                dataSource={usageData.stats?.requestsByEndpoint || []}
                rowKey="endpoint"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Endpoint', dataIndex: 'endpoint', render: (v: string) => <code style={{ fontSize: 10 }}>{v}</code> },
                  { title: 'Method', dataIndex: 'method', width: 60, render: (v: string) => <Tag style={{ fontSize: 10 }}>{v}</Tag> },
                  { title: 'Count', dataIndex: 'count', width: 60 },
                ]}
              />
            </Card>

            <Card size="small" title="Recent Requests">
              <Table
                dataSource={usageData.recentRequests || []}
                rowKey={(_, i) => String(i ?? 0)}
                size="small"
                pagination={{ size: 'small', pageSize: 10 }}
                columns={[
                  { title: 'Endpoint', dataIndex: 'endpoint', render: (v: string) => <code style={{ fontSize: 9 }}>{v?.substring(0, 40)}</code> },
                  { title: 'Method', dataIndex: 'method', width: 50, render: (v: string) => <Tag style={{ fontSize: 9 }}>{v}</Tag> },
                  { title: 'Status', dataIndex: 'statusCode', width: 50, render: (v: number) => <Tag color={v < 400 ? 'green' : 'red'} style={{ fontSize: 9 }}>{v}</Tag> },
                  { title: 'Time', dataIndex: 'responseTimeMs', width: 50, render: (v: number) => <span style={{ fontSize: 9 }}>{v}ms</span> },
                  { title: 'Date', dataIndex: 'createdAt', render: (v: string) => <span style={{ fontSize: 9, color: '#9CA3AF' }}>{new Date(v).toLocaleString()}</span> },
                ]}
              />
            </Card>
          </div>
        )}
      </Drawer>

      {/* ============ DETAIL DRAWER ============ */}
      <Drawer title="Import Details" open={detailOpen} onClose={() => setDetailOpen(false)} width={600}>
        {selectedImport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Descriptions size="small" column={2} labelStyle={{ fontSize: 10, color: '#9CA3AF' }} contentStyle={{ fontSize: 12, color: '#111827', fontWeight: 500 }}>
              <Descriptions.Item label="Name">{selectedImport.connectorName}</Descriptions.Item>
              <Descriptions.Item label="Entity">{selectedImport.targetEntity?.replace(/_/g, ' ')}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusConfig[selectedImport.status]?.color} style={{ fontSize: 10 }}>{statusConfig[selectedImport.status]?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Processed">{selectedImport.recordsProcessed || 0}</Descriptions.Item>
              <Descriptions.Item label="Succeeded">{selectedImport.recordsSucceeded || 0}</Descriptions.Item>
              <Descriptions.Item label="Failed">{selectedImport.recordsFailed || 0}</Descriptions.Item>
            </Descriptions>

            <Table dataSource={runItems} rowKey="id" size="small" pagination={{ size: 'small', pageSize: 10 }}
              columns={[
                { title: 'STATUS', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={v === 'processed' ? 'green' : 'red'} style={{ fontSize: 10 }}>{v}</Tag> },
                { title: 'DATA', dataIndex: 'rawData', ellipsis: true, render: (v: any) => <span style={{ fontSize: 10, fontFamily: 'monospace' }}>{v ? JSON.stringify(v).substring(0, 100) : '—'}</span> },
              ]} />
          </div>
        )}
      </Drawer>
    </div>
  );
}