import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Spin, Typography, Timeline, Table, Tabs, Image } from 'antd';
import { ArrowLeftOutlined, EditOutlined, ReloadOutlined, FileOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { formatFileSize, isImage } from '../../components/FileUploadField/FileUploadField';
import type { FileValue } from '../../components/FileUploadField/FileUploadField';
import api from '../../api/axios';

const { Text } = Typography;

function parseFileValue(v: any): FileValue | null {
  if (!v) return null;
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); if (p?.url) return p; } catch { return null; }
  }
  if (typeof v === 'object' && v?.url) return v;
  return null;
}

export default function RecordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res: any = await api.get(`/intelligence/profile/golden_record/${id}`);
      setProfile(res.data || res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center pt-20"><Spin size="small" /></div>;
  if (!profile) return <div className="text-center pt-20"><Text className="text-[#99A1B3]">Record not found</Text></div>;

  const data = profile.masterData || {};

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <Space size={8}>
          <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate('/records')} className="!text-[9px]">Back</Button>
          <div>
            <h2 className="font-[Space_Grotesk] text-[15px] font-bold text-[#1A1F2E] m-0">
              {data.first_name} {data.last_name}
            </h2>
            <Text className="text-[9px] text-[#99A1B3]">ID: {id?.substring(0, 12)}...</Text>
          </div>
        </Space>
        <Space size={6}>
          <Button size="small" icon={<ReloadOutlined />} onClick={loadProfile} className="!text-[9px]">Refresh</Button>
          <Button size="small" icon={<EditOutlined />} className="!text-[9px]">Edit</Button>
        </Space>
      </div>

      <Tabs
        size="small"
        defaultActiveKey="details"
        items={[
          {
            key: 'details',
            label: 'Details',
            children: (
              <Card size="small" bodyStyle={{ padding: '12px 16px' }}>
                <Descriptions size="small" column={4}
                  labelStyle={{ fontSize: 10, color: '#99A1B3', fontWeight: 500 }}
                  contentStyle={{ fontSize: 11, color: '#1A1F2E', fontWeight: 500 }}>
                  {Object.entries(data).slice(0, 16).map(([k, v]) => {
                    const fv = parseFileValue(v);
                    if (fv) {
                      const img = isImage(fv.mimeType);
                      return (
                        <Descriptions.Item key={k} label={k.replace(/_/g, ' ').toUpperCase()}>
                          <Space size={6}>
                            {img ? (
                              <Image src={fv.url} alt={fv.originalName} width={40} height={40}
                                style={{ borderRadius: 4, objectFit: 'cover' }}
                                preview={{ mask: <EyeOutlined /> }} />
                            ) : (
                              <FileOutlined style={{ fontSize: 20, color: '#6B7280' }} />
                            )}
                            <span style={{ fontSize: 11, color: '#1A1F2E' }}>{fv.originalName}</span>
                            <span style={{ fontSize: 9, color: '#99A1B3' }}>({formatFileSize(fv.size)})</span>
                            <Button type="link" size="small" icon={<DownloadOutlined />}
                              onClick={() => { const a = document.createElement('a'); a.href = fv.url; a.download = fv.originalName; a.click(); }}
                              style={{ padding: 0, height: 'auto', fontSize: 10 }} />
                          </Space>
                        </Descriptions.Item>
                      );
                    }
                    return (
                      <Descriptions.Item key={k} label={k.replace(/_/g, ' ').toUpperCase()}>
                        {String(v || '—')}
                      </Descriptions.Item>
                    );
                  })}
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'timeline',
            label: 'Timeline',
            children: (
              <Card size="small" bodyStyle={{ padding: '12px 16px' }}>
                <Timeline>
                  {(profile.timeline || []).map((e: any, i: number) => (
                    <Timeline.Item key={i} color={['green', 'blue', 'orange', 'gray'][i % 4]}>
                      <div className="text-[11px] text-[#374151]">{e.type?.replace(/_/g, ' ') || 'Event'}</div>
                      <div className="text-[9px] text-[#99A1B3]">{e.occurredAt ? new Date(e.occurredAt).toLocaleString() : ''}</div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            ),
          },
          {
            key: 'relationships',
            label: 'Relationships',
            children: (
              <Card size="small" bodyStyle={{ padding: 0 }}>
                <Table
                  dataSource={[...(profile.relationships?.outgoing || []), ...(profile.relationships?.incoming || [])]}
                  rowKey={(r: any) => r.targetRecordId || r.sourceRecordId}
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'TYPE', dataIndex: 'relationshipType', render: (v: string) => <Tag className="!text-[9px]">{v?.replace(/_/g, ' ')}</Tag> },
                    { title: 'RECORD', key: 'record', render: (_: any, r: any) => <span className="text-[10px] font-mono">{(r.targetRecordId || r.sourceRecordId)?.substring(0, 12)}...</span> },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'lineage',
            label: 'Data Lineage',
            children: (
              <Card size="small" bodyStyle={{ padding: '12px 16px' }}>
                <div className="text-[11px] text-[#5F6880]">
                  <div>Source Records: {profile.metadata?.sourceRecords || 0}</div>
                  <div>Versions: {profile.metadata?.versions || 0}</div>
                  <div>Confidence: {profile.matchConfidence ? `${Math.round(profile.matchConfidence * 100)}%` : 'N/A'}</div>
                </div>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}