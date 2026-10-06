import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Slider, Space, Tag, message, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExperimentOutlined } from '@ant-design/icons';
import { matchingRulesApi } from '../../api';

interface MatchingRule {
  id: string;
  name: string;
  entityDefinition: { id: string; name: string };
  ruleType: string;
  fieldWeights: Record<string, number>;
  threshold: number;
  isActive: boolean;
}

export default function MatchingRulesTab() {
  const [rules, setRules] = useState<MatchingRule[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MatchingRule | null>(null);
  const [form] = Form.useForm();
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ score: number; isMatch: boolean; threshold: number } | null>(null);
  const [selectedRule, setSelectedRule] = useState<MatchingRule | null>(null);
  const [sourceData, setSourceData] = useState('');
  const [targetData, setTargetData] = useState('');

  const loadRules = async () => {
    setLoading(true);
    try {
      const res: any = await matchingRulesApi.list();
      setRules(res?.data || res || []);
    } catch {
      message.error('Failed to load matching rules');
    } finally {
      setLoading(false);
    }
  };

  const loadEntities = async () => {
    try {
      const res: any = await matchingRulesApi.getEntities();
      setEntities(res?.data || res || []);
    } catch {
      console.error('Failed to load entities');
    }
  };

  useEffect(() => {
    loadRules();
    loadEntities();
  }, []);

  const handleCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ ruleType: 'fuzzy', threshold: 0.85 });
    setModalOpen(true);
  };

  const handleEdit = (rule: MatchingRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      entityDefinitionId: rule.entityDefinition.id,
      name: rule.name,
      ruleType: rule.ruleType,
      threshold: rule.threshold,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingRule) {
        await matchingRulesApi.update(editingRule.id, {
          name: values.name,
          threshold: values.threshold,
          fieldWeights: values.fieldWeights || {},
          isActive: values.isActive,
        });
        message.success('Rule updated');
      } else {
        await matchingRulesApi.create({
          entityDefinitionId: values.entityDefinitionId,
          name: values.name,
          ruleType: values.ruleType,
          fieldWeights: values.fieldWeights || {},
          threshold: values.threshold,
        });
        message.success('Rule created');
      }
      setModalOpen(false);
      loadRules();
    } catch {
      message.error('Failed to save rule');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await matchingRulesApi.delete(id);
      message.success('Rule deleted');
      loadRules();
    } catch {
      message.error('Failed to delete rule');
    }
  };

  const handleTest = (rule: MatchingRule) => {
    setSelectedRule(rule);
    setTestModalOpen(true);
    setTestResult(null);
    setSourceData('');
    setTargetData('');
  };

  const runTest = async () => {
    if (!selectedRule) return;
    try {
      const res: any = await matchingRulesApi.test(selectedRule.id, {
        sourceData: JSON.parse(sourceData),
        targetData: JSON.parse(targetData),
      });
      setTestResult(res?.data || res);
    } catch {
      message.error('Invalid JSON data or test failed');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Entity', key: 'entity', render: (_: any, r: MatchingRule) => r.entityDefinition?.name || '-' },
    { title: 'Type', dataIndex: 'ruleType', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Threshold', key: 'threshold', render: (_: any, r: MatchingRule) => `${Math.round(r.threshold * 100)}%` },
    {
      title: 'Status', dataIndex: 'isActive', key: 'active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions', key: 'actions',
      render: (_: any, r: MatchingRule) => (
        <Space>
          <Button size="small" icon={<ExperimentOutlined />} onClick={() => handleTest(r)}>Test</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
          <Popconfirm title="Delete this rule?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#6B7280' }}>Configure how the system detects duplicate records</span>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreate}>Create Rule</Button>
      </div>

      <Table dataSource={rules} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} size="small" />

      <Modal
        title={editingRule ? 'Edit Matching Rule' : 'Create Matching Rule'}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="entityDefinitionId" label="Entity" rules={[{ required: true }]}>
            <Select placeholder="Select entity" size="small">
              {entities.map(e => <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="Rule Name" rules={[{ required: true }]}>
            <Input placeholder="e.g., Person Name + NRC Match" size="small" />
          </Form.Item>
          <Form.Item name="ruleType" label="Match Type">
            <Select size="small">
              <Select.Option value="exact">Exact Match</Select.Option>
              <Select.Option value="fuzzy">Fuzzy Match</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="threshold" label="Match Threshold">
            <Slider min={0} max={1} step={0.01} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Test Rule: ${selectedRule?.name}`}
        open={testModalOpen}
        onCancel={() => setTestModalOpen(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Source Data (JSON):</div>
          <Input.TextArea rows={4} value={sourceData} onChange={e => setSourceData(e.target.value)} placeholder='{"first_name": "John", "last_name": "Phiri", "nrc": "123456"}' />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Target Data (JSON):</div>
          <Input.TextArea rows={4} value={targetData} onChange={e => setTargetData(e.target.value)} placeholder='{"first_name": "Jon", "last_name": "Phiri", "nrc": "123456"}' />
        </div>
        <Button type="primary" size="small" onClick={runTest}>Calculate Match</Button>
        {testResult && (
          <div style={{ marginTop: 16, padding: 12, background: testResult.isMatch ? '#EAF7EF' : '#FEF3C7', borderRadius: 8 }}>
            <div style={{ fontSize: 12 }}>Match Score: <strong>{Math.round(testResult.score * 100)}%</strong></div>
            <div style={{ fontSize: 12 }}>Threshold: {Math.round(testResult.threshold * 100)}%</div>
            <div style={{ fontSize: 12 }}>Result: <Tag color={testResult.isMatch ? 'green' : 'orange'}>{testResult.isMatch ? 'MATCH' : 'NOT A MATCH'}</Tag></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
