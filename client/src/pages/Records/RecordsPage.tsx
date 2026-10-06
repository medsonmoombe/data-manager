import React, { useEffect, useState } from 'react';
import {
  Table, Button, Input, Space, Tag, Card, Typography, Modal, Select,
  Popconfirm, Tooltip, Upload, message, Row, Col, Drawer, Avatar, Switch,
  Tabs, Dropdown, Menu, Image,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, UploadOutlined, DatabaseOutlined,
  FormOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  InboxOutlined, SearchOutlined, FilterOutlined, DownloadOutlined,
  FileOutlined, LinkOutlined,
  CheckCircleOutlined, ClockCircleOutlined, StopOutlined,
  CloseOutlined, ExclamationCircleOutlined, InfoCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { entitiesApi, formsApi } from '../../api';
import api from '../../api/axios';
import { showApiErrors, showImportResult } from '../../utils/api-errors';
import FileUploadField, { getFileValue, formatFileSize, isImage, type FileValue } from '../../components/FileUploadField/FileUploadField';

const { Text, Title } = Typography;
const { Dragger } = Upload;

type WizardStep = 'entities' | 'forms' | 'records';

// ─── Format & Validate Helpers ───────────────────────────────────────────────

function formatInputValue(value: string, dataType: string): string {
  switch (dataType) {
    case 'phone': {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    case 'number': {
      const cleaned = value.replace(/[^0-9.]/g, '');
      const parts = cleaned.split('.');
      if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('');
      return cleaned;
    }
    case 'email':
      return value.toLowerCase().replace(/\s/g, '');
    case 'date': {
      const digits = value.replace(/\D/g, '').slice(0, 8);
      if (digits.length <= 2) return digits;
      if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }
    case 'text':
    case 'string':
      return value;
    default:
      return value;
  }
}

function validateField(value: string, dataType: string): string | null {
  if (!value || !value.trim()) return null;
  switch (dataType) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Invalid email address';
    case 'phone':
      return value.replace(/\D/g, '').length >= 10 ? null : 'Phone must be at least 10 digits';
    case 'date': {
      const [d, m, y] = value.split('/').map(Number);
      const date = new Date(y, m - 1, d);
      return date instanceof Date && !isNaN(date.getTime()) ? null : 'Invalid date (DD/MM/YYYY)';
    }
    case 'number':
      return isNaN(Number(value)) ? 'Must be a valid number' : null;
    case 'percentage': {
      const n = Number(value);
      return n >= 0 && n <= 100 ? null : 'Must be between 0 and 100';
    }
    default:
      return null;
  }
}

function getInputProps(dataType: string): Record<string, any> {
  switch (dataType) {
    case 'phone':       return { inputMode: 'tel', placeholder: '(234) 567-8901' };
    case 'number':      return { inputMode: 'numeric', placeholder: '0' };
    case 'currency':    return { inputMode: 'decimal', placeholder: '0.00', prefix: '$' };
    case 'email':       return { inputMode: 'email', placeholder: 'name@example.com' };
    case 'date':        return { inputMode: 'numeric', placeholder: 'DD/MM/YYYY', maxLength: 10 };
    case 'percentage':  return { inputMode: 'numeric', placeholder: '0–100', suffix: '%' };
    case 'national_id': return { placeholder: 'e.g. AB-123456', maxLength: 12 };
    case 'textarea':    return { placeholder: 'Enter details…' };
    default:            return { placeholder: 'Enter value' };
  }
}

function getInitials(name: string = '') {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

const AVATAR_COLORS = ['#009B3A', '#1677ff', '#E8611D', '#722ED1', '#13C2C2', '#FA8C16'];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const STATUS_MAP: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  active:          { color: '#007d2e', bg: '#EAF7EF', icon: <CheckCircleOutlined />, label: 'Active' },
  pending:         { color: '#92400E', bg: '#FEF3C7', icon: <ClockCircleOutlined />, label: 'Pending' },
  inactive:        { color: '#6B7280', bg: '#F3F4F6', icon: <StopOutlined />, label: 'Inactive' },
  workflow_pending:{ color: '#92400E', bg: '#FEF3C7', icon: <ClockCircleOutlined />, label: 'Pending Review' },
  in_review:       { color: '#1E40AF', bg: '#DBEAFE', icon: <InfoCircleOutlined />, label: 'In Review' },
  approved:        { color: '#007d2e', bg: '#EAF7EF', icon: <CheckCircleOutlined />, label: 'Approved' },
  rejected:        { color: '#991B1B', bg: '#FEE2E2', icon: <CloseCircleOutlined />, label: 'Rejected' },
};

function StatusBadge({ value }: { value?: string }) {
  const key = (value ?? '').toLowerCase();
  const cfg = STATUS_MAP[key];
  if (!cfg) return <span style={{ color: '#6B7280', fontSize: 11 }}>{value ?? '—'}</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StatCard({ label, value, sub, subColor }: {
  label: string; value: string | number; sub?: string; subColor?: string;
}) {
  return (
    <div style={{
      background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12,
      padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: subColor ?? '#9CA3AF' }}>{sub}</span>}
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: any; value: any; onChange: (v: any) => void }) {
  const [error, setError] = useState<string | null>(null);
  const dt = field.dataType || 'string';
  const required = field.isRequired || field.required;
  const inputProps = getInputProps(dt);

  const handleChange = (raw: string) => {
    const formatted = formatInputValue(raw, dt);
    onChange(formatted);
  };

  const validate = (val: any): string | null => {
    if (required && (val === undefined || val === null || val === '')) {
      return 'This field is required';
    }
    if (typeof val === 'string' && val.trim()) {
      return validateField(val, dt);
    }
    return null;
  };

  const handleBlur = () => {
    setError(validate(value));
  };

  // SELECT TYPE
  if (dt === 'select' && field.options) {
    return (
      <div>
        <Select
          size="large"
          value={value || undefined}
          onChange={(v) => { onChange(v); setError(null); }}
          onBlur={() => setError(validate(value))}
          placeholder={`Select ${field.displayName || field.name}`}
          status={error ? 'error' : undefined}
          style={{ width: '100%', fontSize: 12 }}
          options={(field.options || []).map((opt: string) => ({ label: opt, value: opt }))}
        />
        {error && <span style={{ color: '#EF4444', fontSize: 10, marginTop: 2, display: 'block' }}>{error}</span>}
      </div>
    );
  }

  if (dt === 'boolean') {
    return (
      <div>
        <Select
          size="large"
          value={value}
          onChange={(v) => { onChange(v); setError(null); }}
          onBlur={() => setError(validate(value))}
          status={error ? 'error' : undefined}
          options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]}
          style={{ width: '100%', fontSize: 12 }}
        />
        {error && <span style={{ color: '#EF4444', fontSize: 10, marginTop: 2, display: 'block' }}>{error}</span>}
      </div>
    );
  }

  if (dt === 'textarea') {
    return (
      <div>
        <Input.TextArea
          size="large"
          value={value ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          status={error ? 'error' : undefined}
          placeholder={inputProps.placeholder}
          rows={3}
          style={{ fontSize: 12 }}
        />
        {error && <span style={{ color: '#EF4444', fontSize: 10, marginTop: 2, display: 'block' }}>{error}</span>}
      </div>
    );
  }

  if (dt === 'file') {
    return (
      <div>
        <FileUploadField
          formId={field.formId}
          value={value}
          onChange={(v) => { onChange(v); setError(null); }}
          label={field.displayName || field.name}
        />
      </div>
    );
  }

  return (
    <div>
      <Input
        size="large"
        value={value ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        status={error ? 'error' : undefined}
        style={{ fontSize: 12 }}
        {...inputProps}
      />
      {error && <span style={{ color: '#EF4444', fontSize: 10, marginTop: 2, display: 'block' }}>{error}</span>}
    </div>
  );
}

export default function RecordsPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('entities');
  const [entities, setEntities] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [showCreateEntity, setShowCreateEntity] = useState(false);
  const [newEntity, setNewEntity] = useState({ name: '', description: '' });
  const [newAttributes, setNewAttributes] = useState<any[]>([{ name: '', dataType: 'string', isRequired: true, isIdentifier: false }]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedEntityForForm, setSelectedEntityForForm] = useState('');
  const [newForm, setNewForm] = useState({ name: '', description: '' });
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showCreateRecord, setShowCreateRecord] = useState(false);
  const [createData, setCreateData] = useState<Record<string, any>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingForm, setEditingForm] = useState<any>(null);
  const [workflowTab, setWorkflowTab] = useState<string>('all');
  const [deletingEntity, setDeletingEntity] = useState<string | null>(null);
  // Load initial data
  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [entRes, formRes]: any[] = await Promise.all([
        entitiesApi.list(),
        api.get('/forms'),
      ]);
      const entityList = entRes.data || entRes || [];
      console.log("ENTITY ::", entityList)
      const allForms = formRes.data?.data || formRes.data || [];
      const formList = Array.isArray(allForms) ? allForms : [];

      setForms(formList);

      // Auto-create entities from forms that don't have matching entities yet
      const entityNames = new Set(entityList.map((e: any) => e.name.toLowerCase()));
      let updatedEntities = [...entityList];
      for (const form of formList) {
        const formEntityName = form.name.toLowerCase().replace(/\s+/g, '_');
        if (!entityNames.has(formEntityName)) {
          try {
            const attributes = (form.formSchema?.fields || []).map((f: any) => ({
              name: f.name,
              dataType: f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'boolean' ? 'boolean' : f.type === 'file' ? 'file' : f.type === 'email' ? 'email' : f.type === 'phone' ? 'phone' : 'string',
              isRequired: !!f.required,
              displayName: f.label || f.name,
            }));
            const created: any = await entitiesApi.create({
              name: formEntityName,
              description: `Auto-created from form: ${form.name}`,
              attributes,
            });
            updatedEntities.push(created.data || created);
          } catch { /* form entity may already exist */ }
        }
      }
      setEntities(updatedEntities);

      if (updatedEntities.length === 0) setCurrentStep('entities');
      else {
        setCurrentStep('records');
        setSelectedEntity(updatedEntities[0]);
      }
    } catch (err) { console.error(err); }
  };

