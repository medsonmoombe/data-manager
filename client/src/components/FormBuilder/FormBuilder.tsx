import React, { useState } from 'react';
import { Card, Input, Select, Button, Switch, Space, Typography, message, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, DragOutlined, SaveOutlined, EyeOutlined } from '@ant-design/icons';
import { formsApi } from '../../api';

const { Text } = Typography;

interface FormField {
  key: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'boolean' | 'email' | 'phone' | 'file';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface Props {
  formId?: string;
  initialSchema?: { fields: FormField[] };
  onSave?: (schema: any) => void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'date', label: 'Date Picker' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'boolean', label: 'Yes/No Switch' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'file', label: 'File Upload' },
];

export default function FormBuilder({ formId, initialSchema, onSave }: Props) {
  const [fields, setFields] = useState<FormField[]>(initialSchema?.fields || []);
  const [preview, setPreview] = useState(false);

  const addField = () => {
    const newField: FormField = {
      key: `field_${Date.now()}`,
      name: '',
      type: 'text',
      label: '',
      required: false,
      placeholder: '',
    };
    setFields([...fields, newField]);
  };

  const removeField = (key: string) => {
    setFields(fields.filter((f) => f.key !== key));
  };

  const updateField = (key: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.key === key ? { ...f, ...updates } : f)));
  };

  const handleSave = async () => {
    const schema = { fields: fields.map(({ key, ...rest }) => rest) };
    try {
      if (formId) {
        await formsApi.update(formId, { formSchema: schema });
        message.success('Form updated');
      }
      onSave?.(schema);
    } catch (err) {
      message.error('Failed to save form');
    }
  };

  const renderPreviewField = (field: FormField) => {
    switch (field.type) {
      case 'select':
        return <Select placeholder={field.placeholder || `Select ${field.label}`} style={{ width: '100%' }} size="small" options={(field.options || []).map((o) => ({ label: o, value: o }))} />;
      case 'textarea':
        return <Input.TextArea placeholder={field.placeholder || `Enter ${field.label}`} rows={3} size="small" />;
      case 'boolean':
        return <Switch />;
      case 'number':
        return <Input type="number" placeholder={field.placeholder || `Enter ${field.label}`} size="small" />;
      case 'date':
        return <Input type="date" placeholder={field.placeholder || `Select ${field.label}`} size="small" />;
      case 'file':
        return (
          <div style={{ border: '1px dashed #D1D5DB', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#9CA3AF' }}>
            Upload: {field.label}
          </div>
        );
      default:
        return <Input placeholder={field.placeholder || `Enter ${field.label}`} size="small" />;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={addField} style={{ fontSize: 11, borderRadius: 6 }}>Add Field</Button>
          <Button size="small" icon={preview ? <EyeOutlined /> : <DragOutlined />} onClick={() => setPreview(!preview)} style={{ fontSize: 11, borderRadius: 6 }}>
            {preview ? 'Edit' : 'Preview'}
          </Button>
        </Space>
        <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleSave} style={{ fontSize: 11, borderRadius: 6, background: '#111827' }}>
          Save Form
        </Button>
      </div>

      {preview ? (
        <Card title={<span style={{ fontSize: 13, fontWeight: 600 }}>Form Preview</span>} bodyStyle={{ padding: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fields.map((field) => (
              <div key={field.key}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>
                  {field.label || field.name} {field.required && <span style={{ color: '#DC2626' }}>*</span>}
                </label>
                {renderPreviewField(field)}
              </div>
            ))}
            {fields.length === 0 && <Text style={{ fontSize: 12, color: '#9CA3AF' }}>No fields added yet</Text>}
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fields.map((field, index) => (
            <Card key={field.key} size="small" bodyStyle={{ padding: 10 }}>
              <Row gutter={[8, 8]} align="middle">
                <Col span={5}>
                  <Input
                    size="small"
                    placeholder="Field name"
                    value={field.name}
                    onChange={(e) => updateField(field.key, { name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    style={{ fontSize: 11 }}
                  />
                </Col>
                <Col span={5}>
                  <Input
                    size="small"
                    placeholder="Label"
                    value={field.label}
                    onChange={(e) => updateField(field.key, { label: e.target.value })}
                    style={{ fontSize: 11 }}
                  />
                </Col>
                <Col span={4}>
                  <Select
                    size="small"
                    value={field.type}
                    onChange={(v) => updateField(field.key, { type: v })}
                    style={{ width: '100%', fontSize: 11 }}
                    options={FIELD_TYPES}
                  />
                </Col>
                <Col span={3}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Switch size="small" checked={field.required} onChange={(v) => updateField(field.key, { required: v })} />
                    <Text style={{ fontSize: 10, color: '#9CA3AF' }}>Req</Text>
                  </div>
                </Col>
                <Col span={5}>
                  <Input
                    size="small"
                    placeholder="Placeholder"
                    value={field.placeholder}
                    onChange={(e) => updateField(field.key, { placeholder: e.target.value })}
                    style={{ fontSize: 11 }}
                  />
                </Col>
                <Col span={2} style={{ textAlign: 'right' }}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeField(field.key)} style={{ fontSize: 11 }} />
                </Col>
              </Row>
            </Card>
          ))}
          {fields.length === 0 && (
            <Card bodyStyle={{ padding: 24, textAlign: 'center' }}>
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>No fields yet. Click "Add Field" to start building your form.</Text>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}