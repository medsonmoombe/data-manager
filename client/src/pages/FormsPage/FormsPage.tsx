import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, Input, Tabs, message, Tooltip, Select } from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, SendOutlined,
  EyeOutlined, FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined,
  FormOutlined,
} from '@ant-design/icons';
import { formsApi } from '../../api';
import api from '../../api/axios';
import FormBuilder from '../../components/FormBuilder/FormBuilder';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

export default function FormsPage() {
  const [loading, setLoading] = useState(false);
  const [forms, setForms] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingForm, setEditingForm] = useState<any>(null);
  const [viewingSubmissions, setViewingSubmissions] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedEntityForForm, setSelectedEntityForForm] = useState('');
  const [entities, setEntities] = useState<any[]>([]);
  const [newForm, setNewForm] = useState({ name: '', description: '' });

  const loadForms = async () => {
    setLoading(true);
    try {
      const res: any = await formsApi.list();
      let data = res;
      if (res?.success === true && res.data) data = res.data;
      if (data?.data && Array.isArray(data.data)) data = data.data;
      const allForms = Array.isArray(data) ? data : [];
      console.log('Forms loaded:', allForms.length, allForms.map((f: any) => f.name));
      setForms(allForms);
    } catch (err) { console.error('Failed to load forms:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadForms(); }, []);

  const handleOpenCreate = async () => {
    try {
      const res: any = await api.get('/entities');
      setEntities(res.data || res || []);
    } catch (err) { console.error(err); }
    setShowCreate(true);
  };

  const createForm = async () => {
    if (!newForm.name) { message.warning('Form name required'); return; }
    try {
      let formSchema: any = { fields: [] };
      if (selectedEntityForForm) {
        const entity = entities.find((e: any) => e.id === selectedEntityForForm);
        if (entity?.attributes) {
          formSchema.fields = entity.attributes.map((a: any) => ({
            name: a.name,
            type: a.dataType === 'number' ? 'number' : a.dataType === 'date' ? 'date' : a.dataType === 'boolean' ? 'boolean' : 'text',
            required: a.isRequired,
            label: a.displayName || a.name.replace(/_/g, ' '),
            options: a.options || undefined,
          }));
        }
      }
      await formsApi.create({ name: newForm.name, description: newForm.description, formSchema });
      const createdForm: any = await formsApi.list();
      let allForms: any[] = createdForm?.data?.data || createdForm?.data || createdForm || [];
      if (!Array.isArray(allForms)) allForms = [];
      const form = allForms.find((f: any) => f.name === newForm.name);
      if (form) await formsApi.publish(form.id);
      message.success('Form created & published!');
      setShowCreate(false);
      setNewForm({ name: '', description: '' });
      setSelectedEntityForForm('');
      loadForms();
    } catch (err) { message.error('Failed to create form'); }
  };

  const publishForm = async (id: string) => {
    try {
      await formsApi.publish(id);
      message.success('Form published');
      loadForms();
    } catch (err) { message.error('Failed to publish'); }
  };

  const deleteForm = async (id: string) => {
    Modal.confirm({
      title: 'Delete form?',
      okText: 'Delete',
      cancelText: 'Cancel',
      okButtonProps: { danger: true, size: 'small' },
      onOk: async () => {
        await formsApi.delete(id);
        message.success('Form deleted');
        loadForms();
      },
    });
  };

  const loadSubmissions = async (formId: string) => {
    try {
      const res: any = await formsApi.getSubmissions(formId);
      setSubmissions(res.data?.data || res.data || []);
    } catch (err) { console.error(err); }
  };

  const columns = [
    {
      title: 'NAME', dataIndex: 'name', key: 'name',
      render: (v: string) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[7px] bg-[rgba(0,155,58,0.08)] flex items-center justify-center text-[#009B3A] text-xs flex-shrink-0">
            <FormOutlined />
          </div>
          <span className="font-semibold text-[#1A1F2E] text-[12px]">{v}</span>
        </div>
      ),
    },
    {
      title: 'DESCRIPTION', dataIndex: 'description', key: 'description',
      render: (v: string) => <span className="text-[11px] text-[#99A1B3]">{v || '—'}</span>,
    },
    {
      title: 'STATUS', dataIndex: 'status', key: 'status',
      render: (v: string) => (
        v === 'published'
          ? <Tag icon={<CheckCircleOutlined />} className="!text-[9px] !px-2 !py-0.5 !rounded-full !border-none !m-0" style={{ background: 'rgba(0,155,58,0.1)', color: '#009B3A' }}>Published</Tag>
          : <Tag icon={<ClockCircleOutlined />} className="!text-[9px] !px-2 !py-0.5 !rounded-full !border-none !m-0" style={{ background: 'rgba(232,97,29,0.1)', color: '#E8611D' }}>Draft</Tag>
      ),
    },
    {
      title: 'SUBMISSIONS', key: 'submissions',
      render: (_: any, r: any) => (
        <Button type="link" size="small"
          onClick={() => { setViewingSubmissions(r); loadSubmissions(r.id); }}
          className="!text-[11px] !text-[#009B3A] !p-0 !font-semibold">
          {r._count?.submissions || 0}
        </Button>
      ),
    },
    {
      title: '', key: 'actions', width: 140,
      render: (_: any, r: any) => (
        <Space size={2}>
          <Tooltip title="Edit">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditingForm(r)}
              className="!text-[#5F6880] !text-xs" />
          </Tooltip>
          {r.status === 'draft' && (
            <Tooltip title="Publish">
              <Button size="small" type="text" icon={<SendOutlined />} onClick={() => publishForm(r.id)}
                className="!text-[#009B3A] !text-xs" />
            </Tooltip>
          )}
          <Tooltip title="Submissions">
            <Button size="small" type="text" icon={<EyeOutlined />}
              onClick={() => { setViewingSubmissions(r); loadSubmissions(r.id); }}
              className="!text-[#5F6880] !text-xs" />
          </Tooltip>
          <Tooltip title="Delete">
            <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => deleteForm(r.id)}
              className="!text-[#CE1126] !text-xs" />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Forms" subtitle="Create and manage data collection forms">
        <Button icon={<ReloadOutlined />} onClick={loadForms} loading={loading}>Refresh</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} className="!bg-[#009B3A]">Create Form</Button>
      </PageHeader>

      {forms.length === 0 && !loading ? (
        <EmptyState
          icon={<FormOutlined />}
          title="No forms yet"
          description="Create your first form to start collecting data"
          action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)} className="!bg-[#009B3A]">Create Form</Button>}
        />
      ) : (
        <div className="bg-white border border-[#E3E7EE] rounded-[10px] overflow-hidden shadow-sm">
          <Table
            dataSource={forms}
            rowKey="id"
            loading={loading}
            columns={columns}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            className="[&_.ant-table-thead_th]:!text-[10px] [&_.ant-table-thead_th]:!font-semibold [&_.ant-table-thead_th]:!text-[#99A1B3] [&_.ant-table-thead_th]:!uppercase [&_.ant-table-thead_th]:!tracking-wider [&_.ant-table-thead_th]:!bg-[#F7F8FA] [&_.ant-table-thead_th]:!border-b [&_.ant-table-thead_th]:!border-[#EEF0F4] [&_.ant-table-thead_th]:!px-4 [&_.ant-table-thead_th]:!py-3 [&_.ant-table-tbody_td]:!px-4 [&_.ant-table-tbody_td]:!py-3.5 [&_.ant-table-tbody_tr:hover]:!bg-[#F7F8FA] [&_.ant-table]:!border-none"
          />
        </div>
      )}

      <Modal
        title={<span className="font-[Space_Grotesk] text-sm font-bold">Create Form</span>}
        open={showCreate}
        onOk={createForm}
        onCancel={() => setShowCreate(false)}
        okText="Create & Publish"
        width={480}
        okButtonProps={{ className: '!bg-[#009B3A] !rounded-[7px] !text-[10px] !h-[30px] !px-3' }}
        cancelButtonProps={{ className: '!rounded-[7px] !text-[10px] !h-[30px] !px-3' }}
      >
        <div className="flex flex-col gap-3 mt-3">
          <div>
            <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Form Name *</label>
            <Input size="large" placeholder="e.g. Beneficiary Registration" value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              className="!rounded-[7px] !border-[#E3E7EE]" />
          </div>
          <div>
            <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Entity (Record Type)</label>
            <Select
              size="large"
              placeholder="Select entity (optional)"
              value={selectedEntityForForm || undefined}
              onChange={setSelectedEntityForForm}
              allowClear
              className="w-full"
              options={entities.map((e: any) => ({
                label: `${e.name.replace(/_/g, ' ')} (${e.attributes?.length || 0} fields)`,
                value: e.id,
              }))}
            />
          </div>
          <div>
            <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Description</label>
            <Input.TextArea size="large" placeholder="What is this form for?" value={newForm.description}
              onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} rows={3}
              className="!rounded-[7px] !border-[#E3E7EE]" />
          </div>
          {selectedEntityForForm && (
            <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-lg p-3">
              <span className="text-[10px] font-semibold text-[#16A34A]">Fields auto-generated from entity attributes</span>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title={<span className="font-[Space_Grotesk] text-sm font-bold">{editingForm?.name || 'Edit Form'}</span>}
        open={!!editingForm}
        onCancel={() => setEditingForm(null)}
        width={900}
        footer={null}
        className="[&_.ant-modal-content]:!rounded-[10px] [&_.ant-modal-header]:!rounded-t-[10px]"
      >
        {editingForm && (
          <Tabs
            size="small"
            className="[&_.ant-tabs-tab]:!text-[11px] [&_.ant-tabs-ink-bar]:!bg-[#009B3A] [&_.ant-tabs-tab-active]:!font-semibold"
            items={[
              {
                key: 'builder',
                label: (
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <EditOutlined /> Form Builder
                  </span>
                ),
                children: <FormBuilder formId={editingForm.id} initialSchema={editingForm.formSchema} onSave={() => { loadForms(); setEditingForm(null); }} />,
              },
              {
                key: 'settings',
                label: (
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <FileTextOutlined /> Settings
                  </span>
                ),
                children: (
                  <div className="flex flex-col gap-4 p-3">
                    <div>
                      <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Form Name</label>
                      <Input size="large" defaultValue={editingForm.name} placeholder="Form name"
                        className="!rounded-[7px] !border-[#E3E7EE]" />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Description</label>
                      <Input.TextArea size="large" defaultValue={editingForm.description} placeholder="Description" rows={3}
                        className="!rounded-[7px] !border-[#E3E7EE]" />
                    </div>
                  </div>
                ),
              },
              {
                key: 'submissions',
                label: (
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <EyeOutlined /> Submissions
                  </span>
                ),
                children: (
                  <Table
                    dataSource={submissions}
                    rowKey="id"
                    size="small"
                    pagination={{ size: 'small', pageSize: 10, showSizeChanger: false }}
                    columns={[
                      {
                        title: 'ID', dataIndex: 'id', key: 'id',
                        render: (v: string) => (
                          <span className="text-[10px] font-mono text-[#5F6880]">{v?.substring(0, 8)}..</span>
                        ),
                      },
                      {
                        title: 'SUBMITTED', dataIndex: 'submittedAt', key: 'date',
                        render: (v: string) => (
                          <span className="text-[11px] text-[#5F6880]">{v ? new Date(v).toLocaleString() : '—'}</span>
                        ),
                      },
                      {
                        title: 'STATUS', dataIndex: 'status', key: 'status',
                        render: (v: string) => (
                          <Tag className="!text-[9px] !px-2 !rounded-full !border-none !m-0"
                            style={{ background: 'rgba(0,155,58,0.1)', color: '#009B3A' }}>{v || 'completed'}</Tag>
                        ),
                      },
                    ]}
                    className="[&_.ant-table-thead_th]:!text-[9px] [&_.ant-table-thead_th]:!font-semibold [&_.ant-table-thead_th]:!text-[#99A1B3] [&_.ant-table-thead_th]:!uppercase [&_.ant-table-thead_th]:!tracking-wider [&_.ant-table-thead_th]:!bg-[#F7F8FA] [&_.ant-table-thead_th]:!border-b [&_.ant-table-thead_th]:!border-[#EEF0F4] [&_.ant-table-thead_th]:!px-3 [&_.ant-table-thead_th]:!py-2 [&_.ant-table-tbody_td]:!px-3 [&_.ant-table-tbody_td]:!py-2.5 [&_.ant-table-tbody_tr:hover]:!bg-[#F7F8FA] [&_.ant-table]:!border-none"
                  />
                ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