const handleEditForm = () => {
  if (!selectedEntity) {
    message.warning('Select an entity first');
    return;
  }

  const entityName = selectedEntity.name.toLowerCase();
  const entityNameFormatted = entityName.replace(/_/g, ' ');

  // Try to find matching form
  let linkedForm = forms.find((f: any) => {
    const formName = (f.name || '').toLowerCase();
    return formName.includes(entityName) || formName.includes(entityNameFormatted);
  });

  if (linkedForm) {
    // Form exists — open edit modal with full form data
    setEditingForm({
      ...linkedForm,
      formSchema: linkedForm.formSchema || { fields: [] }
    });
    setShowEditForm(true);
  } else {
    // No form exists — create one automatically
    createFormForEntity(selectedEntity);
  }
};

// Enhanced createFormForEntity function
const createFormForEntity = async (entity: any) => {
  try {
    const fields = (entity.attributes || []).map((a: any) => ({
      name: a.name,
      type: a.dataType === 'number' ? 'number' :
            a.dataType === 'date' ? 'date' :
            a.dataType === 'boolean' ? 'boolean' :
            a.dataType === 'select' ? 'select' :
            a.dataType === 'file' ? 'file' : 'text',
      required: a.isRequired,
      label: a.displayName || a.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      options: a.options || undefined,
      isIdentifier: a.isIdentifier || false,
    }));

    const formName = entity.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) + ' Registration';

    const res: any = await formsApi.create({
      name: formName,
      description: `Form for ${entity.name.replace(/_/g, ' ')} records`,
      formSchema: { fields },
      duplicateConfig: {
        enabled: true,
        identifierFields: (entity.attributes || [])
          .filter((a: any) => a.isIdentifier)
          .map((a: any) => a.name),
        action: 'block',
      },
    });

    // Publish the form
    const createdForm = res.data || res;
    if (createdForm.id) {
      await formsApi.publish(createdForm.id);
    }

    message.success(`Form "${formName}" created & published!`);

    // Reload forms list
    await loadAll();

    // Set the editing form directly with the fields we just created
    setEditingForm({
      ...createdForm,
      formSchema: { fields },
      name: formName,
      duplicateConfig: {
        enabled: true,
        identifierFields: (entity.attributes || [])
          .filter((a: any) => a.isIdentifier)
          .map((a: any) => a.name),
        action: 'block',
      },
    });
    setShowEditForm(true);
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Failed to create form');
  }
};

// New function to update form duplicate settings


  const addAttribute = () => setNewAttributes([...newAttributes, { name: '', dataType: 'string', isRequired: false, isIdentifier: false }]);
  const removeAttribute = (i: number) => setNewAttributes(newAttributes.filter((_, idx) => idx !== i));
  const updateAttribute = (i: number, updates: any) =>
    setNewAttributes(newAttributes.map((a, idx) => idx === i ? { ...a, ...updates } : a));

  const handleCreateEntity = async () => {
    if (!newEntity.name) { message.warning('Entity name is required'); return; }
    if (newAttributes.some((a) => !a.name)) { message.warning('All fields need a name'); return; }
    try {
      const res: any = await entitiesApi.create({
        name: newEntity.name.toLowerCase().replace(/\s+/g, '_'),
        description: newEntity.description,
        attributes: newAttributes.filter((a) => a.name).map((a) => ({
          name: a.name.toLowerCase().replace(/\s+/g, '_'),
          dataType: a.dataType,
          isRequired: a.isRequired,
          isIdentifier: a.isIdentifier,
        })),
      });

      const createdEntity = res.data || res;
      message.success('Entity created!');
      setShowCreateEntity(false);
      setNewEntity({ name: '', description: '' });
      setNewAttributes([{ name: '', dataType: 'string', isRequired: true }]);

      await loadAll();

      const updatedList: any = await entitiesApi.list();
      const entityList = updatedList.data || updatedList || [];
      const foundEntity = entityList.find((e: any) => e.name === createdEntity.name);
      if (foundEntity) {
        setSelectedEntity(foundEntity);
        setVisibleColumns((foundEntity.attributes || []).slice(0, 4).map((f: any) => f.name));
      }

      Modal.confirm({
        title: 'Entity created!',
        content: 'Do you want to create a form template for this entity now?',
        okText: 'Create Form',
        cancelText: 'Later',
        onOk: () => {
          setSelectedEntityForForm(foundEntity?.id || createdEntity.id);
          setNewForm({ name: '', description: '' });
          setShowCreateForm(true);
        },
      });
    } catch (err: unknown) {
      const e = err as any;
      message.error(e?.response?.data?.message || 'Failed to create entity');
    }
  };

  const handleCreateForm = async () => {
    if (!newForm.name || !selectedEntityForForm) { message.warning('Form name and entity are required'); return; }
    const entity = entities.find((e) => e.id === selectedEntityForForm);
    const fields = (entity?.attributes || []).map((a: any) => ({
      name: a.name,
      type: a.dataType === 'number' ? 'number' : a.dataType === 'date' ? 'date' : a.dataType === 'boolean' ? 'boolean' : a.dataType === 'file' ? 'file' : 'text',
      required: a.isRequired,
      label: a.displayName || a.name.replace(/_/g, ' '),
    }));
    try {
      await formsApi.create({ name: newForm.name, description: newForm.description, formSchema: { fields } });
      const createdForm: any = await formsApi.list();
      const form = (createdForm.data?.data || createdForm.data || []).find((f: any) => f.name === newForm.name);
      if (form) await formsApi.publish(form.id);
      message.success('Form created and published!');
      setShowCreateForm(false);
      setNewForm({ name: '', description: '' });
      setCurrentStep('records');
      loadAll();
    } catch (err: unknown) {
      const e = err as any;
      message.error(e?.response?.data?.message || 'Failed to create form');
    }
  };

