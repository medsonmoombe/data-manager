import React, { useEffect, useState } from 'react';
import { Card, Button, Space, Typography, Row, Col, Tag, Modal, message, Spin } from 'antd';
import { ReloadOutlined, DownloadOutlined, CheckCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { marketplaceApi } from '../../api/marketplace.api';

const { Text } = Typography;

export default function MarketplacePage() {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [installed, setInstalled] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tRes, iRes, cRes]: any[] = await Promise.all([
        marketplaceApi.listTemplates(),
        marketplaceApi.getInstalled(),
        marketplaceApi.getCategories(),
      ]);
      setTemplates(tRes.data || tRes || []);
      setInstalled(iRes.data || iRes || []);
      setCategories(cRes.data || cRes || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const installTemplate = async (id: string) => {
    setInstalling(id);
    try {
      await marketplaceApi.installTemplate(id);
      message.success('Template installed! Check your dashboards and forms.');
      loadData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to install');
    } finally {
      setInstalling(null);
    }
  };

  const isInstalled = (templateId: string) => installed.some((i: any) => i.templateId === templateId);

  const filtered = selectedCategory === 'all' ? templates : templates.filter((t) => t.category === selectedCategory);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="small" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>Marketplace</h2>
          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Install templates and extensions for your organization</Text>
        </div>
        <Button size="small" icon={<ReloadOutlined />} onClick={loadData} style={{ fontSize: 11, borderRadius: 6 }}>Refresh</Button>
      </div>

      {/* Category filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Button
          size="small"
          type={selectedCategory === 'all' ? 'primary' : 'default'}
          onClick={() => setSelectedCategory('all')}
          style={{ fontSize: 11, borderRadius: 6, background: selectedCategory === 'all' ? '#111827' : undefined }}
        >
          All ({templates.length})
        </Button>
        {categories.map((c: any) => (
          <Button
            key={c.category}
            size="small"
            type={selectedCategory === c.category ? 'primary' : 'default'}
            onClick={() => setSelectedCategory(c.category)}
            style={{ fontSize: 11, borderRadius: 6, background: selectedCategory === c.category ? '#111827' : undefined }}
          >
            {c.category} ({c.count})
          </Button>
        ))}
      </div>

      <Row gutter={[12, 12]}>
        {filtered.map((template) => (
          <Col xs={24} sm={12} lg={8} key={template.id}>
            <Card
              size="small"
              bodyStyle={{ padding: 14 }}
              title={
                <Space size={8}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{template.name}</span>
                  {template.isOfficial && <Tag color="blue" style={{ fontSize: 9 }}>Official</Tag>}
                </Space>
              }
            >
              <Text style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 10, lineHeight: 1.5 }}>
                {template.description}
              </Text>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                {(template.includes || []).slice(0, 6).map((inc: any, i: number) => (
                  <Tag key={i} style={{ fontSize: 9, borderRadius: 4, padding: '0 6px', lineHeight: '16px' }}>
                    {inc.type}: {inc.name}
                  </Tag>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size={4}>
                  <Text style={{ fontSize: 10, color: '#9CA3AF' }}>v{template.version}</Text>
                  <Text style={{ fontSize: 10, color: '#9CA3AF' }}>•</Text>
                  <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{template.downloads || 0} installs</Text>
                </Space>
                {isInstalled(template.id) ? (
                  <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontSize: 10, margin: 0 }}>Installed</Tag>
                ) : (
                  <Button
                    size="small"
                    type="primary"
                    icon={<DownloadOutlined />}
                    loading={installing === template.id}
                    onClick={() => installTemplate(template.id)}
                    style={{ fontSize: 10, borderRadius: 6, background: '#111827', height: 24 }}
                  >
                    Install
                  </Button>
                )}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {filtered.length === 0 && (
        <Card bodyStyle={{ padding: 40, textAlign: 'center' }}>
          <Text style={{ fontSize: 13, color: '#9CA3AF' }}>No templates found in this category.</Text>
        </Card>
      )}
    </div>
  );
}