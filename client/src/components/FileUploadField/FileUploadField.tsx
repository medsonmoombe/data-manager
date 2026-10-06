import React, { useState, useRef } from 'react';
import { Button, message, Space, Typography, Progress } from 'antd';
import { UploadOutlined, FileOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, LinkOutlined } from '@ant-design/icons';
import api from '../../api/axios';

const { Text } = Typography;

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_SIZE = 10 * 1024 * 1024;

interface FileValue {
  url: string;
  path: string;
  originalName: string;
  size: number;
  mimeType: string;
}

interface Props {
  formId?: string;
  value?: FileValue | string | null;
  onChange: (value: FileValue | null) => void;
  accept?: string;
  maxSize?: number;
  label?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mime: string): boolean {
  return mime?.startsWith('image/');
}

function getFileValue(value: FileValue | string | null | undefined): FileValue | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  if (typeof value === 'object' && value.url) return value;
  return null;
}

export default function FileUploadField({ formId, value, onChange, accept, maxSize = MAX_SIZE, label }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const fileValue = getFileValue(value);

  const validateFile = (file: File): string | null => {
    const allowed = accept?.split(',').map(t => t.trim()) || ALLOWED_TYPES;
    const matched = allowed.some(t => {
      if (t.endsWith('/*')) return file.type.startsWith(t.replace('/*', '/'));
      return t === file.type;
    });
    if (!matched) return `File type "${file.type || 'unknown'}" is not allowed. Accepted: ${allowed.join(', ')}`;
    if (file.size > maxSize) return `File is too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(maxSize)}.`;
    return null;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      message.error(error);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res: any = await api.post(`/forms/${formId}/upload-file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (p) => {
          if (p.total) setProgress(Math.round((p.loaded / p.total) * 100));
        },
      });

      const data = res.data || res;
      onChange({
        url: data.url,
        path: data.path,
        originalName: data.originalName,
        size: data.size,
        mimeType: data.mimeType,
      });
      message.success(`${file.name} uploaded`);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  if (fileValue) {
    const isImg = isImage(fileValue.mimeType);
    return (
      <div style={{
        border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px',
        background: '#F9FAFB', display: 'flex', alignItems: 'center', gap: 10,
        maxWidth: 320, width: '100%',
      }}>
        {isImg ? (
          <img src={fileValue.url} alt={fileValue.originalName}
            style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
        ) : (
          <FileOutlined style={{ fontSize: 24, color: '#6B7280' }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileValue.originalName}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>{formatFileSize(fileValue.size)}</div>
        </div>
        <Space size={4}>
          <Button type="text" size="small" icon={<EyeOutlined />}
            onClick={() => window.open(fileValue.url, '_blank')} />
          <Button type="text" size="small" icon={<DownloadOutlined />}
            onClick={() => {
              const a = document.createElement('a');
              a.href = fileValue.url;
              a.download = fileValue.originalName;
              a.click();
            }} />
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={handleRemove} />
        </Space>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept={accept || ALLOWED_TYPES.join(',')}
        onChange={handleUpload}
        style={{ display: 'none' }}
      />
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          border: '1px dashed #D1D5DB', borderRadius: 8, padding: '16px 12px',
          textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer',
          background: '#FAFAFA', transition: 'border-color 0.2s',
          maxWidth: 320, width: '100%',
        }}
        onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.borderColor = '#009B3A'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#D1D5DB'; }}
      >
        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <UploadOutlined style={{ fontSize: 20, color: '#009B3A' }} />
            <Text style={{ fontSize: 11, color: '#6B7280' }}>Uploading...</Text>
            <Progress percent={progress} size="small" style={{ width: 120 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <UploadOutlined style={{ fontSize: 20, color: '#9CA3AF' }} />
            <Text style={{ fontSize: 11, color: '#6B7280' }}>
              {label ? `Upload ${label}` : 'Click to upload'}
            </Text>
            <Text style={{ fontSize: 9, color: '#9CA3AF' }}>
              Max {formatFileSize(maxSize)} — Images, PDF, CSV, Excel, Word
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}

export { getFileValue, formatFileSize, isImage };
export type { FileValue };
