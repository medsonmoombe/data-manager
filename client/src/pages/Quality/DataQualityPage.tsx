import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Typography, Row, Col, Progress } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../../api/axios';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';

const { Text } = Typography;

export default function DataQualityPage() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryRes, resultsRes, rulesRes]: any[] = await Promise.all([
        api.get('/validation/summary'),
        api.get('/validation/results', { params: { status: 'open' } }),
        api.get('/validation/rules'),
      ]);
      setSummary(summaryRes.data || summaryRes);
      setResults(resultsRes.data || resultsRes || []);
      setRules(rulesRes.data || rulesRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const score = summary?.dataQualityScore || 100;

  return (
    <div>
      <PageHeader title="Data Quality" subtitle="Monitor and improve data quality">
        <Button size="small" icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
      </PageHeader>

      {/* Score Cards */}
      <Row gutter={12} className="mb-4">
        <Col span={6}>
          <Card bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Progress type="circle" percent={score} size={60} strokeColor={score > 80 ? '#16A34A' : score > 50 ? '#EA580C' : '#DC2626'} format={(p) => `${p}%`} />
            <div className="font-heading text-sm font-bold text-[#1A1F2E] mt-2">Quality Score</div>
          </Card>
        </Col>
        <Col span={6}><StatCard label="Active Rules" value={summary?.totalRules || 0} color="black" /></Col>
        <Col span={6}><StatCard label="Open Issues" value={summary?.openIssues || 0} color="red" /></Col>
        <Col span={6}><StatCard label="Fixed Issues" value={summary?.fixedIssues || 0} color="green" /></Col>
      </Row>

      {/* Issues & Rules */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={14}>
          <Card title={<span style={{ fontSize: 14, fontWeight: 600 }}>Open Issues</span>} bodyStyle={{ padding: 0 }}>
            <Table
              dataSource={results.slice(0, 20)}
              rowKey="id"
              size="small"
              loading={loading}
              pagination={false}
              columns={[
                { title: 'FIELD', dataIndex: 'fieldName', key: 'field', render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{v}</span> },
                { title: 'VALUE', dataIndex: 'currentValue', key: 'value', render: (v: string) => <span style={{ fontSize: 12, color: '#6B7280' }}>{v || '—'}</span> },
                { title: 'RULE', key: 'rule', render: (_: any, r: any) => <span style={{ fontSize: 11, color: '#6B7280' }}>{r.rule?.name}</span> },
                {
                  title: '', key: 'actions', width: 80,
                  render: (_: any, r: any) => (
                    <Space size={4}>
                      <Button size="small" type="link" onClick={() => api.post(`/validation/results/${r.id}/fix`)} style={{ fontSize: 10, padding: 0, color: '#16A34A' }}>Fix</Button>
                      <Button size="small" type="link" onClick={() => api.post(`/validation/results/${r.id}/ignore`)} style={{ fontSize: 10, padding: 0, color: '#9CA3AF' }}>Ignore</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<span style={{ fontSize: 14, fontWeight: 600 }}>Validation Rules</span>} bodyStyle={{ padding: 0 }}>
            <Table
              dataSource={rules}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'RULE', dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{v}</span> },
                { title: 'ENTITY', dataIndex: 'targetEntity', key: 'entity', render: (v: string) => <span style={{ fontSize: 11, color: '#6B7280' }}>{v}</span> },
                { title: '', dataIndex: 'severity', key: 'severity', width: 60, render: (v: string) => <Tag color={v === 'error' ? 'red' : 'orange'} style={{ fontSize: 10 }}>{v}</Tag> },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}