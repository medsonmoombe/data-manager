import React, { useEffect, useState } from 'react';
import {
  Card, Row, Col, Tag, Typography, Button, Space, Spin, Table,
  Progress, Statistic, Tooltip, message,
} from 'antd';
import {
  ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DatabaseOutlined, ApiOutlined, KeyOutlined, CloudServerOutlined,
  WarningOutlined, ClockCircleOutlined, BarChartOutlined,
  ThunderboltOutlined, LinkOutlined,
} from '@ant-design/icons';
import api from '../../api/axios';
import PageHeader from '../../components/PageHeader';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Filler, Tooltip as ChartTooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip, Legend);

const { Text, Title } = Typography;

const C = {
  green: '#009B3A', greenBg: 'rgba(0,155,58,0.08)',
  red: '#CE1126', redBg: 'rgba(206,17,38,0.08)',
  orange: '#E8611D', orangeBg: 'rgba(232,97,29,0.08)',
  gray: '#6B7280', grayBg: 'rgba(107,114,128,0.08)',
  blue: '#2563EB', blueBg: 'rgba(37,99,235,0.08)',
};

function ZambiaBar() {
  return (
    <div style={{
      height: 3, marginBottom: 16, borderRadius: 2,
      background: 'linear-gradient(90deg, #009B3A 0%, #009B3A 33%, #CE1126 33%, #CE1126 55%, #1A1F2E 55%, #1A1F2E 77%, #E8611D 77%, #E8611D 100%)',
    }} />
  );
}

