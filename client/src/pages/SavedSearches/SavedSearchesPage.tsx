import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Input, Space, Tag, Typography, Modal, message,
  Popconfirm, Tooltip, Select, Drawer, Empty, Row, Col, Form,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, SearchOutlined, DeleteOutlined,
  EyeOutlined, CopyOutlined, SaveOutlined, FilterOutlined,
  ClockCircleOutlined, UserOutlined, ShareAltOutlined,
} from '@ant-design/icons';
import api from '../../api/axios';

const { Text } = Typography;

function ZambiaBar() {
  return (
    <div style={{
      height: 3, marginBottom: 16, borderRadius: 2,
      background: 'linear-gradient(90deg, #009B3A 0%, #009B3A 33%, #CE1126 33%, #CE1126 55%, #1A1F2E 55%, #1A1F2E 77%, #E8611D 77%, #E8611D 100%)',
    }} />
  );
}

export default function SavedSearchesPage() {
  const [loading, setLoading] = useState(false);
  const [searches, setSearches] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [resultsTitle, setResultsTitle] = useState('');
  const [newSearch, setNewSearch] = useState({
    name: '',
    description: '',
    entityName: '',
    query: { conditions: [] as any[], logic: 'AND' as 'AND' | 'OR' },
  });
  const [entityOptions, setEntityOptions] = useState<any[]>([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sRes, eRes] = await Promise.all([
        api.get('/saved-searches').catch(() => ({ data: [] })),
        api.get('/entities').catch(() => ({ data: [] })),
      ]);
      const sData = sRes.data?.data || sRes.data || [];
      setSearches(Array.isArray(sData) ? sData : []);
      const eData = eRes.data?.data || eRes.data || [];
      setEntityOptions(Array.isArray(eData) ? eData : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newSearch.name || !newSearch.entityName) {
      message.warning('Name and entity are required');
      return;
    }
    try {
      await api.post('/saved-searches', newSearch);
      message.success('Search saved');
      setShowCreate(false);
      setNewSearch({ name: '', description: '', entityName: '', query: { conditions: [], logic: 'AND' } });
      loadAll();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to save search');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/saved-searches/${id}`);
      message.success('Search deleted');
      loadAll();
    } catch (err) { message.error('Failed to delete'); }
  };

  const handleExecute = async (search: any) => {
    setExecutingId(search.id);
    setResultsTitle(search.name);
    try {
      const res: any = await api.get(`/saved-searches/${search.id}/execute`);
      const data = res.data || res;
      setSearchResults(data.data || []);
      setResultsTotal(data.total || 0);
      setResultsOpen(true);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to execute search');
    }
    finally { setExecutingId(null); }
  };

  const getEntityName = (entityName: string) => {
    const e = entityOptions.find((e: any) => e.name === entityName);
    return e ? e.name.replace(/_/g, ' ') : entityName;
  };

  // Get columns from first result's data
  const getResultColumns = () => {
    if (searchResults.length === 0) return [];
    const first = searchResults[0];
    const dataKeys = first.data ? Object.keys(first.data).slice(0, 8) : [];
    return [
      {
        title: 'ID', dataIndex: 'id', key: 'id', width: 80,
        render: (v: string) => <code className="text-[9px]">{v?.substring(0, 8)}...</code>,
      },
      ...dataKeys.map((k) => ({
        title: k.replace(/_/g, ' ').toUpperCase(),
        key: k,
        ellipsis: true,
        render: (_: any, r: any) => {
          const val = r.data?.[k];
          return <span className="text-[11px]">{val !== undefined && val !== null ? String(val) : '—'}</span>;
        },
      })),
      {
        title: 'CREATED', dataIndex: 'createdAt', key: 'createdAt', width: 100,
        render: (v: string) => <span className="text-[10px] text-[#9CA3AF]">{v ? new Date(v).toLocaleDateString() : '—'}</span>,
      },
    ];
  };

  return (
    <div>
      <PageHeader title="Saved Searches" subtitle="Save, manage, and re-run complex search queries">
        <Button size="small" icon={<ReloadOutlined />} onClick={loadAll}>Refresh</Button>
        <Button type="primary" size="small" icon={<PlusOutlined />}
          onClick={() => setShowCreate(true)} className="!bg-[#009B3A]">New Saved Search</Button>
      </PageHeader>

      {/* Stats */}
      <Row gutter={12} className="mb-4">
        <Col span={8}><StatCard label="Total Saved Searches" value={searches.length} color="black" /></Col>
        <Col span={8}><StatCard label="Shared with Team" value={searches.filter((s: any) => s.isPublic).length} color="green" /></Col>
        <Col span={8}><StatCard label="Entities Searched" value={new Set(searches.map((s: any) => s.entityName)).size} color="blue" /></Col>
      </Row>

      {/* Searches List */}
      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
        {searches.length > 0 ? (
          <Table
            dataSource={searches}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{ size: 'small', pageSize: 15, showTotal: (t) => `${t} searches` }}
            columns={[
              {
                title: 'NAME', dataIndex: 'name', key: 'name',
                render: (v: string, r: any) => (
                  <div>
                    <div className="text-[12px] font-semibold flex items-center gap-2">
                      {v}
                      {r.isPublic && <ShareAltOutlined className="text-[10px] text-[#009B3A]" />}
                    </div>
                    {r.description && (
                      <div className="text-[10px] text-[#9CA3AF]">{r.description}</div>
                    )}
                  </div>
                ),
              },
              {
                title: 'ENTITY', dataIndex: 'entityName', key: 'entity',
                render: (v: string) => (
                  <Tag className="!text-[10px]" color="blue">{getEntityName(v)}</Tag>
                ),
              },
              {
                title: 'CONDITIONS', key: 'conditions',
                render: (_: any, r: any) => {
                  const conds = r.query?.conditions || [];
                  return (
                    <Space size={3} wrap>
                      {conds.slice(0, 3).map((c: any, i: number) => (
                        <Tag key={i} className="!text-[9px]" style={{ background: '#F3F4F6', border: 'none' }}>
                          {c.field} {c.operator} {c.value}
                        </Tag>
                      ))}
                      {conds.length > 3 && (
                        <span className="text-[9px] text-[#9CA3AF]">+{conds.length - 3} more</span>
                      )}
                      {conds.length === 0 && <span className="text-[9px] text-[#9CA3AF]">No conditions</span>}
                    </Space>
                  );
                },
              },
              {
                title: 'SORT', key: 'sort',
                render: (_: any, r: any) => (
                  <span className="text-[10px] text-[#6B7280]">
                    {r.sortField || 'createdAt'} ({r.sortDirection || 'desc'})
                  </span>
                ),
              },
              {
                title: 'UPDATED', dataIndex: 'updatedAt', key: 'updated',
                render: (v: string) => (
                  <span className="text-[10px] text-[#9CA3AF]">
                    {v ? new Date(v).toLocaleDateString() : '—'}
                  </span>
                ),
              },
              {
                title: '', key: 'actions', width: 120,
                render: (_: any, r: any) => (
                  <Space size={4}>
                    <Tooltip title="Run Search">
                      <Button size="small" type="link" icon={<SearchOutlined />}
                        loading={executingId === r.id}
                        onClick={() => handleExecute(r)}
                        className="!text-[#009B3A] !text-[10px]" />
                    </Tooltip>
                    <Popconfirm title="Delete this saved search?" onConfirm={() => handleDelete(r.id)}>
                      <Tooltip title="Delete">
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} className="!text-[10px]" />
                      </Tooltip>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />          ) : (
            <EmptyState
              icon={<SaveOutlined />}
              title="No Saved Searches"
              description="Save complex search queries to quickly re-run them later"
              action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)} className="!bg-[#009B3A]">Create Your First Saved Search</Button>}
            />
          )}
      </Card>

      {/* Create Saved Search Modal */}
      <Modal
        title={<span className="font-bold text-[14px]">Save Search Query</span>}
        open={showCreate}
        onOk={handleCreate}
        onCancel={() => { setShowCreate(false); setNewSearch({ name: '', description: '', entityName: '', query: { conditions: [], logic: 'AND' } }); }}
        okText="Save Search"
        okButtonProps={{ style: { background: '#009B3A', borderColor: '#009B3A' } }}
        width={560}
      >
        <div className="flex flex-col gap-3 mt-3">
          <Input
            size="large"
            placeholder="Search name (e.g. All Maize Farmers in Lusaka)"
            value={newSearch.name}
            onChange={(e) => setNewSearch({ ...newSearch, name: e.target.value })}
          />
          <Input
            size="large"
            placeholder="Description (optional)"
            value={newSearch.description}
            onChange={(e) => setNewSearch({ ...newSearch, description: e.target.value })}
          />
          <Select
            size="large"
            placeholder="Select entity type"
            value={newSearch.entityName || undefined}
            onChange={(v) => setNewSearch({ ...newSearch, entityName: v })}
            options={entityOptions.map((e: any) => ({
              label: e.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
              value: e.name,
            }))}
          />

          <div className="border-t border-[#EEF0F4] my-1" />

          <div className="text-[11px] font-semibold text-[#111827]">Query Logic</div>
          <Select
            size="small"
            value={newSearch.query.logic}
            onChange={(v) => setNewSearch({ ...newSearch, query: { ...newSearch.query, logic: v as 'AND' | 'OR' } })}
            options={[
              { label: 'AND — Match all conditions', value: 'AND' },
              { label: 'OR — Match any condition', value: 'OR' },
            ]}
          />

          <div className="text-[11px] font-semibold text-[#111827]">Conditions</div>
          {(newSearch.query.conditions || []).map((cond: any, i: number) => {
            const entity = entityOptions.find((e: any) => e.name === newSearch.entityName);
            const fields = entity?.attributes || [];
            return (
              <div key={i} className="flex items-center gap-2">
                <Select
                  size="small"
                  placeholder="Field"
                  value={cond.field || undefined}
                  onChange={(v) => {
                    const conditions = [...newSearch.query.conditions];
                    conditions[i] = { ...conditions[i], field: v };
                    setNewSearch({ ...newSearch, query: { ...newSearch.query, conditions } });
                  }}
                  style={{ width: 140 }}
                  options={fields.map((f: any) => ({ label: f.displayName || f.name, value: f.name }))}
                />
                <Select
                  size="small"
                  value={cond.operator || 'contains'}
                  onChange={(v) => {
                    const conditions = [...newSearch.query.conditions];
                    conditions[i] = { ...conditions[i], operator: v };
                    setNewSearch({ ...newSearch, query: { ...newSearch.query, conditions } });
                  }}
                  style={{ width: 100 }}
                  options={[
                    { label: 'Contains', value: 'contains' },
                    { label: 'Equals', value: 'equals' },
                    { label: 'Greater Than', value: 'gt' },
                    { label: 'Less Than', value: 'lt' },
                  ]}
                />
                <Input
                  size="small"
                  placeholder="Value"
                  value={cond.value || ''}
                  onChange={(e) => {
                    const conditions = [...newSearch.query.conditions];
                    conditions[i] = { ...conditions[i], value: e.target.value };
                    setNewSearch({ ...newSearch, query: { ...newSearch.query, conditions } });
                  }}
                  style={{ flex: 1 }}
                />
                <Button size="small" type="text" danger icon={<DeleteOutlined />}
                  onClick={() => {
                    setNewSearch({
                      ...newSearch,
                      query: { ...newSearch.query, conditions: newSearch.query.conditions.filter((_: any, j: number) => j !== i) },
                    });
                  }} />
              </div>
            );
          })}
          <Button size="small" icon={<PlusOutlined />}
            onClick={() => {
              setNewSearch({
                ...newSearch,
                query: { ...newSearch.query, conditions: [...newSearch.query.conditions, { field: '', operator: 'contains', value: '' }] },
              });
            }}
            disabled={!newSearch.entityName}>
            Add Condition
          </Button>
        </div>
      </Modal>

      {/* Results Drawer */}
      <Drawer
        title={<span className="font-bold text-[13px]">{resultsTitle} — {resultsTotal} results</span>}
        open={resultsOpen}
        onClose={() => setResultsOpen(false)}
        width={800}
        extra={
          <Button size="small" icon={<ReloadOutlined />}
            onClick={() => {
              const s = searches.find((s: any) => s.name === resultsTitle);
              if (s) handleExecute(s);
            }}
            className="!text-[9px]">
            Refresh
          </Button>
        }
      >
        {searchResults.length > 0 ? (
          <div>
            <Table
              dataSource={searchResults}
              rowKey="id"
              size="small"
              pagination={{ size: 'small', pageSize: 20, showTotal: (t) => `${t} records` }}
              scroll={{ x: 600 }}
              columns={getResultColumns()}
            />
          </div>
        ) : (
          <Empty description="No results found" />
        )}
      </Drawer>
    </div>
  );
}
