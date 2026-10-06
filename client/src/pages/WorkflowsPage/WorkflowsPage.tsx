import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Card, Typography, Modal, Input, Select, Tabs, message, Row, Col, Tooltip, Drawer, Descriptions } from 'antd';
import { PlusOutlined, ReloadOutlined, PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { workflowsApi, entitiesApi, usersApi } from '../../api';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;

export default function WorkflowsPage() {
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newWf, setNewWf] = useState({ name: '', description: '', triggerType: 'manual', entityName: '', steps: [] as any[] });
  const [entities, setEntities] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  // Selection & bulk
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState<{ taskIds: string[]; action: 'approve' | 'reject' } | null>(null);

  // View task detail
  const [viewingTask, setViewingTask] = useState<any | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [wfRes, tasksRes, instRes, entRes, rolesRes]: any[] = await Promise.all([
        workflowsApi.listDefinitions(),
        workflowsApi.getMyTasks(),
        workflowsApi.listInstances(),
        entitiesApi.list(),
        usersApi.getRoles().catch(() => ({ data: [] })),
      ]);
      setWorkflows(wfRes.data || wfRes || []);
      setTasks(tasksRes.data?.data || tasksRes.data || tasksRes || []);
      setInstances(instRes.data || instRes || []);
      setEntities(entRes.data || entRes || []);
      setRoles(rolesRes.data || rolesRes || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const doApprove = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      await workflowsApi.approveTask(taskId);
      message.success('Task approved');
      setSelectedRowKeys((prev) => prev.filter((k) => k !== taskId));
      loadAll();
    } catch (err) { message.error('Failed to approve'); }
    finally { setActionLoading(null); }
  };

  const doReject = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      await workflowsApi.rejectTask(taskId);
      message.success('Task rejected');
      setSelectedRowKeys((prev) => prev.filter((k) => k !== taskId));
      loadAll();
    } catch (err) { message.error('Failed to reject'); }
    finally { setActionLoading(null); }
  };

  const doBulkApprove = async () => {
    if (!confirmModal) return;
    setBulkLoading(true);
    try {
      const res: any = await workflowsApi.bulkApprove(confirmModal.taskIds);
      const data = res.data || res;
      message.success(`${data.approved} task(s) approved${data.failed > 0 ? `, ${data.failed} failed` : ''}`);
      setConfirmModal(null);
      setSelectedRowKeys([]);
      loadAll();
    } catch (err) { message.error('Bulk approve failed'); }
    finally { setBulkLoading(false); }
  };

  const addStep = () => {
    setNewWf({
      ...newWf,
      steps: [...newWf.steps, { id: `step_${Date.now()}`, type: 'approval', name: '', config: { assigneeRole: 'admin' }, nextStep: null }],
    });
  };

  const createWorkflow = async () => {
    if (!newWf.name) { message.warning('Workflow name is required'); return; }
    if (newWf.triggerType === 'event' && !newWf.entityName) { message.warning('Entity name is required for event-triggered workflows'); return; }

    const steps = newWf.steps.map((step, i) => ({
      ...step,
      nextStep: newWf.steps[i + 1]?.id ?? null,
    }));

    const payload = {
      name: newWf.name,
      description: newWf.description,
      triggerType: newWf.triggerType,
      triggerConfig: newWf.triggerType === 'event'
        ? { event: 'record.created', entityName: newWf.entityName }
        : {},
      steps,
    };

    try {
      await workflowsApi.createDefinition(payload);
      message.success('Workflow created');
      setShowCreate(false);
      setNewWf({ name: '', description: '', triggerType: 'manual', entityName: '', steps: [] });
      loadAll();
    } catch (err) { message.error('Failed to create workflow'); }
  };

  const taskColumns = [
    { title: 'TASK', dataIndex: 'taskName', key: 'task', render: (v: string) => <span style={{ fontWeight: 500, color: '#111827', fontSize: 12 }}>{v}</span> },
    {
      title: 'RECORD', key: 'record', width: 140,
      render: (_: any, r: any) => {
        const recordId = r.instance?.triggerData?.recordId;
        const entityName = r.instance?.triggerData?.entityName;
        if (recordId && entityName) {
          return (
            <a href={`/records/${entityName}/${recordId}`} style={{ fontSize: 11, color: '#2563EB' }}>
              {entityName.replace(/_/g, ' ')} / {recordId.slice(0, 8)}...
            </a>
          );
        }
        return <span style={{ fontSize: 11, color: '#9CA3AF' }}>—</span>;
      },
    },
    { title: 'WORKFLOW', key: 'wf', render: (_: any, r: any) => <span style={{ fontSize: 11, color: '#6B7280' }}>{r.instance?.definition?.name || '—'}</span> },
    { title: 'ASSIGNED TO', key: 'assignee', render: (_: any, r: any) => <span style={{ fontSize: 11, color: '#6B7280' }}>{(r.assigneeRole || '').replace(/_/g, ' ') || 'Anyone'}</span> },
    { title: 'STATUS', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'completed' ? 'green' : 'orange'} style={{ fontSize: 10 }}>{v}</Tag> },
    {
      title: '', key: 'actions', width: 140,
      render: (_: any, r: any) =>
        r.status === 'pending' ? (
          <Space size={2}>
            <Tooltip title="View details">
              <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => setViewingTask(r)} style={{ fontSize: 10, color: '#6B7280' }} />
            </Tooltip>
            <Button size="small" type="text" icon={<CheckCircleOutlined />}
              loading={actionLoading === r.id}
              onClick={() => setConfirmModal({ taskIds: [r.id], action: 'approve' })}
              style={{ fontSize: 10, color: '#16A34A' }} />
            <Button size="small" type="text" icon={<CloseCircleOutlined />}
              loading={actionLoading === r.id}
              onClick={() => setConfirmModal({ taskIds: [r.id], action: 'reject' })}
              style={{ fontSize: 10, color: '#DC2626' }} />
          </Space>
        ) : (
          <Tag color="green" style={{ fontSize: 10 }}>{r.status}</Tag>
        ),
    },
  ];

  const wfColumns = [
    { title: 'NAME', dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 500, color: '#111827', fontSize: 12 }}>{v}</span> },
    {
      title: 'TRIGGER', key: 'trigger',
      render: (_: any, r: any) => {
        const config = r.triggerConfig || {};
        const isMisconfigured = r.triggerType === 'event' && !config.entityName;
        return (
          <Space size={4}>
            <Tag style={{ fontSize: 10 }}>{r.triggerType}</Tag>
            {config.entityName && <Tag color="blue" style={{ fontSize: 10 }}>{config.entityName}</Tag>}
            {isMisconfigured && (
              <Tag color="red" style={{ fontSize: 10 }} title="No entity name set — this workflow will fire for ALL entities">
                ⚠ No entity set
              </Tag>
            )}
          </Space>
        );
      },
    },
    { title: 'STEPS', key: 'steps', render: (_: any, r: any) => <span style={{ fontSize: 11, color: '#6B7280' }}>{(r.steps || []).length} step(s)</span> },
    { title: 'ACTIVE', dataIndex: 'isActive', key: 'active', render: (v: boolean) => v ? <Tag color="green" style={{ fontSize: 10 }}>Active</Tag> : <Tag style={{ fontSize: 10 }}>Inactive</Tag> },
    {
      title: '', key: 'actions', width: 60,
      render: (_: any, r: any) => (
        <Button size="small" type="link" icon={<PlayCircleOutlined />} onClick={() => workflowsApi.startWorkflow(r.id, { variables: {} }).then(() => { message.success('Started'); loadAll(); })} style={{ fontSize: 10, padding: 0 }} />
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Workflows" subtitle="Automate processes, approvals, and notifications">
        <Button size="small" icon={<ReloadOutlined />} onClick={loadAll}>Refresh</Button>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setShowCreate(true)} className="!bg-[#009B3A]">New Workflow</Button>
      </PageHeader>

      <Tabs
        size="small"
        defaultActiveKey="tasks"
        items={[
          {
            key: 'tasks',
            label: `Pending Approvals (${tasks.length})`,
            children: (
              <Card bodyStyle={{ padding: 0 }}>
                {selectedRowKeys.length > 0 && (
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>{selectedRowKeys.length} selected</Text>
                    <Button size="small" type="primary" icon={<CheckSquareOutlined />}
                      loading={bulkLoading}
                      onClick={() => setConfirmModal({ taskIds: selectedRowKeys as string[], action: 'approve' })}
                      style={{ fontSize: 10, borderRadius: 6, background: '#16A34A', borderColor: '#16A34A' }}>
                      Bulk Approve
                    </Button>
                    <Button size="small" onClick={() => setSelectedRowKeys([])} style={{ fontSize: 10, borderRadius: 6 }}>Clear</Button>
                  </div>
                )}
                <Table
                  rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys.filter((k) => tasks.find((t: any) => t.id === k && t.status === 'pending'))),
                    getCheckboxProps: (r: any) => ({ disabled: r.status !== 'pending' }),
                  }}
                  dataSource={tasks} rowKey="id" size="small" columns={taskColumns} pagination={false} />
              </Card>
            ),
          },
          {
            key: 'definitions',
            label: `Definitions (${workflows.length})`,
            children: (
              <Card bodyStyle={{ padding: 0 }}>
                <Table dataSource={workflows} rowKey="id" loading={loading} size="small" columns={wfColumns} pagination={{ size: 'small' }} />
              </Card>
            ),
          },
          {
            key: 'instances',
            label: 'Instances',
            children: (
              <Card bodyStyle={{ padding: 0 }}>
                <Table
                  dataSource={instances}
                  rowKey="id"
                  size="small"
                  pagination={{ size: 'small' }}
                  columns={[
                    { title: 'WORKFLOW', key: 'wf', render: (_: any, r: any) => <span style={{ fontSize: 12, fontWeight: 500 }}>{r.definition?.name}</span> },
                    { title: 'STATUS', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'completed' ? 'green' : v === 'failed' ? 'red' : 'blue'} style={{ fontSize: 10 }}>{v}</Tag> },
                    { title: 'STARTED', dataIndex: 'startedAt', key: 'started', render: (v: string) => <span style={{ fontSize: 11, color: '#6B7280' }}>{v ? new Date(v).toLocaleString() : '—'}</span> },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Confirm Action Modal */}
      <Modal
        title={confirmModal?.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
        open={!!confirmModal}
        onOk={confirmModal?.action === 'approve' ? doBulkApprove : undefined}
        onCancel={() => setConfirmModal(null)}
        okText={confirmModal?.action === 'approve' ? 'Approve' : 'Reject'}
        okButtonProps={{
          danger: confirmModal?.action === 'reject',
          loading: bulkLoading,
          style: confirmModal?.action === 'approve' ? { background: '#16A34A', borderColor: '#16A34A' } : undefined,
        }}
        width={400}
      >
        <Text style={{ fontSize: 13 }}>
          {confirmModal?.taskIds.length === 1
            ? `Are you sure you want to ${confirmModal?.action} this task?`
            : `Are you sure you want to ${confirmModal?.action} ${confirmModal?.taskIds.length} selected tasks?`
          }
        </Text>
      </Modal>

      {/* View Task Detail Drawer */}
      <Drawer
        title={<span style={{ fontWeight: 600, fontSize: 14 }}>Task Details</span>}
        open={!!viewingTask}
        onClose={() => setViewingTask(null)}
        width="50%"
        extra={
          <Button type="text" onClick={() => setViewingTask(null)} style={{ fontSize: 12 }}>
            Close
          </Button>
        }
      >
        {viewingTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Task Name" labelStyle={{ fontSize: 11, color: '#6B7280' }} contentStyle={{ fontSize: 12 }}>
                {viewingTask.taskName}
              </Descriptions.Item>
              <Descriptions.Item label="Workflow" labelStyle={{ fontSize: 11, color: '#6B7280' }} contentStyle={{ fontSize: 12 }}>
                {viewingTask.instance?.definition?.name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Assigned To" labelStyle={{ fontSize: 11, color: '#6B7280' }} contentStyle={{ fontSize: 12 }}>
                {(viewingTask.assigneeRole || '').replace(/_/g, ' ') || 'Anyone'}
              </Descriptions.Item>
              <Descriptions.Item label="Status" labelStyle={{ fontSize: 11, color: '#6B7280' }} contentStyle={{ fontSize: 12 }}>
                <Tag color={viewingTask.status === 'completed' ? 'green' : 'orange'} style={{ fontSize: 10 }}>{viewingTask.status}</Tag>
              </Descriptions.Item>
              {viewingTask.instance?.triggerData?.entityName && (
                <Descriptions.Item label="Entity" labelStyle={{ fontSize: 11, color: '#6B7280' }} contentStyle={{ fontSize: 12 }}>
                  {viewingTask.instance.triggerData.entityName.replace(/_/g, ' ')}
                </Descriptions.Item>
              )}
              {viewingTask.instance?.triggerData?.recordId && (
                <Descriptions.Item label="Record ID" labelStyle={{ fontSize: 11, color: '#6B7280' }} contentStyle={{ fontSize: 12 }}>
                  <a href={`/records/${viewingTask.instance.triggerData.entityName}/${viewingTask.instance.triggerData.recordId}`}>
                    {viewingTask.instance.triggerData.recordId}
                  </a>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Created" labelStyle={{ fontSize: 11, color: '#6B7280' }} contentStyle={{ fontSize: 12 }}>
                {viewingTask.createdAt ? new Date(viewingTask.createdAt).toLocaleString() : '—'}
              </Descriptions.Item>
            </Descriptions>

            {viewingTask.instance?.triggerData?.data && Object.keys(viewingTask.instance.triggerData.data).length > 0 && (
              <>
                <Typography.Title level={5} style={{ fontSize: 13, marginTop: 8, marginBottom: 4 }}>Record Data</Typography.Title>
                <Descriptions column={1} bordered size="small">
                  {Object.entries(viewingTask.instance.triggerData.data)
                    .filter(([key]) => !key.startsWith('_'))
                    .map(([key, value]) => (
                      <Descriptions.Item label={key} labelStyle={{ fontSize: 11, color: '#6B7280' }} contentStyle={{ fontSize: 12 }} key={key}>
                        {String(value ?? '')}
                      </Descriptions.Item>
                    ))}
                </Descriptions>
              </>
            )}

            {viewingTask.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12, borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                <Button icon={<CheckCircleOutlined />} loading={actionLoading === viewingTask.id}
                  onClick={() => { setViewingTask(null); setConfirmModal({ taskIds: [viewingTask.id], action: 'approve' }); }}
                  style={{ background: '#16A34A', borderColor: '#16A34A', color: '#fff', fontSize: 12 }}>
                  Approve
                </Button>
                <Button icon={<CloseCircleOutlined />} loading={actionLoading === viewingTask.id}
                  onClick={() => { setViewingTask(null); setConfirmModal({ taskIds: [viewingTask.id], action: 'reject' }); }}
                  danger style={{ fontSize: 12 }}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Create Workflow Modal */}
      <Modal title="Create Workflow" open={showCreate} onOk={createWorkflow} onCancel={() => setShowCreate(false)} okText="Create" width={700}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <Input size="large" placeholder="Workflow name" value={newWf.name} onChange={(e) => setNewWf({ ...newWf, name: e.target.value })} />
          <Input size="large" placeholder="Description" value={newWf.description} onChange={(e) => setNewWf({ ...newWf, description: e.target.value })} />
          <Select
            size="large"
            value={newWf.triggerType}
            onChange={(v) => setNewWf({ ...newWf, triggerType: v })}
            options={[
              { label: 'Manual', value: 'manual' },
              { label: 'Event (record created)', value: 'event' },
              { label: 'Schedule', value: 'schedule' },
            ]}
          />
          {newWf.triggerType === 'event' && (
            <div>
              <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Entity <span style={{ color: '#EF4444' }}>*</span>
              </div>
              <Select
                size="large"
                style={{ width: '100%' }}
                placeholder="Select entity to watch"
                value={newWf.entityName || undefined}
                onChange={(v) => setNewWf({ ...newWf, entityName: v })}
                options={entities.map((e: any) => ({
                  label: e.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                  value: e.name,
                }))}
              />
              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>
                Workflow will auto-start whenever a record of this entity type is created.
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: 600 }}>Steps</Text>
            <Button size="small" icon={<PlusOutlined />} onClick={addStep} style={{ fontSize: 10, borderRadius: 6 }}>Add Step</Button>
          </div>
          {newWf.steps.map((step, i) => (
            <Card key={step.id} size="small" bodyStyle={{ padding: 8 }}>
              <Row gutter={[8, 4]} align="middle">
                <Col span={8}>
                  <Input size="large" placeholder="Step name" value={step.name} onChange={(e) => {
                    const steps = [...newWf.steps];
                    steps[i].name = e.target.value;
                    setNewWf({ ...newWf, steps });
                  }} style={{ fontSize: 11 }} />
                </Col>
                <Col span={6}>
                  <Select size="small" value={step.type} onChange={(v) => {
                    const steps = [...newWf.steps];
                    steps[i].type = v;
                    setNewWf({ ...newWf, steps });
                  }} style={{ width: '100%', fontSize: 11 }}
                    options={[
                      { label: 'Approval', value: 'approval' },
                      { label: 'Notification', value: 'notification' },
                      { label: 'Script', value: 'script' },
                      { label: 'Wait', value: 'wait' },
                    ]}
                  />
                </Col>
                <Col span={8}>
                  <Select size="large" placeholder="Assign to role" value={step.config?.assigneeRole || undefined} onChange={(v) => {
                    const steps = [...newWf.steps];
                    steps[i].config = { ...steps[i].config, assigneeRole: v };
                    setNewWf({ ...newWf, steps });
                  }} style={{ width: '100%', fontSize: 11 }}
                    options={[
                      ...roles.map((r: any) => ({
                        label: (r.name || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                        value: r.name,
                      })),
                    ]}
                  />
                </Col>
                <Col span={2} style={{ textAlign: 'right' }}>
                  <Button size="small" type="text" danger onClick={() => {
                    setNewWf({ ...newWf, steps: newWf.steps.filter((_, j) => j !== i) });
                  }} style={{ fontSize: 10 }}>✕</Button>
                </Col>
              </Row>
            </Card>
          ))}
        </div>
      </Modal>
    </div>
  );
}