export default function SystemHealthPage() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<any>(null);
  const [connectors, setConnectors] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [apiUsage, setApiUsage] = useState<any[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<any[]>([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        api.get('/health').catch(() => ({ data: null })),
        api.get('/connectors').catch(() => ({ data: [] })),
        api.get('/api-keys').catch(() => ({ data: { keys: [] } })),
      ]);

      setHealth(results[0].status === 'fulfilled' ? (results[0].value.data || results[0].value) : null);
      const connData = results[1].status === 'fulfilled' ? (results[1].value.data?.data || results[1].value.data || []) : [];
      setConnectors(Array.isArray(connData) ? connData : []);

      const keyData = results[2].status === 'fulfilled' ? (results[2].value.data || results[2].value) : { keys: [] };
      const keys = keyData.keys || keyData || [];
      setApiKeys(Array.isArray(keys) ? keys : []);

      // Load API usage for each key
      const usagePromises = (Array.isArray(keys) ? keys : []).slice(0, 5).map(async (k: any) => {
        try {
          const u: any = await api.get(`/api-keys/${k.id}/usage?days=7`);
          return { keyName: k.name, ...(u.data || u) };
        } catch { return null; }
      });
      const usageResults = await Promise.all(usagePromises);
      setApiUsage(usageResults.filter(Boolean));

      // Load upcoming connector jobs
      try {
        const upcoming: any = await api.get('/connectors/jobs/upcoming');
        setUpcomingJobs(upcoming.data?.data || upcoming.data || []);
      } catch { setUpcomingJobs([]); }

    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getServiceStatus = (serviceName: string) => {
    if (!health) return { status: 'unknown', label: 'Unknown', color: C.gray };
    if (health.status === 'ok' || health.status === 'healthy') {
      return { status: 'ok', label: 'Healthy', color: C.green };
    }
    // Try to get individual service status
    const details = health.details || {};
    const detail = details[serviceName] || details[serviceName.toLowerCase()];
    if (detail?.status === 'up' || detail?.status === 'ok' || detail?.healthy) {
      return { status: 'ok', label: 'Healthy', color: C.green };
    }
    if (detail) {
      return { status: 'error', label: 'Error', color: C.red };
    }
    return { status: 'unknown', label: 'Unknown (no health endpoint)', color: C.gray };
  };

  const services = [
    { key: 'postgres', name: 'PostgreSQL', icon: <DatabaseOutlined />, status: getServiceStatus('postgres') },
    { key: 'redis', name: 'Redis', icon: <ThunderboltOutlined />, status: getServiceStatus('redis') },
    { key: 'minio', name: 'MinIO (Storage)', icon: <CloudServerOutlined />, status: getServiceStatus('minio') },
    { key: 'auth', name: 'Auth (JWT)', icon: <KeyOutlined />, status: getServiceStatus('auth') },
  ];

  const connectorHealth = {
    total: connectors.length,
    active: connectors.filter((c: any) => c.isActive).length,
    inactive: connectors.filter((c: any) => !c.isActive).length,
  };

  const apiKeyMetrics = {
    total: apiKeys.length,
    active: apiKeys.filter((k: any) => k.isActive).length,
    totalRequests: apiKeys.reduce((sum: number, k: any) => sum + (k.requestCount || 0), 0),
  };

  // Build requests-by-day chart from API usage
  const usageChartData = (() => {
    if (apiUsage.length === 0) return null;
    const allDays = new Map<string, number>();
    apiUsage.forEach((u: any) => {
      (u.stats?.requestsByDay || []).forEach((d: any) => {
        allDays.set(d.date, (allDays.get(d.date) || 0) + d.count);
      });
    });
    const sortedDays = Array.from(allDays.entries()).sort(([a], [b]) => a.localeCompare(b));
    return {
      labels: sortedDays.map(([d]) => d.slice(5)),
      values: sortedDays.map(([, v]) => v),
    };
  })();

  if (loading) {
    return (
      <div>
        <div className="h-0.5 rounded-sm mb-4 opacity-70"
          style={{ background: 'linear-gradient(90deg, #009B3A 0%, #009B3A 35%, #CE1126 35%, #CE1126 55%, #1A1F2E 55%, #1A1F2E 77%, #E8611D 77%, #E8611D 100%)' }}
        />
        <div className="flex justify-center py-20"><Spin size="small" /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="System Health" subtitle="Monitor infrastructure, connectors, and API usage">
        <Button size="small" icon={<ReloadOutlined />} onClick={loadAll}>Refresh</Button>
      </PageHeader>

      {/* ===== INFRASTRUCTURE STATUS ===== */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <CloudServerOutlined className="text-[#009B3A] text-sm" />
          <h3 className="font-heading text-[13px] font-bold m-0">Infrastructure Services</h3>
        </div>
        <Row gutter={12}>
          {services.map((svc) => (
            <Col span={6} key={svc.key}>
              <Card
                size="small"
                bodyStyle={{ padding: '14px 16px' }}
                style={{
                  borderRadius: 10, border: `1px solid ${svc.status.color === C.green ? '#86EFAC' : svc.status.color === C.red ? '#FECACA' : '#E5E7EB'}`,
                  background: svc.status.color === C.green ? '#F0FDF4' : svc.status.color === C.red ? '#FEF2F2' : '#FAFAFA',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{ background: svc.status.color === C.green ? C.greenBg : svc.status.color === C.red ? C.redBg : C.grayBg, color: svc.status.color }}>
                    {svc.icon}
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-[#111827]">{svc.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {svc.status.status === 'ok'
                        ? <CheckCircleOutlined style={{ fontSize: 11, color: C.green }} />
                        : svc.status.status === 'error'
                          ? <CloseCircleOutlined style={{ fontSize: 11, color: C.red }} />
                          : <ClockCircleOutlined style={{ fontSize: 11, color: C.gray }} />
                      }
                      <span className="text-[10px]" style={{ color: svc.status.color }}>{svc.status.label}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* ===== METRICS ROW ===== */}
      <Row gutter={12} className="mb-4">
        <Col span={6}>
          <Card size="small" bodyStyle={{ padding: '14px 16px' }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Statistic
              title={<span className="text-[10px]">Connectors</span>}
              value={connectorHealth.total}
              suffix={<span className="text-[11px] text-[#16A34A]">({connectorHealth.active} active)</span>}
              valueStyle={{ fontSize: 22, fontWeight: 700, color: '#111827' }}
              prefix={<ApiOutlined className="text-[#009B3A] text-sm" />}
            />
            <div className="mt-2">
              <Progress
                percent={connectorHealth.total > 0 ? Math.round((connectorHealth.active / connectorHealth.total) * 100) : 0}
                size="small"
                strokeColor={C.green}
                format={() => `${connectorHealth.active}/${connectorHealth.total} active`}
              />
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" bodyStyle={{ padding: '14px 16px' }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Statistic
              title={<span className="text-[10px]">API Keys</span>}
              value={apiKeyMetrics.total}
              suffix={<span className="text-[11px] text-[#2563EB]">({apiKeyMetrics.active} active)</span>}
              valueStyle={{ fontSize: 22, fontWeight: 700, color: '#111827' }}
              prefix={<KeyOutlined className="text-[#E8611D] text-sm" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" bodyStyle={{ padding: '14px 16px' }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Statistic
              title={<span className="text-[10px]">Total API Requests (7d)</span>}
              value={apiKeyMetrics.totalRequests || 0}
              valueStyle={{ fontSize: 22, fontWeight: 700, color: '#111827' }}
              prefix={<BarChartOutlined className="text-[#2563EB] text-sm" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" bodyStyle={{ padding: '14px 16px' }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Statistic
              title={<span className="text-[10px]">System Uptime</span>}
              value={health?.status === 'ok' || health?.status === 'healthy' ? 'All Systems' : 'Degraded'}
              valueStyle={{ fontSize: 16, fontWeight: 700, color: health?.status === 'ok' || health?.status === 'healthy' ? C.green : C.red }}
              prefix={health?.status === 'ok' || health?.status === 'healthy' ? <CheckCircleOutlined className="text-sm" /> : <WarningOutlined className="text-sm" />}
            />
          </Card>
        </Col>
      </Row>

      {/* ===== API USAGE CHART ===== */}
      {usageChartData && (
        <Card
          size="small"
          title={<span className="text-[12px] font-bold">API Requests (Last 7 Days)</span>}
          bodyStyle={{ padding: '12px 16px' }}
          className="mb-4"
          style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}
        >
          <div style={{ height: 180 }}>
            <Line
              data={{
                labels: usageChartData.labels,
                datasets: [{
                  label: 'Requests',
                  data: usageChartData.values,
                  borderColor: C.green,
                  backgroundColor: 'rgba(0,155,58,0.08)',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 3,
                  pointBackgroundColor: C.green,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#9CA3AF' } },
                  y: { grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { font: { size: 9 }, color: '#9CA3AF' } },
                },
              }}
            />
          </div>
        </Card>
      )}

      {/* ===== CONNECTORS HEALTH ===== */}
      <Card
        size="small"
        title={<span className="text-[12px] font-bold">Connectors Health</span>}
        bodyStyle={{ padding: 0 }}
        className="mb-4"
        style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}
      >
        {connectors.length > 0 ? (
          <Table
            dataSource={connectors}
            rowKey="id"
            size="small"
            pagination={{ size: 'small', pageSize: 10 }}
            columns={[
              {
                title: 'NAME', dataIndex: 'name', key: 'name',
                render: (v: string, r: any) => (
                  <div>
                    <div className="text-[12px] font-semibold">{v}</div>
                    <div className="text-[10px] text-[#9CA3AF]">{r.connectorType?.toUpperCase()}</div>
                  </div>
                ),
              },
              {
                title: 'STATUS', dataIndex: 'isActive', key: 'status',
                render: (v: boolean) => (
                  <Tag color={v ? 'green' : 'red'} className="!text-[10px]">
                    {v ? 'Active' : 'Inactive'}
                  </Tag>
                ),
              },
              {
                title: 'LAST RUN', key: 'lastRun',
                render: (_: any, r: any) => {
                  const lastRun = r.lastRunAt || r.updatedAt;
                  return (
                    <span className="text-[11px] text-[#6B7280]">
                      {lastRun ? new Date(lastRun).toLocaleDateString() : 'Never'}
                    </span>
                  );
                },
              },
              {
                title: 'CONFIG TYPE', dataIndex: 'connectorType', key: 'type',
                render: (v: string) => (
                  <Tag className="!text-[9px]" color={v === 'rest_api' ? 'blue' : v === 'csv' ? 'green' : 'orange'}>
                    {v}
                  </Tag>
                ),
              },
            ]}
          />
        ) : (
          <div className="text-center py-8 text-[12px] text-[#9CA3AF]">
            No connectors configured
          </div>
        )}
      </Card>

      {/* ===== API KEYS USAGE TABLE ===== */}
      <Card
        size="small"
        title={<span className="text-[12px] font-bold">API Keys Usage</span>}
        bodyStyle={{ padding: 0 }}
        style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}
      >
        {apiKeys.length > 0 ? (
          <Table
            dataSource={apiKeys}
            rowKey="id"
            size="small"
            pagination={{ size: 'small', pageSize: 10 }}
            columns={[
              {
                title: 'NAME', dataIndex: 'name', key: 'name',
                render: (v: string) => <span className="text-[12px] font-semibold">{v}</span>,
              },
              {
                title: 'KEY', dataIndex: 'keyPrefix', key: 'key',
                render: (v: string) => <code className="text-[10px] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{v}...</code>,
              },
              {
                title: 'STATUS', dataIndex: 'isActive', key: 'status',
                render: (v: boolean) => <Tag color={v ? 'green' : 'red'} className="!text-[10px]">{v ? 'Active' : 'Inactive'}</Tag>,
              },
              {
                title: 'USAGE', key: 'usage',
                render: (_: any, r: any) => {
                  const pct = r.maxRequests ? Math.round((r.requestCount / r.maxRequests) * 100) : 0;
                  return (
                    <div className="flex items-center gap-2">
                      <Progress percent={Math.min(pct, 100)} size="small" style={{ width: 80, margin: 0 }}
                        strokeColor={pct > 80 ? C.red : pct > 50 ? C.orange : C.green} />
                      <span className="text-[10px] text-[#6B7280]">{r.requestCount || 0}/{r.maxRequests || '∞'}</span>
                    </div>
                  );
                },
              },
              {
                title: 'SCOPES', dataIndex: 'scopes', key: 'scopes',
                render: (v: string[]) => (
                  <Space size={2}>
                    {(v || []).slice(0, 2).map((s: string) => (
                      <Tag key={s} className="!text-[9px]">{s}</Tag>
                    ))}
                    {(v || []).length > 2 && <span className="text-[9px] text-[#9CA3AF]">+{v.length - 2}</span>}
                  </Space>
                ),
              },
              {
                title: 'LAST USED', dataIndex: 'lastUsedAt', key: 'lastUsed',
                render: (v: string) => (
                  <span className="text-[10px] text-[#6B7280]">{v ? new Date(v).toLocaleDateString() : 'Never'}</span>
                ),
              },
            ]}
          />
        ) : (
          <div className="text-center py-8 text-[12px] text-[#9CA3AF]">
            No API keys configured
          </div>
        )}
      </Card>

      {/* ===== UPCOMING SCHEDULED JOBS ===== */}
      {upcomingJobs.length > 0 && (
        <Card
          size="small"
          title={<span className="text-[12px] font-bold">Upcoming Scheduled Jobs</span>}
          bodyStyle={{ padding: 0 }}
          className="mt-4"
          style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}
        >
          <Table
            dataSource={upcomingJobs}
            rowKey={(r: any) => r.id || r.jobId}
            size="small"
            pagination={false}
            columns={[
              {
                title: 'JOB', dataIndex: 'name', key: 'name',
                render: (v: string) => <span className="text-[12px] font-semibold">{v}</span>,
              },
              {
                title: 'NEXT RUN', dataIndex: 'nextRunAt', key: 'nextRun',
                render: (v: string) => (
                  <span className="text-[11px] text-[#6B7280]">
                    {v ? new Date(v).toLocaleString() : 'Manual'}
                  </span>
                ),
              },
              {
                title: 'SCHEDULE', dataIndex: 'schedule', key: 'schedule',
                render: (v: string) => <code className="text-[10px] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{v || '—'}</code>,
              },
            ]}
          />
        </Card>
      )}

      {/* ===== API USAGE DETAILS ===== */}
      {apiUsage.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChartOutlined className="text-[#E8611D] text-sm" />
            <h3 className="text-[13px] font-bold m-0">API Key Usage Details</h3>
          </div>
          <Row gutter={12}>
            {apiUsage.slice(0, 4).map((u: any, i: number) => (
              <Col span={12} key={i} className="mb-3">
                <Card
                  size="small"
                  title={<span className="text-[11px] font-semibold">{u.keyName}</span>}
                  bodyStyle={{ padding: '10px 14px' }}
                  style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}
                >
                  <Row gutter={8}>
                    <Col span={8}>
                      <Statistic
                        title={<span className="text-[9px] text-[#9CA3AF]">Requests (7d)</span>}
                        value={u.stats?.totalRequests || 0}
                        valueStyle={{ fontSize: 16, fontWeight: 700 }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title={<span className="text-[9px] text-[#9CA3AF]">Errors</span>}
                        value={u.stats?.errorCount || 0}
                        valueStyle={{ fontSize: 16, fontWeight: 700, color: u.stats?.errorCount > 0 ? C.red : C.green }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title={<span className="text-[9px] text-[#9CA3AF]">Error Rate</span>}
                        value={`${u.stats?.errorRate || 0}%`}
                        valueStyle={{ fontSize: 16, fontWeight: 700, color: (u.stats?.errorRate || 0) > 5 ? C.red : C.green }}
                      />
                    </Col>
                  </Row>
                  <div className="mt-2">
                    <div className="text-[9px] text-[#9CA3AF] mb-1">Top Endpoints</div>
                    {(u.stats?.requestsByEndpoint || []).slice(0, 3).map((e: any, j: number) => (
                      <div key={j} className="flex items-center justify-between text-[10px] py-0.5">
                        <code className="text-[#6B7280]">{e.endpoint?.substring(0, 30)}{e.endpoint?.length > 30 ? '...' : ''}</code>
                        <span className="font-semibold">{e.count}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </div>
  );
}
