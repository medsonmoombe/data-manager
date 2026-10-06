import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Typography, Row, Col, message } from 'antd';
import { ReloadOutlined, ScanOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { anomaliesApi } from '../../api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';

const { Text } = Typography;

export default function AnomaliesPage() {
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [aRes, sRes]: any[] = await Promise.all([
        anomaliesApi.list(),
        anomaliesApi.getSummary(),
      ]);
      setAnomalies(aRes.data?.data || aRes.data || []);
      setSummary(sRes.data || sRes);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const triggerScan = async () => {
    try {
      await anomaliesApi.triggerScan();
      message.success('Anomaly scan started');
      setTimeout(loadData, 2000);
    } catch (err) { message.error('Scan failed'); }
  };

  const severityColors: Record<string, string> = { critical: 'red', high: 'orange', medium: 'gold', low: 'blue' };

  return (
    <div>
      <PageHeader title="Anomalies" subtitle="Detect outliers, fraud, and unusual patterns">
        <Button size="small" icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
        <Button type="primary" size="small" icon={<ScanOutlined />} onClick={triggerScan} className="!bg-[#009B3A]">Run Scan</Button>
      </PageHeader>

      {summary && (
        <Row gutter={12} className="mb-4">
          <Col span={6}><StatCard label="Total" value={summary.total || 0} color="black" /></Col>
          <Col span={6}><StatCard label="Critical" value={summary.critical || 0} color="red" /></Col>
          <Col span={6}><StatCard label="High" value={summary.high || 0} color="orange" /></Col>
          <Col span={6}><StatCard label="Medium" value={summary.medium || 0} color="blue" /></Col>
        </Row>
      )}

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={anomalies}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ size: 'small' }}
          columns={[
            { title: 'TITLE', dataIndex: 'title', key: 'title', render: (v: string) => <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{v}</span> },
            { title: 'TYPE', dataIndex: 'suggestionType', key: 'type', render: (v: string) => <Tag style={{ fontSize: 10 }}>{v}</Tag> },
            {
              title: 'SEVERITY', key: 'severity',
              render: (_: any, r: any) => {
                const sev = (r.proposedAction as any)?.severity || 'low';
                return <Tag color={severityColors[sev]} style={{ fontSize: 10 }}>{sev}</Tag>;
              },
            },
            { title: 'SCORE', dataIndex: 'confidence', key: 'score', render: (v: number) => <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{v ? Math.round(v * 100) + '%' : '—'}</span> },
            { title: 'STATUS', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'pending' ? 'orange' : 'green'} style={{ fontSize: 10 }}>{v}</Tag> },
          ]}
        />
      </Card>
    </div>
  );
}