const loadRecords = async () => {
  if (!selectedEntity) return;
  setLoading(true);
  try {
    const params: any = { page, limit: 20 };
    if (search) params.search = search;

    if (workflowTab !== 'all') {
      params['filter[_workflowStatus]'] = workflowTab;
    }

    const activeFilters = Object.entries(filters).filter(([_, v]) => v?.trim());
    if (activeFilters.length > 0) {
      activeFilters.forEach(([key, value]) => {
        params[`filter[${key}]`] = value;
      });
    }

    const res: any = await api.get(`/mdm/records/${selectedEntity.name}`, { params });
    setRecords(res.data?.data || []);
    setTotal(res.data?.total || 0);
  } catch { setRecords([]); }
  finally { setLoading(false); }
};

  useEffect(() => {
    if (currentStep === 'records' && selectedEntity) loadRecords();
  }, [page, search, selectedEntity, currentStep, filters, workflowTab]);

  const handleExport = async () => {
    if (!selectedEntity) return;
    try {
      const params: any = { page: 1, limit: 100000 };
      if (search) params.search = search;
      Object.entries(filters).forEach(([k, v]) => { if (v) params[`filter[${k}]`] = v; });
      
      const res: any = await api.get(`/mdm/records/${selectedEntity.name}`, { params });
      const allRecords = res.data?.data || [];
      if (!allRecords.length) { message.warning('No records to export'); return; }

      const fields = selectedEntity.attributes || [];
      const headers = ['ID', ...fields.map((f: any) => f.name), 'Created At', 'Updated At'];
      const rows = allRecords.map((r: any) => [
        r.id,
        ...fields.map((f: any) => {
          const val = r.data?.[f.name];
          const str = val !== undefined && val !== null ? String(val) : '';
          return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
        }),
        r.createdAt ? new Date(r.createdAt).toLocaleString() : '',
        r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '',
      ]);
      const csv = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedEntity.name}_records_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`Exported ${allRecords.length} records`);
    } catch (err: unknown) {
      const e = err as any;
      message.error(e?.response?.data?.message || 'Export failed');
    }
  };

  const handleCreateRecord = async () => {
    if (!selectedEntity) return;

    // Validate required fields
    const requiredFields = (selectedEntity.attributes || []).filter((f: any) => f.isRequired);
    const missingFields = requiredFields.filter((f: any) => !createData[f.name] || createData[f.name] === '');

    if (missingFields.length > 0) {
      message.error(`Please fill required fields: ${missingFields.map((f: any) => f.name).join(', ')}`);
      return;
    }

    try {
      await api.post(`/mdm/records/${selectedEntity.name}`, { data: createData });
      message.success('Record created successfully');
      setShowCreateRecord(false);
      setCreateData({});
      loadRecords();
    } catch (err: unknown) {
      const e = err as any;
      const responseData = e?.response?.data;

      if (responseData?.errors && responseData.message === 'Duplicate record detected') {
        const duplicateFields = responseData.duplicateFields || [];

        Modal.confirm({
          title: 'Duplicate Record Detected',
          icon: <ExclamationCircleOutlined style={{ color: '#E8611D' }} />,
          content: (
            <div>
              <p style={{ fontSize: 13, color: '#5F6880', marginBottom: 12 }}>
                {responseData.errors[0]}
              </p>
              {duplicateFields.length > 0 && (
                <div style={{ background: '#FEF3C7', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                  <strong style={{ fontSize: 11 }}>Duplicate based on:</strong>
                  <ul style={{ marginTop: 4, marginBottom: 0, fontSize: 11 }}>
                    {duplicateFields.map((field: string) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p style={{ fontSize: 11, color: '#99A1B3', marginTop: 12, marginBottom: 0 }}>
                Would you like to update the existing record instead?
              </p>
            </div>
          ),
          okText: 'Update Existing',
          cancelText: 'Cancel',
          onOk: async () => {
            if (responseData.existingRecordId) {
              try {
                await api.put(`/mdm/records/${selectedEntity.name}/${responseData.existingRecordId}`, {
                  data: createData
                });
                message.success('Existing record updated successfully');
                setShowCreateRecord(false);
                setCreateData({});
                loadRecords();
              } catch (updateErr) {
                message.error('Failed to update existing record');
              }
            }
          },
        });
      } else {
        message.error(responseData?.message || 'Failed to create record');
      }
    }
  };

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setEditData({ ...(record.data || {}) });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedRecord || !selectedEntity) return;
    try {
      await api.put(`/mdm/records/${selectedEntity.name}/${selectedRecord.id}`, { data: editData });
      message.success('Record updated successfully');
      setEditOpen(false);
      loadRecords();
    } catch (err: unknown) {
      const e = err as any;
      message.error(e?.response?.data?.message || 'Failed to update record');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/mdm/records/${selectedEntity?.name}/${id}`);
      message.success('Record deleted successfully');
      loadRecords();
    } catch (err: unknown) {
      const e = err as any;
      message.error(e?.response?.data?.message || 'Failed to delete record');
    }
  };

  const handleFileSelect = (file: File): boolean => {
    setImportError(null);
    
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
      setImportError('Invalid file type. Please upload a CSV or Excel file (.csv, .xls, .xlsx)');
      message.error('Invalid file type. Please upload CSV or Excel files only.');
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      setImportError('File is too large. Maximum size is 10MB.');
      message.error('File too large. Max 10MB.');
      return false;
    }

    if (file.size === 0) {
      setImportError('File is empty. Please select a valid file.');
      message.error('File is empty.');
      return false;
    }

    setImportFile(file);
    message.success(`File "${file.name}" selected`);
    return false;
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      message.warning('Please select a file first');
      return;
    }
    if (!selectedEntity) {
      message.warning('No entity selected');
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const csvContent = e.target?.result as string;
          
          if (!csvContent || csvContent.trim().length === 0) {
            setImportError('The file appears to be empty or unreadable.');
            setImporting(false);
            return;
          }

          const lines = csvContent.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            setImportError('File must contain a header row and at least one data row.');
            setImporting(false);
            return;
          }

          const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
          
          if (headers.length === 0) {
            setImportError('No column headers found in the file.');
            setImporting(false);
            return;
          }

          const entityFields = selectedEntity.attributes || [];
          const mapping: Record<string, string> = {};
          let mappedCount = 0;

          headers.forEach((h) => {
            const match = entityFields.find((f: any) =>
              f.name.toLowerCase() === h.toLowerCase().replace(/\s+/g, '_'),
            );
            if (match) {
              mapping[h] = match.name;
              mappedCount++;
            }
          });

          if (mappedCount === 0) {
            setImportError(`None of the CSV columns match the ${selectedEntity.name} fields.`);
            setImporting(false);
            return;
          }

          const rules = Object.entries(mapping).map(([source, target]) => ({
            sourceField: source,
            targetField: target,
            transform: 'trim',
          }));

          const res: any = await api.post('/connectors/import-csv', {
            entityName: selectedEntity.name,
            csvContent: csvContent,
            fileName: importFile.name,
            transformationRules: rules,
          });

          showImportResult(res.data?.data ?? res.data);
          setShowImport(false);
          setImportFile(null);
          setImporting(false);
          setTimeout(() => {
            loadRecords();
            setPage(1);
          }, 2000);
        } catch (err: any) {
          setImportError(err?.response?.data?.message || 'Import failed. Please try again.');
          setImporting(false);
        }
      };

      reader.onerror = () => {
        setImportError('Failed to read the file. Please try again.');
        setImporting(false);
      };

      reader.readAsText(importFile);
    } catch (err: any) {
      setImportError(err?.message || 'Import failed');
      setImporting(false);
    }
  };

  useEffect(() => {
    if (selectedEntity?.attributes) {
      const fields = selectedEntity.attributes || [];
      const defaultCols = fields.slice(0, 4).map((f: any) => f.name);
      setVisibleColumns(defaultCols);
    }
  }, [selectedEntity]);


  if (currentStep === 'entities') {
    return (
      <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', padding: '0 20px' }}>
        <ZambiaBar />
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: '#EAF7EF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 28, color: '#009B3A',
        }}>
          <DatabaseOutlined />
        </div>
        <Title level={4} style={{ fontWeight: 600, marginBottom: 8 }}>Welcome to Records</Title>
        <Text style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.7, display: 'block', marginBottom: 32 }}>
          Before adding records, define what types of data you want to manage.
          Start by creating your first entity — like "Beneficiary" or "Land Parcel".
        </Text>
        <OnboardSteps active={0} />
        <Button
          type="primary" size="large" icon={<PlusOutlined />}
          onClick={() => setShowCreateEntity(true)}
          style={{ background: '#009B3A', borderColor: '#009B3A', borderRadius: 8, height: 42, paddingInline: 28, fontSize: 13 }}
        >
          Create your first entity
        </Button>

        <Modal
          title={<span style={{ fontWeight: 600, fontSize: 14 }}>Create entity</span>}
          open={showCreateEntity}
          onOk={handleCreateEntity}
          onCancel={() => setShowCreateEntity(false)}
          okText="Create entity"
          okButtonProps={{ style: { background: '#009B3A', borderColor: '#009B3A' } }}
          width={640}
        >
          <EntityForm
            entity={newEntity} setEntity={setNewEntity}
            attributes={newAttributes}
            addAttribute={addAttribute}
            removeAttribute={removeAttribute}
            updateAttribute={updateAttribute}
          />
        </Modal>
      </div>
    );
  }

  if (currentStep === 'forms') {
    return (
      <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', padding: '0 20px' }}>
        <ZambiaBar />
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: '#EEF2FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 28, color: '#4F46E5',
        }}>
          <FormOutlined />
        </div>
        <Title level={4} style={{ fontWeight: 600, marginBottom: 8 }}>Create a form template</Title>
        <Text style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.7, display: 'block', marginBottom: 32 }}>
          You have <strong>{entities.length}</strong> entity {entities.length === 1 ? 'type' : 'types'} defined.
          Now build a form so users can enter data easily.
        </Text>
        <OnboardSteps active={1} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <Button
            type="primary" size="large" icon={<PlusOutlined />}
            onClick={() => setShowCreateForm(true)}
            style={{ background: '#009B3A', borderColor: '#009B3A', borderRadius: 8, height: 42, paddingInline: 28, fontSize: 13 }}
          >
            Create form template
          </Button>
          <Button
            size="large"
            onClick={() => { setCurrentStep('records'); if (entities.length) setSelectedEntity(entities[0]); }}
            style={{ borderRadius: 8, height: 42, paddingInline: 20, fontSize: 13, color: '#6B7280' }}
          >
            Skip for now
          </Button>
        </div>

        <Modal
          title={<span style={{ fontWeight: 600, fontSize: 14 }}>Create form template</span>}
          open={showCreateForm}
          onOk={handleCreateForm}
          onCancel={() => setShowCreateForm(false)}
          okText="Create & publish"
          okButtonProps={{ style: { background: '#009B3A', borderColor: '#009B3A' } }}
          width={500}
        >
          <FormCreator
            form={newForm} setForm={setNewForm}
            entities={entities}
            selectedEntity={selectedEntityForForm}
            setSelectedEntity={setSelectedEntityForForm}
          />
        </Modal>
      </div>
    );
  }

  const entityFields = selectedEntity?.attributes || [];
  const selectedFields = entityFields.filter((f: any) => visibleColumns.includes(f.name)).slice(0, 5);

  const getLinkedFormFields = () => {
    if (!selectedEntity) return null;

    const entityName = selectedEntity.name.toLowerCase();
    const entityNameFormatted = entityName.replace(/_/g, ' ');

    const linkedForm = forms.find((f: any) => {
      const formName = (f.name || '').toLowerCase();
      return formName.includes(entityName) || formName.includes(entityNameFormatted);
    });

    if (linkedForm && linkedForm.formSchema?.fields?.length > 0) {
      return linkedForm.formSchema.fields.map((field: any) => ({
        ...field,
        dataType: field.type || 'text',
        displayName: field.label || field.name,
        formId: linkedForm.id,
      }));
    }

    return null;
  };

  const columns = [
    ...selectedFields.map((field: any) => ({
      title: (field.displayName || field.name).replace(/_/g, ' ').toUpperCase(),
      key: field.name,
      ellipsis: true,
      render: (_: any, r: any) => {
        const val = r.data?.[field.name];
        if (field.name.toLowerCase().includes('status')) return <StatusBadge value={val} />;
        if (field.dataType === 'date' && val) {
          return <span style={{ fontSize: 12, color: '#4B5563' }}>{new Date(val).toLocaleDateString()}</span>;
        }
        if (field.dataType === 'file') {
          const fv = getFileValue(val);
          if (fv) {
            const img = isImage(fv.mimeType);
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {img ? <img src={fv.url} alt="" style={{ width: 24, height: 24, borderRadius: 3, objectFit: 'cover' }} /> : <FileOutlined style={{ color: '#6B7280', fontSize: 14 }} />}
                <span style={{ fontSize: 11, color: '#1A1F2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{fv.originalName}</span>
              </div>
            );
          }
          return '—';
        }
        return <span style={{ fontSize: 12, color: '#4B5563' }}>{val !== undefined && val !== null ? String(val) : '—'}</span>;
      },
    })),
    {
      title: 'WORKFLOW',
      key: '_workflowStatus',
      width: 120,
      render: (_: any, r: any) => <StatusBadge value={r.data?._workflowStatus} />,
    },
    {
      title: 'ACTIONS',
      key: '_actions',
      width: 100,
      render: (_: any, r: any) => (
        <Space size={2}>
          <Tooltip title="View">
            <Button type="text" size="small" icon={<EyeOutlined />} style={{ fontSize: 12, color: '#6B7280' }}
              onClick={() => { setSelectedRecord(r); setDetailOpen(true); }} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} style={{ fontSize: 12, color: '#6B7280' }}
              onClick={() => handleEdit(r)} />
          </Tooltip>
          <Popconfirm title="Delete this record?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(r.id)}>
            <Tooltip title="Delete">
              <Button type="text" size="small" icon={<DeleteOutlined />} danger style={{ fontSize: 12 }} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ background: '#F9FAFB', minHeight: '100vh' }}>
      <ZambiaBar />

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 24px', background: '#fff', borderBottom: '0.5px solid #E5E7EB',
      }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#111827' }}>Records</h2>
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
            {total.toLocaleString()} {selectedEntity?.name?.replace(/_/g, ' ')} records
          </Text>
        </div>

        <Space size={8} align="center">
          <div style={{
            display: 'flex', gap: 3, background: '#F3F4F6',
            borderRadius: 20, padding: 3, border: '0.5px solid #E5E7EB',
          }}>
            <button
              onClick={() => {
                setNewEntity({ name: '', description: '' });
      setNewAttributes([{ name: '', dataType: 'string', isRequired: true, isIdentifier: false }]);
                setShowCreateEntity(true);
              }}
              style={{
                border: '1px dashed #D1D5DB',
                background: 'transparent',
                borderRadius: 16, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
                color: '#6B7280', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <PlusOutlined style={{ fontSize: 10 }} /> New Entity
            </button>
            {entities.slice(0, 2).map((e: any) => {
              const displayName = e.name.replace(/_/g, ' ');
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title={displayName}>
                    <button
                      onClick={() => { setSelectedEntity(e); setPage(1); setSearch(''); setFilters({}); }}
                      style={{
                        border: selectedEntity?.id === e.id ? '0.5px solid #E5E7EB' : 'none',
                        background: selectedEntity?.id === e.id ? '#fff' : 'transparent',
                        borderRadius: 16,
                        padding: '4px 14px', fontSize: 12, cursor: 'pointer',
                        fontWeight: selectedEntity?.id === e.id ? 500 : 400,
                        color: selectedEntity?.id === e.id ? '#111827' : '#6B7280',
                        boxShadow: selectedEntity?.id === e.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {displayName}
                    </button>
                  </Tooltip>
                  <Popconfirm
                    title="Delete this entity?"
                    onConfirm={async () => {
                      setDeletingEntity(e.id);
                      try {
                        await entitiesApi.delete(e.id);
                        message.success('Entity deleted');
                        loadAll();
                      } catch (err: any) {
                        message.error(err?.response?.data?.message || 'Cannot delete');
                      } finally { setDeletingEntity(null); }
                    }}
                    onCancel={() => setDeletingEntity(null)}
                    okButtonProps={{ loading: deletingEntity === e.id, danger: true }}
                  >
                    <Button
                      type="text" size="small" danger
                      icon={<DeleteOutlined />}
                      loading={deletingEntity === e.id}
                      style={{ fontSize: 12, padding: '2px 4px', color: '#DC2626', opacity: 0.7 }}
                    />
                  </Popconfirm>
                </div>
              );
            })}
            {entities.length > 2 && (
              <Dropdown
                menu={{
                  items: entities.slice(2).map((e: any) => ({
                    key: e.id,
                    label: (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, maxWidth: 200 }}>
                        <Tooltip title={e.name.replace(/_/g, ' ')}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                            {e.name.replace(/_/g, ' ')}
                          </span>
                        </Tooltip>
                        <Popconfirm
                          title="Delete this entity?"
                          onConfirm={async () => {
                            setDeletingEntity(e.id);
                            try {
                              await entitiesApi.delete(e.id);
                              message.success('Entity deleted');
                              loadAll();
                            } catch (err: any) {
                              message.error(err?.response?.data?.message || 'Cannot delete');
                            } finally { setDeletingEntity(null); }
                          }}
                          onCancel={() => setDeletingEntity(null)}
                          okButtonProps={{ loading: deletingEntity === e.id, danger: true }}
                        >
                          <Button
                            type="text" size="small" danger
                            icon={<DeleteOutlined />}
                            loading={deletingEntity === e.id}
                            style={{ fontSize: 12, padding: 0, color: '#DC2626' }}
                          />
                        </Popconfirm>
                      </div>
                    ),
                    onClick: () => {
                      setEntities((prev: any[]) => {
                        const idx = prev.findIndex((x: any) => x.id === e.id);
                        if (idx < 0) return prev;
                        const copy = [...prev];
                        const [item] = copy.splice(idx, 1);
                        copy.unshift(item);
                        return copy;
                      });
                      setSelectedEntity(e); setPage(1); setSearch(''); setFilters({});
                    },
                  })),
                }}
                trigger={['click']}
              >
                <button
                  style={{
                    border: '0.5px solid #E5E7EB',
                    background: '#fff',
                    borderRadius: 16, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
                    color: '#6B7280', fontWeight: 500,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  +{entities.length - 2} more
                </button>
              </Dropdown>
            )}
          </div>

          <Button icon={<ReloadOutlined />} size="small" onClick={loadRecords}>Refresh</Button>
          <Button icon={<DownloadOutlined />} size="small" onClick={handleExport}>Export</Button>
          <Button icon={<UploadOutlined />} size="small" onClick={() => setShowImport(true)}>Import</Button>
          <Button
            size="small" icon={<EditOutlined />}
            onClick={handleEditForm}
            style={{ fontSize: 12 }}
          >
            Edit Form
          </Button>
          <Button
            type="primary" size="small" icon={<PlusOutlined />}
            onClick={() => { setCreateData({}); setShowCreateRecord(true); }}
            style={{ background: '#009B3A', borderColor: '#009B3A' }}
          >
            Add record
          </Button>
        </Space>
      </div>

      <div style={{ padding: '16px 24px' }}>
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col span={6}><StatCard label="Approved" value={records.filter((r: any) => r.data?._workflowStatus === 'approved').length.toLocaleString()} sub="Workflow approved" subColor="#007d2e" /></Col>
          <Col span={6}><StatCard label="In Review" value={records.filter((r: any) => r.data?._workflowStatus === 'in_review').length.toLocaleString()} sub="Awaiting decision" subColor="#1E40AF" /></Col>
          <Col span={6}><StatCard label="Pending Review" value={records.filter((r: any) => r.data?._workflowStatus === 'workflow_pending').length.toLocaleString()} sub="Not yet reviewed" subColor="#92400E" /></Col>
          <Col span={6}><StatCard label="Rejected" value={records.filter((r: any) => r.data?._workflowStatus === 'rejected').length.toLocaleString()} sub="Workflow rejected" subColor="#991B1B" /></Col>
        </Row>

        {/* ── Toolbar ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showFilters ? 10 : 0 }}>
            <Space size={8}>
              <Input size="large"
                prefix={<SearchOutlined style={{ color: '#9CA3AF', fontSize: 13 }} />}
                placeholder="Search all fields..."
                value={search}
                allowClear
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                onPressEnter={loadRecords}
                style={{ width: 220, fontSize: 12, borderRadius: 8 }}
              />
              <Button
                size="small"
                icon={<FilterOutlined />}
                onClick={() => setShowFilters(!showFilters)}
                style={{ fontSize: 12 }}
              >
                Filters {Object.values(filters).filter(v => v?.trim()).length > 0 && `(${Object.values(filters).filter(v => v?.trim()).length})`}
              </Button>
              {(search || Object.values(filters).some(v => v?.trim())) && (
                <Button
                  size="small"
                  onClick={() => { setSearch(''); setFilters({}); setPage(1); }}
                  style={{ fontSize: 11, color: '#CE1126' }}
                >
                  Clear All
                </Button>
              )}
            </Space>

            <Space size={8}>
              <Button size="small" onClick={() => setShowColumnPicker(true)} style={{ fontSize: 11 }}>
                Columns ({selectedFields.length}/5)
              </Button>
            </Space>
          </div>

          {/* Filter Bar */}
          {showFilters && (
            <div style={{
              background: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 4,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {entityFields.map((field: any) => (
                  <div key={field.name}>
                    <label style={{
                      display: 'block', fontSize: 10, textTransform: 'uppercase',
                      letterSpacing: '0.05em', color: '#6B7280', marginBottom: 4, fontWeight: 500,
                    }}>
                      {field.displayName || field.name.replace(/_/g, ' ')}
                    </label>
                    {field.dataType === 'boolean' ? (
                      <Select
                        size="large"
                        placeholder="Any"
                        allowClear
                        value={filters[field.name] || undefined}
                        onChange={(v) => setFilters({ ...filters, [field.name]: v || '' })}
                        style={{ width: '100%', fontSize: 11 }}
                        options={[
                          { label: 'Yes', value: 'true' },
                          { label: 'No', value: 'false' },
                        ]}
                      />
                    ) : field.dataType === 'date' ? (
                      <Input
                        size="large"
                        type="date"
                        placeholder="Select date"
                        value={filters[field.name] || ''}
                        onChange={(e) => setFilters({ ...filters, [field.name]: e.target.value })}
                        style={{ fontSize: 11 }}
                      />
                    ) : (
                      <Input
                        size="large"
                        placeholder={`Filter ${field.displayName || field.name}...`}
                        value={filters[field.name] || ''}
                        onChange={(e) => setFilters({ ...filters, [field.name]: e.target.value })}
                        onPressEnter={loadRecords}
                        allowClear
                        style={{ fontSize: 11 }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 8 }}>
                <Button
                  size="small"
                  onClick={() => { setFilters({}); setPage(1); }}
                  style={{ fontSize: 11 }}
                >
                  Reset
                </Button>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => { setPage(1); loadRecords(); }}
                  style={{ background: '#009B3A', borderColor: '#009B3A', fontSize: 11 }}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          )}
        </div>

        <Tabs
          size="small"
          activeKey={workflowTab}
          onChange={(key) => { setWorkflowTab(key); setPage(1); }}
          style={{ marginBottom: 0 }}
          items={[
            { key: 'all', label: 'All' },
            { key: 'workflow_pending', label: 'Pending Review' },
            { key: 'in_review', label: 'In Review' },
            { key: 'approved', label: 'Approved' },
          ]}
        />

        <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <Table
            dataSource={records}
            rowKey="id"
            loading={loading}
            size="small"
            columns={columns}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              showTotal: (t) => `${t.toLocaleString()} records`,
              showSizeChanger: false,
              size: 'small',
              onChange: (p) => setPage(p),
            }}
            scroll={{ x: Math.max(600, selectedFields.length * 140 + 100) }}
            locale={{
              emptyText: (
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <DatabaseOutlined style={{ fontSize: 28, color: '#D1D5DB', display: 'block', marginBottom: 8 }} />
                  <span style={{ color: '#9CA3AF', fontSize: 12 }}>No records found</span>
                  {Object.values(filters).some(v => v?.trim()) && (
                    <Button size="small" onClick={() => { setFilters({}); setSearch(''); setPage(1); }} style={{ marginTop: 12 }}>Clear filters</Button>
                  )}
                </div>
              ),
            }}
          />
        </Card>
      </div>

      {/* Add Record Modal */}
      <Modal
        title={<span style={{ fontWeight: 600, fontSize: 14 }}>Add {selectedEntity?.name?.replace(/_/g, ' ')}</span>}
        open={showCreateRecord}
        onOk={handleCreateRecord}
        onCancel={() => setShowCreateRecord(false)}
        okText="Create record"
        okButtonProps={{ style: { background: '#009B3A', borderColor: '#009B3A' } }}
        width={580}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, maxHeight: '55vh', overflowY: 'auto' }}>
          {(getLinkedFormFields() || entityFields).map((field: any) => (
            <div key={field.name}>
              <label style={labelStyle}>
                {field.label || field.displayName || field.name.replace(/_/g, ' ')}
                {field.required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
              </label>
              <FieldInput
                field={{
                  ...field,
                  dataType: field.type || field.dataType || 'string',
                  displayName: field.label || field.displayName || field.name,
                  options: field.options || [],
                }}
                value={createData[field.name]}
                onChange={(v) => setCreateData({ ...createData, [field.name]: v })}
              />
            </div>
          ))}
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={<span style={{ fontWeight: 600, fontSize: 14 }}>Edit record</span>}
        open={editOpen}
        onOk={handleSaveEdit}
        onCancel={() => setEditOpen(false)}
        okText="Save changes"
        okButtonProps={{ style: { background: '#009B3A', borderColor: '#009B3A' } }}
        width={580}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, maxHeight: '55vh', overflowY: 'auto' }}>
          {(getLinkedFormFields() || entityFields).map((field: any) => (
            <div key={field.name}>
              <label style={labelStyle}>
                {field.label || field.displayName || field.name.replace(/_/g, ' ')}
              </label>
              <FieldInput
                field={{
                  ...field,
                  dataType: field.type || field.dataType || 'string',
                  displayName: field.label || field.displayName || field.name,
                  options: field.options || [],
                }}
                value={editData[field.name]}
                onChange={(v) => setEditData({ ...editData, [field.name]: v })}
              />
            </div>
          ))}
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        title={<span style={{ fontWeight: 600, fontSize: 14 }}>Import records</span>}
        open={showImport}
        onCancel={() => {
          setShowImport(false);
          setImportFile(null);
          setImportError(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setShowImport(false);
            setImportFile(null);
            setImportError(null);
          }}>
            Cancel
          </Button>,
          <Button
            key="preview"
            onClick={async () => {
              if (!importFile || !selectedEntity) return;
              setPreviewLoading(true);
              try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                  const csvContent = e.target?.result as string;
                  const headerLine = csvContent.split('\n')[0];
                  const headers = headerLine.split(',').map((h: string) => h.trim().replace(/"/g, ''));
                  const entityFields = selectedEntity.attributes || [];
                  const mapping: Record<string, string> = {};
                  headers.forEach((h: string) => {
                    const match = entityFields.find((f: any) => f.name.toLowerCase() === h.toLowerCase().replace(/\s+/g, '_'));
                    if (match) mapping[h] = match.name;
                  });
                  const rules = Object.entries(mapping).map(([s, t]) => ({ sourceField: s, targetField: t, transform: 'trim' }));

                  const res: any = await api.post('/connectors/import-csv/preview', {
                    entityName: selectedEntity.name,
                    csvContent,
                    fileName: importFile.name,
                    transformationRules: rules,
                  });

                  const data = res.data || res;
                  Modal.info({
                    title: 'Import Preview',
                    width: 700,
                    content: (
                      <div>
                        <p style={{ fontSize: 13, marginBottom: 8 }}>{data.totalRows} rows found in CSV</p>
                        <p style={{ fontSize: 12, color: '#16A34A', marginBottom: 4 }}>~{data.summary?.estimatedNew} new records estimated</p>
                        <p style={{ fontSize: 12, color: '#E8611D', marginBottom: 12 }}>{data.summary?.duplicates} duplicates detected</p>
                        <Table dataSource={data.previewRows || []} rowKey="row" size="small" pagination={false}
                          columns={[
                            { title: 'Row', dataIndex: 'row', width: 60 },
                            { title: 'Status', dataIndex: 'status', render: (v: string) => <Tag color={v === 'new' ? 'green' : 'orange'} style={{ fontSize: 10 }}>{v}</Tag> },
                            { title: 'Data', dataIndex: 'data', render: (v: any) => <span style={{ fontSize: 10, fontFamily: 'monospace' }}>{JSON.stringify(v).substring(0, 100)}</span> },
                          ]} />
                      </div>
                    ),
                  });
                  setPreviewLoading(false);
                };
                reader.readAsText(importFile);
              } catch { setPreviewLoading(false); }
            }}
            disabled={!importFile}
            loading={previewLoading}
          >
            Preview
          </Button>,
          <Button
            key="import"
            type="primary"
            loading={importing}
            onClick={handleImportSubmit}
            disabled={!importFile}
            style={{ background: '#009B3A', borderColor: '#009B3A' }}
          >
            {importing ? 'Importing...' : 'Start Import'}
          </Button>,
        ]}
        width={520}
      >
        <div style={{ padding: '8px 0' }}>
          <Dragger
            accept=".csv,.xls,.xlsx"
            maxCount={1}
            beforeUpload={handleFileSelect}
            showUploadList={false}
            style={{ borderRadius: 10 }}
            disabled={importing}
          >
            <p style={{ fontSize: 36, color: importFile ? '#009B3A' : '#9CA3AF', margin: '0 0 8px' }}>
              {importFile ? <CheckCircleOutlined /> : <InboxOutlined />}
            </p>
            <p style={{ fontSize: 13, color: '#4B5563', margin: 0 }}>
              {importFile ? importFile.name : 'Click or drag a CSV/Excel file here'}
            </p>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>
              {importFile
                ? `${(importFile.size / 1024).toFixed(1)} KB — Click to change`
                : 'Supports .csv, .xls, .xlsx (max 10MB)'}
            </p>
          </Dragger>

          {importError && (
            <div style={{
              marginTop: 12, padding: '10px 14px', background: '#FEF2F2',
              border: '1px solid #FECACA', borderRadius: 8,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ color: '#EF4444', fontSize: 14, flexShrink: 0 }}>⚠</span>
              <span style={{ color: '#991B1B', fontSize: 11, lineHeight: 1.5 }}>{importError}</span>
            </div>
          )}

          {selectedEntity && (
            <div style={{ marginTop: 14, background: '#F9FAFB', borderRadius: 8, padding: '10px 14px', border: '0.5px solid #E5E7EB' }}>
              <Text style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                EXPECTED COLUMNS — CSV headers matching these will be auto-mapped
              </Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(selectedEntity.attributes || []).map((f: any) => (
                  <Tag key={f.name} style={{ fontSize: 10, borderRadius: 6, margin: 0 }}>
                    {f.name}
                    {f.isRequired && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={null}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={"50%"}
        bodyStyle={{ padding: 0 }}
        headerStyle={{ display: 'none' }}
      >
        {selectedRecord && (
          <div>
            <div style={{
              padding: '24px 24px 20px',
              background: 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}>
              <Avatar
                size={56}
                style={{
                  background: avatarColor(selectedRecord.id || ''),
                  fontSize: 18, fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                {getInitials(String(selectedRecord.data?.[entityFields[0]?.name] || ''))}
              </Avatar>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 17, color: '#111827', marginBottom: 2 }}>
                  {String(selectedRecord.data?.[entityFields[0]?.name] || 'Record')}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {selectedEntity?.name?.replace(/_/g, ' ')} · Created{' '}
                  {selectedRecord.createdAt
                    ? new Date(selectedRecord.createdAt).toLocaleDateString()
                    : '—'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Button size="small" icon={<EditOutlined />} onClick={() => { setDetailOpen(false); handleEdit(selectedRecord); }}>
                  Edit
                </Button>
                <Popconfirm title="Delete this record?" okText="Delete" okButtonProps={{ danger: true }}
                  onConfirm={() => { setDetailOpen(false); handleDelete(selectedRecord.id); }}>
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Delete
                  </Button>
                </Popconfirm>
              </div>
            </div>

            <div style={{ padding: '8px 20px 20px' }}>
              <div style={{
                fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: '#9CA3AF', fontWeight: 600, marginBottom: 12,
              }}>
                Record Details
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {entityFields.map((field: any, i: number) => (
                  <div
                    key={field.name}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      padding: '10px 0',
                      borderBottom: i < entityFields.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}
                  >
                    <span style={{
                      fontSize: 11, color: '#6B7280', fontWeight: 500,
                      textTransform: 'capitalize', flexShrink: 0, marginRight: 16,
                    }}>
                      {field.displayName || field.name.replace(/_/g, ' ')}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 500, color: '#111827',
                      textAlign: 'right', wordBreak: 'break-word',
                    }}>
                      {field.name.toLowerCase().includes('status')
                        ? <StatusBadge value={selectedRecord.data?.[field.name]} />
                        : field.dataType === 'date' && selectedRecord.data?.[field.name]
                          ? new Date(selectedRecord.data?.[field.name]).toLocaleDateString()
                          : field.dataType === 'file'
                            ? <FileFieldValue value={selectedRecord.data?.[field.name]} />
                            : String(selectedRecord.data?.[field.name] ?? '—')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              padding: '12px 20px', borderTop: '1px solid #E5E7EB',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF' }}>
                <span>Last Updated</span>
                <span>{selectedRecord.updatedAt ? new Date(selectedRecord.updatedAt).toLocaleString() : '—'}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Column Picker Modal */}
      <Modal
        title={<span style={{ fontWeight: 600, fontSize: 14 }}>Choose table columns (max 5)</span>}
        open={showColumnPicker}
        onCancel={() => setShowColumnPicker(false)}
        footer={[
          <Button key="done" type="primary" onClick={() => setShowColumnPicker(false)} style={{ background: '#009B3A', borderColor: '#009B3A' }}>
            Done
          </Button>,
        ]}
        width={400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
            Select up to <strong>5</strong> columns to display.
          </Text>
          {entityFields.map((field: any) => {
            const isChecked = visibleColumns.includes(field.name);
            const isDisabled = !isChecked && visibleColumns.length >= 5;
            return (
              <label
                key={field.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8,
                  background: isChecked ? '#EAF7EF' : '#F9FAFB',
                  border: isChecked ? '1px solid #86EFAC' : '1px solid #E5E7EB',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.5 : 1,
                }}
                onClick={() => {
                  if (isDisabled) return;
                  if (isChecked) {
                    setVisibleColumns(visibleColumns.filter(c => c !== field.name));
                  } else {
                    setVisibleColumns([...visibleColumns, field.name].slice(0, 5));
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => {}}
                  style={{ accentColor: '#009B3A', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>
                  {field.displayName || field.name.replace(/_/g, ' ')}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9CA3AF' }}>{field.dataType}</span>
              </label>
            );
          })}
        </div>
      </Modal>

      {/* ── Create Entity Modal ───────────────────────────────────── */}
      <Modal
        title={<span style={{ fontWeight: 600, fontSize: 14 }}>Create entity</span>}
        open={showCreateEntity}
        onOk={handleCreateEntity}
        onCancel={() => setShowCreateEntity(false)}
        okText="Create entity"
        okButtonProps={{ style: { background: '#009B3A', borderColor: '#009B3A' } }}
        width={640}
      >
        <EntityForm
          entity={newEntity} setEntity={setNewEntity}
          attributes={newAttributes}
          addAttribute={addAttribute}
          removeAttribute={removeAttribute}
          updateAttribute={updateAttribute}
        />
      </Modal>

      {/* ── Enhanced Edit Form Modal ───────────────────────────────────── */}
      <Modal
        title={<span style={{ fontWeight: 600, fontSize: 14 }}>Edit Form: {editingForm?.name || ''}</span>}
        open={showEditForm}
        onCancel={() => { setShowEditForm(false); setEditingForm(null); }}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => { setShowEditForm(false); setEditingForm(null); }}>
            Close
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={async () => {
              if (!editingForm) return;
              try {
                await formsApi.update(editingForm.id, {
                  name: editingForm.name,
                  description: editingForm.description,
                  formSchema: editingForm.formSchema,
                  duplicateConfig: editingForm.duplicateConfig,
                });
                message.success('Form updated successfully');
                setShowEditForm(false);
                setEditingForm(null);
                loadAll();
              } catch (err: any) {
                message.error(err?.response?.data?.message || 'Failed to update form');
              }
            }}
            style={{ background: '#009B3A', borderColor: '#009B3A' }}
          >
            Save Changes
          </Button>,
        ]}
      >
        {editingForm && selectedEntity && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}>
            {/* Form basic info */}
            <div>
              <label style={labelStyle}>Form Name</label>
              <Input
                size="large"
                value={editingForm.name}
                onChange={(e) => setEditingForm({ ...editingForm, name: e.target.value })}
                placeholder="Form name"
              />
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <Input.TextArea
                size="large"
                value={editingForm.description}
                onChange={(e) => setEditingForm({ ...editingForm, description: e.target.value })}
                rows={2}
                placeholder="Form description"
              />
            </div>

            {/* Duplicate Detection Configuration */}
            <div style={{
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
              borderRadius: 12,
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#E8611D' }}>
                    Duplicate Detection Settings
                  </span>
                  <p style={{ fontSize: 11, color: '#5F6880', marginTop: 4, marginBottom: 0 }}>
                    Configure how the system identifies and handles duplicate records
                  </p>
                </div>
                <Switch
                  checked={editingForm.duplicateConfig?.enabled !== false}
                  onChange={(checked) => {
                    setEditingForm({
                      ...editingForm,
                      duplicateConfig: { ...(editingForm.duplicateConfig || {}), enabled: checked },
                    });
                  }}
                />
              </div>

              {editingForm.duplicateConfig?.enabled !== false && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ ...labelStyle, marginBottom: 8 }}>
                      Identifier Fields (used for duplicate detection)
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(selectedEntity.attributes || [])
                        .filter((a: any) => a.isIdentifier)
                        .map((field: any) => (
                          <Tag key={field.name} color="orange" style={{ fontSize: 11, padding: '4px 8px' }}>
                            {field.displayName || field.name}
                          </Tag>
                        ))}
                    </div>
                    {(selectedEntity.attributes || []).filter((a: any) => a.isIdentifier).length === 0 && (
                      <div style={{
                        background: '#FEF3C7',
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                        color: '#92400E',
                      }}>
                        No identifier fields set. Go to Settings → Entities and mark fields as identifiers to enable duplicate detection.
                      </div>
                    )}
                    <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6 }}>
                      Records with matching values in identifier fields are considered duplicates.
                    </p>
                  </div>

                  <div>
                    <label style={{ ...labelStyle, marginBottom: 8 }}>
                      When duplicate is detected
                    </label>
                    <Select
                      size="large"
                      value={editingForm.duplicateConfig?.action || 'block'}
                      onChange={(value) => {
                        setEditingForm({
                          ...editingForm,
                          duplicateConfig: { ...(editingForm.duplicateConfig || {}), action: value },
                        });
                      }}
                      style={{ width: '100%' }}
                      options={[
                        { label: 'Block submission - Show error message', value: 'block' },
                        { label: 'Warn user but allow submission', value: 'warn' },
                        { label: 'Update existing record', value: 'update' },
                      ]}
                    />
                  </div>
                </>
              )}
            </div>

            {/* EDITABLE Form Fields */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={labelStyle}>Form Fields (click to edit)</label>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const fields = [...(editingForm.formSchema?.fields || [])];
                    fields.push({ name: '', type: 'text', required: false, label: '', isIdentifier: false });
                    setEditingForm({ ...editingForm, formSchema: { fields } });
                  }}
                >
                  Add Field
                </Button>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 400,
                overflowY: 'auto',
              }}>
                {(editingForm.formSchema?.fields || []).map((field: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      background: '#F9FAFB',
                      borderRadius: 8,
                      padding: '10px 12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Field Name */}
                    <Input
                      size="small"
                      placeholder="Field name"
                      value={field.name}
                      onChange={(e) => {
                        const fields = [...(editingForm.formSchema.fields)];
                        fields[idx] = { ...fields[idx], name: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                        setEditingForm({ ...editingForm, formSchema: { fields } });
                      }}
                      style={{ flex: 2, fontSize: 11, minWidth: 100 }}
                    />
                    {/* Field Label */}
                    <Input
                      size="small"
                      placeholder="Label"
                      value={field.label}
                      onChange={(e) => {
                        const fields = [...(editingForm.formSchema.fields)];
                        fields[idx] = { ...fields[idx], label: e.target.value };
                        setEditingForm({ ...editingForm, formSchema: { fields } });
                      }}
                      style={{ flex: 2, fontSize: 11, minWidth: 100 }}
                    />
                    {/* Field Type */}
                    <Select
                      size="small"
                      value={field.type || 'text'}
                      onChange={(v) => {
                        const fields = [...(editingForm.formSchema.fields)];
                        fields[idx] = { ...fields[idx], type: v };
                        if (v === 'select' && !fields[idx].options) {
                          fields[idx].options = [];
                        }
                        setEditingForm({ ...editingForm, formSchema: { fields } });
                      }}
                      style={{ width: 90, fontSize: 11 }}
                      options={[
                        { label: 'Text', value: 'text' },
                        { label: 'Number', value: 'number' },
                        { label: 'Date', value: 'date' },
                        { label: 'Yes/No', value: 'boolean' },
                        { label: 'Email', value: 'email' },
                        { label: 'Phone', value: 'phone' },
                        { label: 'Select', value: 'select' },
                        { label: 'Textarea', value: 'textarea' },
                      ]}
                    />
                    {/* Required Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Switch
                        size="small"
                        checked={field.required || false}
                        onChange={(v) => {
                          const fields = [...(editingForm.formSchema.fields)];
                          fields[idx] = { ...fields[idx], required: v };
                          setEditingForm({ ...editingForm, formSchema: { fields } });
                        }}
                      />
                      <span style={{ fontSize: 9, color: '#9CA3AF' }}>Req</span>
                    </div>
                    {/* Identifier Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Switch
                        size="small"
                        checked={field.isIdentifier || false}
                        onChange={(v) => {
                          const fields = [...(editingForm.formSchema.fields)];
                          fields[idx] = { ...fields[idx], isIdentifier: v };
                          setEditingForm({ ...editingForm, formSchema: { fields } });
                        }}
                      />
                      <span style={{ fontSize: 9, color: '#9CA3AF' }}>🔑 ID</span>
                    </div>
                    {/* Select Options */}
                    {field.type === 'select' && (
                      <Input
                        size="small"
                        placeholder="Options (comma separated)"
                        value={(field.options || []).join(', ')}
                        onChange={(e) => {
                          const fields = [...(editingForm.formSchema.fields)];
                          fields[idx] = {
                            ...fields[idx],
                            options: e.target.value.split(',').map((o: string) => o.trim()).filter(Boolean),
                          };
                          setEditingForm({ ...editingForm, formSchema: { fields } });
                        }}
                        style={{ width: 180, fontSize: 11 }}
                      />
                    )}
                    {/* Delete Field */}
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        const fields = editingForm.formSchema.fields.filter((_: any, i: number) => i !== idx);
                        setEditingForm({ ...editingForm, formSchema: { fields } });
                      }}
                    />
                  </div>
                ))}
              </div>
              {(editingForm.formSchema?.fields || []).length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: '#9CA3AF', fontSize: 11 }}>
                  No fields yet. Click "Add Field" to create one, or "Sync with Entity Fields" below.
                </div>
              )}
            </div>

            {/* Quick Sync Button */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                onClick={() => {
                  const fields = (selectedEntity.attributes || []).map((a: any) => ({
                    name: a.name,
                    type: a.dataType === 'number' ? 'number' : a.dataType === 'date' ? 'date' : a.dataType === 'boolean' ? 'boolean' : a.dataType === 'select' ? 'select' : 'text',
                    required: a.isRequired,
                    label: a.displayName || a.name.replace(/_/g, ' '),
                    options: a.options || [],
                    isIdentifier: a.isIdentifier || false,
                  }));
                  setEditingForm({
                    ...editingForm,
                    formSchema: { fields },
                    duplicateConfig: {
                      ...(editingForm.duplicateConfig || {}),
                      identifierFields: (selectedEntity.attributes || [])
                        .filter((a: any) => a.isIdentifier)
                        .map((a: any) => a.name),
                    },
                  });
                  message.success('Fields synced from entity');
                }}
                icon={<ReloadOutlined />}
                style={{ borderColor: '#E8611D', color: '#E8611D' }}
              >
                Sync with Entity Fields
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── FileFieldValue: renders a file with view/download ────────────────────────
function FileFieldValue({ value, simple }: { value: any; simple?: boolean }) {
  const fv = getFileValue(value);
  if (!fv) return <span style={{ fontSize: 12, color: '#9CA3AF' }}>—</span>;

  const img = isImage(fv.mimeType);

  if (simple) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {img ? (
          <Image
            src={fv.url}
            alt={fv.originalName}
            width={36}
            height={36}
            style={{ borderRadius: 4, objectFit: 'cover' }}
            preview={{ mask: <EyeOutlined style={{ fontSize: 14 }} /> }}
          />
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: 4, background: '#F3F4F6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileOutlined style={{ fontSize: 16, color: '#6B7280' }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 500, color: '#1A1F2E',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 120,
          }}>
            {fv.originalName}
          </div>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>{formatFileSize(fv.size)}</div>
        </div>
        <Tooltip title="View">
          <Button type="text" size="small" icon={<EyeOutlined />}
            style={{ fontSize: 11, color: '#6B7280' }}
            onClick={(e) => { e.stopPropagation(); window.open(fv.url, '_blank'); }} />
        </Tooltip>
        <Tooltip title="Download">
          <Button type="text" size="small" icon={<DownloadOutlined />}
            style={{ fontSize: 11, color: '#6B7280' }}
            onClick={(e) => {
              e.stopPropagation();
              const a = document.createElement('a');
              a.href = fv.url;
              a.download = fv.originalName;
              a.click();
            }} />
        </Tooltip>
      </div>
    );
  }

  // Full-width detail view (used inside the drawer)
  return (
    <div style={{
      border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px',
      background: '#F9FAFB', display: 'flex', alignItems: 'center', gap: 10,
      maxWidth: '100%',
    }}>
      {img ? (
        <Image
          src={fv.url}
          alt={fv.originalName}
          width={48}
          height={48}
          style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
          preview={{ mask: <EyeOutlined style={{ fontSize: 16 }} /> }}
        />
      ) : (
        <div style={{
          width: 48, height: 48, borderRadius: 6, background: '#EEF2FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FileOutlined style={{ fontSize: 22, color: '#4F46E5' }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 500, color: '#111827',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {fv.originalName}
        </div>
        <div style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', gap: 8 }}>
          <span>{formatFileSize(fv.size)}</span>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span style={{ textTransform: 'lowercase' }}>{fv.mimeType}</span>
        </div>
      </div>
      <Space size={2}>
        <Tooltip title="Open in new tab">
          <Button type="text" size="small" icon={<LinkOutlined />}
            style={{ color: '#6B7280' }}
            onClick={() => window.open(fv.url, '_blank')} />
        </Tooltip>
        <Tooltip title="Download">
          <Button type="text" size="small" icon={<DownloadOutlined />}
            style={{ color: '#6B7280' }}
            onClick={() => {
              const a = document.createElement('a');
              a.href = fv.url;
              a.download = fv.originalName;
              a.click();
            }} />
        </Tooltip>
      </Space>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ZambiaBar() {
  return (
    <div style={{
      height: 3,
      background: 'linear-gradient(90deg, #009B3A 0%, #009B3A 33%, #CE1126 33%, #CE1126 55%, #1A1F2E 55%, #1A1F2E 77%, #E8611D 77%, #E8611D 100%)',
      borderRadius: 2,
    }} />
  );
}

function OnboardSteps({ active }: { active: number }) {
  const steps = [
    { label: 'Create entity', desc: 'Define record types' },
    { label: 'Create form', desc: 'Build entry templates' },
    { label: 'Add records', desc: 'Enter or import data' },
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 0, marginBottom: 32 }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600,
              background: i < active ? '#EAF7EF' : i === active ? '#009B3A' : '#F3F4F6',
              color: i < active ? '#007d2e' : i === active ? '#fff' : '#9CA3AF',
              border: i < active ? '1px solid #009B3A' : i === active ? '1px solid #009B3A' : '1px solid #E5E7EB',
            }}>
              {i < active ? '✓' : i + 1}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: i === active ? 600 : 400, color: i === active ? '#111827' : '#6B7280' }}>{s.label}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>{i < active ? '✅ Done' : s.desc}</div>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 48, height: 0.5, background: '#E5E7EB', marginTop: 14, flexShrink: 0 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function EntityForm({ entity, setEntity, attributes, addAttribute, removeAttribute, updateAttribute }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Entity name <span style={{ color: '#EF4444' }}>*</span></label>
          <Input size="large" placeholder="e.g. beneficiary" value={entity.name}
            onChange={(e) => setEntity({ ...entity, name: e.target.value })} />
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>Lowercase with underscores</div>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <Input size="large" placeholder="What records will this store?" value={entity.description}
            onChange={(e) => setEntity({ ...entity, description: e.target.value })} />
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={labelStyle}>Fields</label>
          <Button size="small" icon={<PlusOutlined />} onClick={addAttribute}>Add field</Button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '32vh', overflowY: 'auto' }}>
          {attributes.map((attr: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#F9FAFB', borderRadius: 8, padding: '8px 10px', flexWrap: 'wrap' }}>
              <Input
                size="large" placeholder="Field name" value={attr.name}
                onChange={(e) => updateAttribute(i, { name: e.target.value })}
                style={{ flex: 2, fontSize: 12, minWidth: 120 }}
              />
              <Select
                size="small" value={attr.dataType}
                onChange={(v) => updateAttribute(i, { dataType: v })}
                style={{ width: 100 }}
                options={[
                  { label: 'Text', value: 'string' },
                  { label: 'Number', value: 'number' },
                  { label: 'Date', value: 'date' },
                  { label: 'Yes/No', value: 'boolean' },
                  { label: 'Email', value: 'email' },
                  { label: 'Phone', value: 'phone' },
                  { label: 'Select', value: 'select' },
                  { label: 'Textarea', value: 'textarea' },
                ]}
              />
              <Select
                size="small"
                value={attr.isRequired ? 'required' : 'optional'}
                onChange={(v) => updateAttribute(i, { isRequired: v === 'required' })}
                style={{ width: 85 }}
                options={[{ label: 'Required', value: 'required' }, { label: 'Optional', value: 'optional' }]}
              />
              {/* IDENTIFIER TOGGLE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px' }}>
                <Switch
                  size="small"
                  checked={attr.isIdentifier || false}
                  onChange={(v) => updateAttribute(i, { isIdentifier: v })}
                />
                <span style={{ fontSize: 9, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                  {attr.isIdentifier ? '🔑 ID' : 'ID'}
                </span>
              </div>
              {/* SELECT OPTIONS — show when dataType is 'select' */}
              {attr.dataType === 'select' && (
                <Input
                  size="small"
                  placeholder="Options (comma separated)"
                  value={attr.options ? attr.options.join(', ') : ''}
                  onChange={(e) => updateAttribute(i, { options: e.target.value.split(',').map((o: string) => o.trim()).filter(Boolean) })}
                  style={{ width: 180, fontSize: 11 }}
                />
              )}
              {attributes.length > 1 && (
                <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeAttribute(i)} />
              )}
            </div>
          ))}
        </div>
        <Text style={{ fontSize: 9, color: '#9CA3AF', marginTop: 4, display: 'block' }}>
          💡 <strong>Identifier (🔑)</strong>: Mark fields like email, NRC, or student_id as identifiers. 
          The system uses these to detect and prevent duplicate records.
          <br />
          💡 <strong>Select type</strong>: Choose "Select" as the data type, then enter comma-separated options (e.g. "Maize, Soya, Cotton").
        </Text>
      </div>
    </div>
  );
}

function FormCreator({ form, setForm, entities, selectedEntity, setSelectedEntity }: any) {
  const entity = entities.find((e: any) => e.id === selectedEntity);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
      <div>
        <label style={labelStyle}>Form name <span style={{ color: '#EF4444' }}>*</span></label>
        <Input size="large" placeholder="e.g. Beneficiary Registration"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label style={labelStyle}>Entity (record type) <span style={{ color: '#EF4444' }}>*</span></label>
        <Select
          size="large" value={selectedEntity || undefined} onChange={setSelectedEntity}
          placeholder="Select entity" style={{ width: '100%' }}
          options={entities.map((e: any) => ({
            label: `${e.name.replace(/_/g, ' ')} (${e.attributes?.length || 0} fields)`,
            value: e.id,
          }))}
        />
      </div>
      <div>
        <label style={labelStyle}>Description</label>
        <Input.TextArea size="large" placeholder="When to use this form…"
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
      </div>
      {entity && (
        <div style={{ background: '#EAF7EF', borderRadius: 8, padding: '10px 14px' }}>
          <Text style={{ fontSize: 11, fontWeight: 500, color: '#007d2e', display: 'block', marginBottom: 6 }}>
            Fields will be auto-generated
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(entity.attributes || []).map((a: any) => (
              <Tag key={a.name} color="green" style={{ fontSize: 10, margin: 0 }}>
                {a.displayName || a.name} ({a.dataType})
              </Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: '#6B7280', marginBottom: 5, fontWeight: 500,
};