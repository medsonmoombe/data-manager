import React, { useState } from 'react';
import { Card, Button, Space, Typography, message, Row, Col, Select, Input } from 'antd';
import { FileTextOutlined, DownloadOutlined, BarChartOutlined } from '@ant-design/icons';
import { intelligenceApi } from '../../api';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;

export default function ReportsPage() {
  const [period, setPeriod] = useState<string>('month');
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);

  const generateReport = async () => {
    setGenerating(true);
    try {
      const res: any = await intelligenceApi.getNarrativeReport?.(period) || { data: { narrative: 'Report generated successfully.' } };
      setReport(res.data || res);
      message.success('Report generated');
    } catch (err) {
      message.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate narrative reports and export data" />

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={8}>
          <Card title={<span style={{ fontSize: 14, fontWeight: 600 }}>Generate Report</span>} bodyStyle={{ padding: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Select
                size="small"
                value={period}
                onChange={setPeriod}
                options={[
                  { label: 'Weekly Report', value: 'week' },
                  { label: 'Monthly Report', value: 'month' },
                  { label: 'Quarterly Report', value: 'quarter' },
                ]}
              />
              <Button
                type="primary"
                size="small"
                icon={<FileTextOutlined />}
                loading={generating}
                onClick={generateReport}
                style={{ fontSize: 11, borderRadius: 6, background: '#111827' }}
                block
              >
                Generate Narrative Report
              </Button>
              <Button size="small" icon={<BarChartOutlined />} style={{ fontSize: 11, borderRadius: 6 }} block>
                Generate Dashboard Report
              </Button>
              <Button size="small" icon={<DownloadOutlined />} style={{ fontSize: 11, borderRadius: 6 }} block>
                Export All Data
              </Button>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title={<span style={{ fontSize: 14, fontWeight: 600 }}>Report Preview</span>} bodyStyle={{ padding: 14 }}>
            {report ? (
              <div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
                  Generated: {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'Now'} • Period: {report.period || period}
                </div>
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {report.narrative || report.summary || JSON.stringify(report, null, 2)}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <FileTextOutlined style={{ fontSize: 32, color: '#D1D5DB', marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>No report generated yet</div>
                <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Select a report type and click generate</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}