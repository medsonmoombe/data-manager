import React, { useEffect, useState, useRef } from 'react';
import {
  Table, Button, Input, Space, Tag, Card, Typography, Modal, Drawer, Tabs,
  Row, Col, Statistic, Progress, Timeline, Descriptions, Select, message,
  Popconfirm, Tooltip, Badge, Avatar, Switch, Checkbox,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, MergeCellsOutlined, ScanOutlined,
  ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, DeleteOutlined, LinkOutlined, HistoryOutlined,
  NodeIndexOutlined, ApartmentOutlined, ArrowLeftOutlined, LineChartOutlined,
  WarningOutlined, SafetyOutlined, BranchesOutlined,
  ClusterOutlined, DisconnectOutlined, FilterOutlined, PlusOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { entitiesApi } from '../../api/entity.api';

const { Text, Title } = Typography;

export default function IntelligencePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('duplicates');
  const [loading, setLoading] = useState(false);

  // ============ DUPLICATES STATE ============
  const [duplicateSummary, setDuplicateSummary] = useState<any>(null);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [duplicateFilter, setDuplicateFilter] = useState<string>('all');
  const [mergeLoading, setMergeLoading] = useState<string | null>(null);

  // ============ SCAN PROGRESS ============
  const [scanProgress, setScanProgress] = useState<any>(null);
  const [scanJobId, setScanJobId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ============ SUGGESTIONS STATE ============
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionFilter, setSuggestionFilter] = useState<string>('pending');

  // ============ SEARCH STATE ============
  const [searchQuery, setSearchQuery] = useState('');
  const [searchEntity, setSearchEntity] = useState('');
  const [entityOptions, setEntityOptions] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // ============ PROFILE STATE ============
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileEntity, setProfileEntity] = useState('');

  // ============ LINEAGE STATE ============
  const [lineageOpen, setLineageOpen] = useState(false);
  const [lineageData, setLineageData] = useState<any>(null);
  const [lineageLoading, setLineageLoading] = useState(false);

  // ============ AUTO-LINK RULES ============
  const [autoLinkRules, setAutoLinkRules] = useState<any[]>([]);
  const [pendingAutoLinks, setPendingAutoLinks] = useState<any[]>([]);
  const [ruleMatchesOpen, setRuleMatchesOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [ruleMatchesList, setRuleMatchesList] = useState<any[]>([]);
  const [compareViewMatch, setCompareViewMatch] = useState<any>(null);
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [bulkLinking, setBulkLinking] = useState(false);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [newRule, setNewRule] = useState({
    name: '', sourceEntityType: '', targetEntityType: '',
    fieldMappings: [{ sourceField: '', targetField: '', matchType: 'exact' }],
    relationshipType: '', autoAcceptAbove: 0.95, suggestAbove: 0.5, priority: 0,
  });

  // ============ SIDE-BY-SIDE COMPARISON ============
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareRecords, setCompareRecords] = useState<[any, any] | null>(null);
  const [compareMatchedFields, setCompareMatchedFields] = useState<string[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareSuggestion, setCompareSuggestion] = useState<any>(null);

  // ============ NARRATIVE REPORT ============
  const [reportPeriod, setReportPeriod] = useState('month');
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dupSummary, dupList, sugList, rulesList, entList, pendingRelList] = await Promise.all([
        api.get('/intelligence/duplicates/summary').catch(() => ({ data: null })),
        api.get('/intelligence/duplicates').catch(() => ({ data: [] })),
        api.get('/intelligence/suggestions').catch(() => ({ data: [] })),
        api.get('/intelligence/auto-link-rules').catch(() => ({ data: [] })),
        entitiesApi.list().catch(() => ({ data: [] })),
        api.get('/intelligence/suggestions', { params: { type: 'relationship', status: 'pending' } }).catch(() => ({ data: [] })),
      ]);


      setDuplicateSummary(dupSummary.data || dupSummary);
      setDuplicates(dupList.data?.data || dupList.data || []);
      setSuggestions(sugList.data?.data || sugList.data || []);
      setAutoLinkRules(rulesList.data?.data || rulesList.data || []);
      setPendingAutoLinks(pendingRelList.data?.data || pendingRelList.data || []);
      setEntityOptions(entList.data || entList || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // ============ DUPLICATE ACTIONS ============
  const handleMerge = async (suggestionId: string) => {
    setMergeLoading(suggestionId);
    try {
      const res: any = await api.post(`/intelligence/duplicates/${suggestionId}/merge`);
      // Optimistically remove the row immediately so the count drops
      setDuplicates(prev => prev.filter(d => d.id !== suggestionId));
      message.success(
        res.data?.mergedCount
          ? `Merged ${res.data.mergedCount} record(s) into 1. Duplicates reduced.`
          : 'Records merged successfully'
      );
      // Then refresh everything to get accurate counts
      loadAll();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to merge');
    }
    finally { setMergeLoading(null); }
  };

  const startScan = async () => {
    setScanProgress(null);
    if (pollingRef.current) clearInterval(pollingRef.current);
    try {
      const res: any = await api.post('/intelligence/duplicates/scan', {});
      const jobId = res.data?.jobId || res.jobId;
      setScanJobId(jobId);

      pollingRef.current = setInterval(async () => {
        try {
          const prog: any = await api.get(`/intelligence/duplicates/scan/${jobId}/progress`);
          const data = prog.data || prog;
          setScanProgress(data);
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            loadAll();
          }
        } catch { /* ignore polling errors */ }
      }, 1000);
    } catch (err) { message.error('Scan failed'); }
  };

  // ============ SUGGESTION ACTIONS ============
  const handleAcceptSuggestion = async (id: string) => {
    try {
      await api.post(`/intelligence/suggestions/${id}/accept`);
      message.success('Suggestion accepted');
      loadAll();
    } catch (err) { message.error('Failed'); }
  };

  const handleRejectSuggestion = async (id: string) => {
    try {
      await api.post(`/intelligence/suggestions/${id}/reject`);
      message.success('Suggestion rejected');
      loadAll();
    } catch (err) { message.error('Failed'); }
  };

  // ============ SIDE-BY-SIDE COMPARISON ============
  const openComparison = async (suggestion: any) => {
    setCompareSuggestion(suggestion);
    setCompareOpen(true);
    setCompareLoading(true);
    setCompareRecords(null);
    try {
      // Use cached record data from backend matches endpoint if available
      if (suggestion.recordDataA && suggestion.recordDataB) {
        setCompareRecords([suggestion.recordDataA, suggestion.recordDataB]);
        setCompareMatchedFields(suggestion.matchedFields || []);
        setCompareLoading(false);
        return;
      }
      const entityTypeA = suggestion.entityTypeA || 'Beneficiary';
      const entityTypeB = suggestion.entityTypeB || 'Beneficiary';
      const [profileA, profileB] = await Promise.all([
        api.get(`/intelligence/profile/${entityTypeA}/${suggestion.entityIdA}`).catch(() => ({ data: null })),
        api.get(`/intelligence/profile/${entityTypeB}/${suggestion.entityIdB}`).catch(() => ({ data: null })),
      ]);
      const dataA = profileA.data?.masterData || profileA.data?.data || {};
      const dataB = profileB.data?.masterData || profileB.data?.data || {};
      setCompareRecords([dataA, dataB]);

      const action = suggestion.proposedAction || {};
      const mappings = action.fieldMappings || [];
      setCompareMatchedFields(mappings.map((m: any) => m.sourceField || m.targetField).filter(Boolean));
    } catch (err) {
      message.error('Failed to load comparison data');
    }
    setCompareLoading(false);
  };

  // ============ SEARCH ============
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res: any = await api.get('/intelligence/search', {
        params: { q: searchQuery, entityType: searchEntity || undefined, includeRelationships: true, includeTimeline: true },
      });
      const allResults = res.data?.results || [];
      setSearchResults(allResults);
      const summary = res.data?.summary;
      if (summary && summary.total > 0) {
        message.info(`Found ${summary.total} results across ${Object.keys(summary.byType).length} categories`);
      }
    } catch (err) { console.error(err); }
    finally { setSearchLoading(false); }
  };

  // ============ PROFILE ============
  const viewProfile = async (entityType: string, recordId: string) => {
    setProfileEntity(entityType);
    setProfileOpen(true);
    setProfileLoading(true);
    try {
      const res: any = await api.get(`/intelligence/profile/${entityType}/${recordId}`);
      setProfileData(res.data || res);
    } catch (err) { setProfileData(null); }
    finally { setProfileLoading(false); }
  };

  // ============ LINEAGE ============
  const viewLineage = async (entityType: string, recordId: string) => {
    setLineageOpen(true);
    setLineageLoading(true);
    try {
      const res: any = await api.get(`/intelligence/lineage/${entityType}/${recordId}`);
      setLineageData(res.data || res);
    } catch (err) { setLineageData(null); }
    finally { setLineageLoading(false); }
  };

  // ============ NARRATIVE REPORT ============
  const generateReport = async () => {
    setReportLoading(true);
    try {
      const res: any = await api.get('/intelligence/reports/narrative', {
        params: { period: reportPeriod },
      });
      setReportData(res.data || res);
      message.success('Report generated');
    } catch (err) { message.error('Failed'); }
    finally { setReportLoading(false); }
  };

  // ============ AUTO-LINK RULES ============
  const createRule = async () => {
    try {
      await api.post('/intelligence/auto-link-rules', newRule);
      message.success('Rule created');
      setShowCreateRule(false);
      setNewRule({
        name: '', sourceEntityType: '', targetEntityType: '',
        fieldMappings: [{ sourceField: '', targetField: '', matchType: 'exact' }],
        relationshipType: '', autoAcceptAbove: 0.95, suggestAbove: 0.5, priority: 0,
      });
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  const deleteRule = async (id: string) => {
    try {
      await api.delete(`/intelligence/auto-link-rules/${id}`);
      message.success('Rule deleted');
      loadAll();
    } catch (err) { message.error('Failed'); }
  };

  const runAutoLink = async () => {
    try {
      await api.post('/intelligence/auto-link/run');
      message.success('Auto-link started');
      setTimeout(loadAll, 3000);
    } catch (err) { message.error('Failed'); }
  };

  const viewRuleMatches = async (rule: any) => {
    setSelectedRule(rule);
    setRuleMatchesOpen(true);
    setRuleMatchesList([]);
    try {
      const res: any = await api.get(`/intelligence/auto-link-rules/${rule.id}/matches`);
      const data = res.data || res;
    
      const ruleData = data.rule || rule;
      const fieldMappings = ruleData.fieldMappings || [];
      const relType = ruleData.relationshipType || rule.relationshipType;
      const matches = (data.matches || []).map((m: any, i: number) => ({
        id: m.existingSuggestionId || `match_${i}`,
        title: `Suggested: ${ruleData.sourceEntityType?.replace(/_/g, ' ')} ↔ ${ruleData.targetEntityType?.replace(/_/g, ' ')}`,
        description: `Confidence: ${Math.round(m.confidence * 100)}% · ${m.existingRelation ? 'Already linked' : 'New match'}`,
        entityTypeA: ruleData.sourceEntityType,
        entityIdA: m.sourceRecord?.id,
        entityTypeB: ruleData.targetEntityType,
        entityIdB: m.targetRecord?.id,
        confidence: m.confidence,
        status: m.existingSuggestionId ? 'pending' : 'new',
        proposedAction: { action: 'create_relationship', relationshipType: relType, fieldMappings },
        recordDataA: m.sourceRecord?.data,
        recordDataB: m.targetRecord?.data,
        matchedFields: m.matchedFields,
        isNew: !m.existingSuggestionId,
      }));
      setRuleMatchesList(matches);
      setSelectedMatchIds([]);
    } catch (err) {
      message.error('Failed to load matches from server');
      const matches = pendingAutoLinks.filter((s: any) =>
        s.entityTypeA === rule.sourceEntityType && s.entityTypeB === rule.targetEntityType
      );
      setRuleMatchesList(matches);
      setSelectedMatchIds([]);
    }
  };

  const handleBulkLink = async () => {
    const selected = ruleMatchesList.filter(s => selectedMatchIds.includes(s.id));
    if (selected.length === 0) return;
    setBulkLinking(true);
    try {
      const relationships = selected.map(s => ({
        sourceEntityType: s.entityTypeA,
        sourceRecordId: s.entityIdA,
        targetEntityType: s.entityTypeB,
        targetRecordId: s.entityIdB,
        relationshipType: s.proposedAction?.relationshipType,
        confidence: s.confidence,
        ...(s.status === 'pending' ? { existingSuggestionId: s.id } : {}),
      }));
      const res: any = await api.post('/intelligence/relationships/bulk', { relationships });
      const data = res.data || res;
      const linked = data.linked || 0;
      const accepted = data.accepted || 0;
      const errors = data.errors || 0;
      if (errors > 0) {
        message.warning(`${linked} linked, ${accepted} accepted, ${errors} skipped (already linked)`);
      } else {
        message.success(`${linked} linked, ${accepted} accepted`);
      }
      setSelectedMatchIds([]);
      setCompareViewMatch(null);
      // Re-fetch matches from backend to get filtered list (without clearing local state)
      if (selectedRule) {
        try {
          const refreshRes: any = await api.get(`/intelligence/auto-link-rules/${selectedRule.id}/matches`);
          const refreshData = refreshRes.data || refreshRes;
          const ruleData = refreshData.rule || selectedRule;
          const fieldMappings = ruleData.fieldMappings || [];
          const relType = ruleData.relationshipType || selectedRule.relationshipType;
          const matches = (refreshData.matches || []).map((m: any, i: number) => ({
            id: m.existingSuggestionId || `match_${i}`,
            title: `Suggested: ${ruleData.sourceEntityType?.replace(/_/g, ' ')} ↔ ${ruleData.targetEntityType?.replace(/_/g, ' ')}`,
            description: `Confidence: ${Math.round(m.confidence * 100)}%`,
            entityTypeA: ruleData.sourceEntityType,
            entityIdA: m.sourceRecord?.id,
            entityTypeB: ruleData.targetEntityType,
            entityIdB: m.targetRecord?.id,
            confidence: m.confidence,
            status: m.existingSuggestionId ? 'pending' : 'new',
            proposedAction: { action: 'create_relationship', relationshipType: relType, fieldMappings },
            recordDataA: m.sourceRecord?.data,
            recordDataB: m.targetRecord?.data,
            matchedFields: m.matchedFields,
            isNew: !m.existingSuggestionId,
          }));
          setRuleMatchesList(matches);
        } catch {
          // Fallback: keep existing matches but remove selected
          const linkedIds = new Set(selected.map(s => s.id));
          setRuleMatchesList(prev => prev.filter(s => !linkedIds.has(s.id)));
        }
      } else {
        const linkedIds = new Set(selected.map(s => s.id));
        setRuleMatchesList(prev => prev.filter(s => !linkedIds.has(s.id)));
      }
      loadAll();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Bulk link failed');
    }
    setBulkLinking(false);
  };

  // ============ FILTERED DATA ============
  const filteredDuplicates = duplicateFilter === 'all'
    ? duplicates
    : duplicates.filter((d: any) => {
        if (duplicateFilter === 'high') return d.confidence >= 0.85;
        if (duplicateFilter === 'medium') return d.confidence >= 0.6 && d.confidence < 0.85;
        if (duplicateFilter === 'low') return d.confidence < 0.6;
        return true;
      });

  const filteredSuggestions = suggestionFilter === 'all'
    ? suggestions
    : suggestions.filter((s: any) => s.status === suggestionFilter);


    console.log("autoLinkRules ::", autoLinkRules)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Intelligence</h2>
          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
            Duplicates, suggestions, data lineage, and automated insights
          </Text>
        </div>
        <Space size={8}>
          <Button size="small" icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>Refresh</Button>
          <Button size="small" icon={<ScanOutlined />} onClick={startScan} loading={scanJobId !== null && scanProgress?.status !== 'completed' && scanProgress?.status !== 'failed'}>Scan Duplicates</Button>
          <Button size="small" icon={<ThunderboltOutlined />} onClick={runAutoLink}>Run Auto-Link</Button>
        </Space>
      </div>

      {scanProgress && (scanProgress.status === 'running' || scanProgress.status === 'pending') && (
        <Card size="small" style={{ marginBottom: 16, background: '#f6f8fa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Progress type="circle" percent={scanProgress.percentage} size={48} />
            <div style={{ flex: 1 }}>
              <Text strong style={{ fontSize: 13 }}>Scanning for duplicates...</Text>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {scanProgress.processedPairs?.toLocaleString() || 0} / {scanProgress.totalPairs?.toLocaleString() || '?'} pairs processed
                {scanProgress.estimatedRemainingMs ? ` — ~${Math.round(scanProgress.estimatedRemainingMs / 1000)}s remaining` : ''}
              </div>
            </div>
          </div>
        </Card>
      )}

      {scanProgress?.status === 'completed' && (
        <Card size="small" style={{ marginBottom: 16, background: '#f0fdf4', borderColor: '#86efac' }}>
          <Text><CheckCircleOutlined style={{ color: '#16a34a' }} /> Scan complete — {scanProgress.duplicatesFound} duplicates found</Text>
        </Card>
      )}

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 10 }}>Duplicates Found</span>}
              value={duplicateSummary?.totalDuplicatesFound || duplicates.length}
              valueStyle={{ fontSize: 22, color: '#E8611D' }}
              prefix={<ClusterOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 10 }}>High Confidence</span>}
              value={duplicates.filter((d: any) => d.confidence >= 0.85).length}
              valueStyle={{ fontSize: 22, color: '#DC2626' }}
              prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 10 }}>Suggestions</span>}
              value={suggestions.filter((s: any) => s.status === 'pending').length}
              valueStyle={{ fontSize: 22, color: '#2563EB' }}
              prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 10 }}>Auto-Link Rules</span>}
              value={autoLinkRules.length}
              valueStyle={{ fontSize: 22, color: '#16A34A' }}
              prefix={<LinkOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 10 }}>Resolved</span>}
              value={suggestions.filter((s: any) => s.status === 'accepted' || s.status === 'rejected').length}
              valueStyle={{ fontSize: 22, color: '#7C3AED' }}
              prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 10 }}>Last Scan</span>}
              value={duplicateSummary?.lastScan ? new Date(duplicateSummary.lastScan).toLocaleDateString() : 'Never'}
              valueStyle={{ fontSize: 14, color: '#6B7280' }} />
          </Card>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Tabs size="small" activeKey={activeTab} onChange={setActiveTab}
        items={[
          // ============ DUPLICATES TAB ============
          {
            key: 'duplicates',
            label: `Duplicates (${duplicates.filter(d => d.suggestionType === 'merge').length})`,
            children: (
              <div>
                <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                  <Button size="small" type={duplicateFilter === 'all' ? 'primary' : 'default'}
                    onClick={() => setDuplicateFilter('all')} style={{ fontSize: 11 }}>
                    All
                  </Button>
                  <Button size="small" type={duplicateFilter === 'high' ? 'primary' : 'default'}
                    onClick={() => setDuplicateFilter('high')} style={{ fontSize: 11 }}>
                    High (≥85%)
                  </Button>
                  <Button size="small" type={duplicateFilter === 'medium' ? 'primary' : 'default'}
                    onClick={() => setDuplicateFilter('medium')} style={{ fontSize: 11 }}>
                    Medium (60-84%)
                  </Button>
                  <Button size="small" type={duplicateFilter === 'low' ? 'primary' : 'default'}
                    onClick={() => setDuplicateFilter('low')} style={{ fontSize: 11 }}>
                    Low (&lt;60%)
                  </Button>
                </div>

                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                  <Table
                    dataSource={filteredDuplicates}
                    rowKey="id"
                    size="small"
                    loading={loading}
                    pagination={{ size: 'small', pageSize: 15 }}
                    columns={[
                      {
                        title: 'TITLE', dataIndex: 'title', key: 'title',
                        render: (v: string) => <span style={{ fontWeight: 500, fontSize: 12 }}>{v}</span>,
                      },
                      {
                        title: 'TYPE', dataIndex: 'suggestionType', key: 'type',
                        render: (v: string) => <Tag style={{ fontSize: 10 }}>{v}</Tag>,
                      },
                      {
                        title: 'CONFIDENCE', dataIndex: 'confidence', key: 'confidence',
                        render: (v: number) => {
                          const pct = Math.round((v || 0) * 100);
                          const color = pct >= 85 ? '#DC2626' : pct >= 60 ? '#E8611D' : '#6B7280';
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Progress percent={pct} size="small" strokeColor={color} style={{ width: 80, margin: 0 }} />
                              <span style={{ fontSize: 11, fontWeight: 600, color }}>{pct}%</span>
                            </div>
                          );
                        },
                      },
                      {
                        title: 'RECORDS', key: 'records',
                        render: (_: any, r: any) => {
                          const records = (r.proposedAction as any)?.records || [];
                          return (
                            <Space size={4} wrap>
                              {records.slice(0, 3).map((rec: any, i: number) => (
                                <Button key={i} size="small" type="link" style={{ fontSize: 10, padding: 0 }}
                                  onClick={() => viewProfile('golden_record', rec.id)}>
                                  {rec.preview?.name || rec.id?.substring(0, 8)}
                                </Button>
                              ))}
                              {records.length > 3 && <Text style={{ fontSize: 10 }}>+{records.length - 3}</Text>}
                            </Space>
                          );
                        },
                      },
                      {
                        title: '', key: 'actions', width: 120,
                        render: (_: any, r: any) => (
                          <Space size={4}>
                            <Popconfirm
                              title="Merge these records?"
                              description="The most complete record will be kept. Others will be removed."
                              okText="Merge"
                              okButtonProps={{ style: { background: '#009B3A' } }}
                              onConfirm={() => handleMerge(r.id)}
                            >
                              <Button size="small" type="primary" loading={mergeLoading === r.id}
                                icon={<MergeCellsOutlined />} style={{ fontSize: 10, background: '#009B3A' }}>
                                Merge
                              </Button>
                            </Popconfirm>
                            <Popconfirm title="Dismiss this duplicate?" onConfirm={() => handleRejectSuggestion(r.id)}>
                              <Button size="small" type="text" danger icon={<CloseCircleOutlined />}
                                style={{ fontSize: 10 }} />
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              </div>
            ),
          },

          // ============ SUGGESTIONS TAB ============
          {
            key: 'suggestions',
            label: `Suggestions (${suggestions.filter(s => s.status === 'pending').length})`,
            children: (
              <div>
                <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                  <Button size="small" type={suggestionFilter === 'all' ? 'primary' : 'default'}
                    onClick={() => setSuggestionFilter('all')} style={{ fontSize: 11 }}>All</Button>
                  <Button size="small" type={suggestionFilter === 'pending' ? 'primary' : 'default'}
                    onClick={() => setSuggestionFilter('pending')} style={{ fontSize: 11 }}>Pending</Button>
                  <Button size="small" type={suggestionFilter === 'accepted' ? 'primary' : 'default'}
                    onClick={() => setSuggestionFilter('accepted')} style={{ fontSize: 11 }}>Accepted</Button>
                  <Button size="small" type={suggestionFilter === 'rejected' ? 'primary' : 'default'}
                    onClick={() => setSuggestionFilter('rejected')} style={{ fontSize: 11 }}>Rejected</Button>
                </div>

                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                  <Table
                    dataSource={filteredSuggestions}
                    rowKey="id"
                    size="small"
                    loading={loading}
                    pagination={{ size: 'small', pageSize: 15 }}
                    columns={[
                      {
                        title: 'TITLE', dataIndex: 'title', key: 'title',
                        render: (v: string) => <span style={{ fontWeight: 500, fontSize: 12 }}>{v}</span>,
                      },
                      {
                        title: 'DESCRIPTION', dataIndex: 'description', key: 'desc',
                        ellipsis: true,
                        render: (v: string) => <span style={{ fontSize: 11, color: '#6B7280' }}>{v}</span>,
                      },
                      {
                        title: 'TYPE', dataIndex: 'suggestionType', key: 'type',
                        render: (v: string) => {
                          const colors: Record<string, string> = { merge: 'volcano', relationship: 'blue', data_quality: 'purple' };
                          return <Tag color={colors[v] || 'default'} style={{ fontSize: 10 }}>{v?.replace(/_/g, ' ')}</Tag>;
                        },
                      },
                      {
                        title: 'ENTITIES', key: 'entities',
                        render: (_: any, r: any) => {
                          const typeA = r.entityTypeA || '—';
                          const typeB = r.entityTypeB || '—';
                          return <span style={{ fontSize: 10, color: '#6B7280' }}>{typeA} ↔ {typeB}</span>;
                        },
                      },
                      {
                        title: 'STATUS', dataIndex: 'status', key: 'status',
                        render: (v: string) => {
                          const colors: Record<string, string> = { pending: 'orange', accepted: 'green', rejected: 'red', dismissed: 'default' };
                          return <Tag color={colors[v]} style={{ fontSize: 10 }}>{v}</Tag>;
                        },
                      },
                      {
                        title: 'DATE', dataIndex: 'createdAt', key: 'date',
                        render: (v: string) => <span style={{ fontSize: 10, color: '#9CA3AF' }}>{v ? new Date(v).toLocaleDateString() : '—'}</span>,
                      },
                      {
                        title: '', key: 'actions', width: 160,
                        render: (_: any, r: any) => r.status === 'pending' ? (
                          <Space size={4}>
                            {r.suggestionType === 'relationship' && (
                              <Button size="small" icon={<EyeOutlined />}
                                onClick={() => openComparison(r)}
                                style={{ fontSize: 10, color: '#2563EB' }}>
                                Side-by-Side
                              </Button>
                            )}
                            <Button size="small" type="link" icon={<CheckCircleOutlined />}
                              onClick={() => handleAcceptSuggestion(r.id)} style={{ fontSize: 10, color: '#16A34A' }} />
                            <Button size="small" type="link" icon={<CloseCircleOutlined />}
                              onClick={() => handleRejectSuggestion(r.id)} style={{ fontSize: 10, color: '#DC2626' }} />
                          </Space>
                        ) : null,
                      },
                    ]}
                  />
                </Card>
              </div>
            ),
          },

          // ============ SEARCH TAB ============
          {
            key: 'search',
            label: 'Search',
            children: (
              <div>
                <Card size="small" bodyStyle={{ padding: 16 }} style={{ marginBottom: 12 }}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      size="large"
                      prefix={<SearchOutlined />}
                      placeholder="Search across all records, entities, and data..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onPressEnter={handleSearch}
                      style={{ flex: 1 }}
                    />
                    <Select
                      size="large"
                      placeholder="Entity (optional)"
                      allowClear
                      value={searchEntity || undefined}
                      onChange={setSearchEntity}
                      style={{ width: 160 }}
                      options={entityOptions.map((e: any) => ({
                        label: e.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                        value: e.name,
                      }))}
                    />
                    <Button type="primary" size="large" icon={<SearchOutlined />}
                      loading={searchLoading} onClick={handleSearch}
                      style={{ background: '#009B3A' }}>
                      Search
                    </Button>
                  </Space.Compact>
                </Card>

                {searchResults.length > 0 && (
                  <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                    <Table
                      dataSource={searchResults}
                      rowKey={(r: any) => `${r.type}_${r.id}`}
                      size="small"
                      pagination={{ size: 'small', pageSize: 15 }}
                      columns={[
                        {
                          title: 'RELEVANCE', key: 'relevance', width: 80,
                          render: (_: any, r: any) => (
                            <Progress percent={r.relevance} size="small"
                              strokeColor={r.relevance >= 80 ? '#16A34A' : r.relevance >= 50 ? '#E8611D' : '#6B7280'}
                              style={{ width: 60 }} />
                          ),
                        },
                        {
                          title: 'NAME', key: 'name',
                          render: (_: any, r: any) => (
                            <Button type="link" size="small" style={{ fontSize: 12, padding: 0 }}
                              onClick={() => viewProfile(r.entityType || 'golden_record', r.id)}>
                              {r.title || r.data?.full_name || r.data?.first_name || r.data?.email || r.id?.substring(0, 8)}
                            </Button>
                          ),
                        },
                        {
                          title: 'TYPE', dataIndex: 'type', key: 'type',
                          render: (v: string) => {
                            const color: Record<string, string> = {
                              golden_record: 'green', form_submission: 'blue',
                              relationship: 'orange', timeline_event: 'purple',
                            };
                            return <Tag color={color[v] || 'default'} style={{ fontSize: 10 }}>{v.replace(/_/g, ' ')}</Tag>;
                          },
                        },
                        {
                          title: 'MATCHED FIELDS', key: 'matched',
                          render: (_: any, r: any) => (
                            <span style={{ fontSize: 10, color: '#6B7280' }}>
                              {r.matchedFields?.slice(0, 3).join(', ') || r.description?.substring(0, 60)}
                            </span>
                          ),
                        },
                        {
                          title: '', key: 'actions', width: 80,
                          render: (_: any, r: any) => (
                            <Space size={4}>
                              <Button size="small" type="link" icon={<EyeOutlined />}
                                onClick={() => viewProfile(r.entityType || 'golden_record', r.id)} style={{ fontSize: 10 }} />
                              <Button size="small" type="link" icon={<ApartmentOutlined />}
                                onClick={() => viewLineage(r.entityType || 'golden_record', r.id)} style={{ fontSize: 10 }} />
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Card>
                )}
              </div>
            ),
          },

          // ============ AUTO-LINK RULES TAB ============
          {
            key: 'autolink',
            label: `Auto-Link (${autoLinkRules.length})`,
            children: (
              <div>
                {/* Pending auto-link suggestions */}
                {pendingAutoLinks.length > 0 && (
                  <Card size="small" bodyStyle={{ padding: '12px 16px' }} style={{ marginBottom: 12, background: '#f0f9ff', borderColor: '#bae6fd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text strong style={{ fontSize: 12, color: '#0369a1' }}>
                        <ThunderboltOutlined /> {pendingAutoLinks.length} Pending Auto-Link Suggestion{pendingAutoLinks.length > 1 ? 's' : ''}
                      </Text>
                      <Button size="small" icon={<ReloadOutlined />} onClick={loadAll} style={{ fontSize: 10 }}>Refresh</Button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pendingAutoLinks.slice(0, 5).map((s: any) => (
                        <div key={s.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px', background: '#fff', borderRadius: 6, border: '1px solid #e5e7eb',
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 500 }}>{s.title}</div>
                            <div style={{ fontSize: 10, color: '#6B7280' }}>
                              {s.entityTypeA || 'Record'} ↔ {s.entityTypeB || 'Record'} · {Math.round((s.confidence || 0) * 100)}% confidence
                            </div>
                          </div>
                          <Space size={4}>
                            <Button size="small" icon={<EyeOutlined />}
                              onClick={() => openComparison(s)}
                              style={{ fontSize: 10, color: '#2563EB' }}>
                              Compare
                            </Button>
                            <Button size="small" type="link" icon={<CheckCircleOutlined />}
                              onClick={() => handleAcceptSuggestion(s.id)}
                              style={{ fontSize: 10, color: '#16A34A' }} />
                            <Button size="small" type="link" icon={<CloseCircleOutlined />}
                              onClick={() => handleRejectSuggestion(s.id)}
                              style={{ fontSize: 10, color: '#DC2626' }} />
                          </Space>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <div style={{ marginBottom: 12 }}>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => setShowCreateRule(true)}>
                    Create Rule
                  </Button>
                </div>
                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                  <Table
                    dataSource={autoLinkRules}
                    rowKey="id"
                    size="small"
                    pagination={{ size: 'small', pageSize: 15 }}
                    columns={[
                      { title: 'NAME', dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 500, fontSize: 12 }}>{v}</span> },
                      {
                        title: 'SOURCE → TARGET', key: 'mapping',
                        render: (_: any, r: any) => (
                          <span style={{ fontSize: 11 }}>
                            {r.sourceEntityType?.replace(/_/g, ' ')} → {r.targetEntityType?.replace(/_/g, ' ')}
                          </span>
                        ),
                      },
                      { title: 'RELATIONSHIP', dataIndex: 'relationshipType', key: 'rel', render: (v: string) => <Tag style={{ fontSize: 10 }}>{v?.replace(/_/g, ' ')}</Tag> },
                      {
                        title: 'THRESHOLDS', key: 'thresholds',
                        render: (_: any, r: any) => (
                          <span style={{ fontSize: 10, color: '#6B7280' }}>
                            Auto: ≥{Math.round((r.autoAcceptAbove || 0.95) * 100)}% | Suggest: ≥{Math.round((r.suggestAbove || 0.5) * 100)}%
                          </span>
                        ),
                      },
                      { title: 'ACTIVE', dataIndex: 'isActive', key: 'active', render: (v: boolean) => <Tag color={v ? 'green' : 'red'} style={{ fontSize: 10 }}>{v ? 'Active' : 'Inactive'}</Tag> },
                      {
                        title: 'MATCHES', key: 'matches',
                        render: (_: any, r: any) => {
                          const count = pendingAutoLinks.filter((s: any) =>
                            s.entityTypeA === r.sourceEntityType && s.entityTypeB === r.targetEntityType
                          ).length;
                          return count > 0 ? (
                            <Button size="small" type="link" onClick={() => viewRuleMatches(r)}
                              style={{ fontSize: 10, color: '#2563EB' }}>
                              {count} pending
                            </Button>
                          ) : <span style={{ fontSize: 10, color: '#9CA3AF' }}>0</span>;
                        },
                      },
                      {
                        title: '', key: 'actions', width: 100,
                        render: (_: any, r: any) => (
                          <Space size={4}>
                            <Button size="small" type="link" icon={<EyeOutlined />}
                              onClick={() => viewRuleMatches(r)}
                              style={{ fontSize: 10, color: '#2563EB' }}>
                              View
                            </Button>
                            <Popconfirm title="Delete?" onConfirm={() => deleteRule(r.id)}>
                              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              </div>
            ),
          },

          // ============ REPORTS TAB ============
          {
            key: 'reports',
            label: 'Reports',
            children: (
              <Row gutter={12}>
                <Col span={8}>
                  <Card size="small" title="Generate Report" bodyStyle={{ padding: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <Select size="small" value={reportPeriod} onChange={setReportPeriod}
                        options={[
                          { label: 'Weekly', value: 'week' },
                          { label: 'Monthly', value: 'month' },
                          { label: 'Quarterly', value: 'quarter' },
                        ]} />
                      <Button type="primary" size="small" onClick={generateReport} loading={reportLoading}
                        style={{ background: '#009B3A' }} block>
                        Generate Narrative Report
                      </Button>
                    </div>
                  </Card>
                </Col>
                <Col span={16}>
                  <Card size="small" title="Report Preview" bodyStyle={{ padding: 16 }}>
                    {reportData ? (
                      <div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 8 }}>
                          Generated: {reportData.generatedAt ? new Date(reportData.generatedAt).toLocaleString() : 'Now'} · Period: {reportData.period || reportPeriod}
                        </div>
                        <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                          {reportData.narrative || reportData.summary || JSON.stringify(reportData, null, 2)}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 12 }}>
                        Select a period and generate a report
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      {/* ============ PROFILE DRAWER ============ */}
      <Drawer
        title={<span style={{ fontWeight: 600 }}>360° Profile</span>}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        width={650}
      >
        {profileLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : profileData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Master Data */}
            <Card size="small" title="Master Data">
              <Descriptions size="small" column={2} labelStyle={{ fontSize: 10, color: '#9CA3AF' }} contentStyle={{ fontSize: 12 }}>
                {Object.entries(profileData.masterData || {}).slice(0, 12).map(([k, v]) => (
                  <Descriptions.Item key={k} label={k.replace(/_/g, ' ')}>{String(v || '—')}</Descriptions.Item>
                ))}
              </Descriptions>
            </Card>

            {/* Relationships */}
            <Card size="small" title={`Relationships (${(profileData.relationships?.outgoing?.length || 0) + (profileData.relationships?.incoming?.length || 0)})`}>
              <Table
                dataSource={[
                  ...(profileData.relationships?.outgoing || []).map((r: any) => ({ ...r, direction: 'outgoing' })),
                  ...(profileData.relationships?.incoming || []).map((r: any) => ({ ...r, direction: 'incoming' })),
                ]}
                rowKey={(r: any) => r.targetRecordId || r.sourceRecordId}
                size="small"
                pagination={false}
                columns={[
                  { title: 'DIRECTION', dataIndex: 'direction', width: 80, render: (v: string) => <Tag style={{ fontSize: 10 }}>{v === 'outgoing' ? '→ TO' : '← FROM'}</Tag> },
                  { title: 'TYPE', dataIndex: 'relationshipType', render: (v: string) => <span style={{ fontSize: 11 }}>{v?.replace(/_/g, ' ')}</span> },
                  { title: 'RECORD', key: 'record', render: (_: any, r: any) => <Button type="link" size="small" style={{ fontSize: 10 }} onClick={() => viewProfile(r.targetEntityType || r.sourceEntityType, r.targetRecordId || r.sourceRecordId)}>{(r.targetRecordId || r.sourceRecordId)?.substring(0, 12)}...</Button> },
                ]}
              />
            </Card>

            {/* Timeline */}
            <Card size="small" title="Timeline">
              <Timeline>
                {(profileData.timeline || []).slice(0, 10).map((e: any, i: number) => (
                  <Timeline.Item key={i} color={['green', 'blue', 'orange', 'gray'][i % 4]}>
                    <div style={{ fontSize: 11 }}>{e.type?.replace(/_/g, ' ') || 'Event'}</div>
                    <div style={{ fontSize: 9, color: '#9CA3AF' }}>{e.occurredAt ? new Date(e.occurredAt).toLocaleString() : ''}</div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>

            {/* Metadata */}
            <Descriptions size="small" column={2} labelStyle={{ fontSize: 10, color: '#9CA3AF' }} contentStyle={{ fontSize: 11 }}>
              <Descriptions.Item label="Source Records">{profileData.metadata?.sourceRecords || 0}</Descriptions.Item>
              <Descriptions.Item label="Versions">{profileData.metadata?.versions || 0}</Descriptions.Item>
              <Descriptions.Item label="Confidence">{profileData.matchConfidence ? `${Math.round(profileData.matchConfidence * 100)}%` : 'N/A'}</Descriptions.Item>
            </Descriptions>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No profile data found</div>
        )}
      </Drawer>

      {/* ============ LINEAGE DRAWER ============ */}
      <Drawer
        title={<span style={{ fontWeight: 600 }}>Data Lineage</span>}
        open={lineageOpen}
        onClose={() => setLineageOpen(false)}
        width={550}
      >
        {lineageLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : lineageData ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: 600 }}>Nodes: {lineageData.nodes?.length || 0}</Text>
              {' · '}
              <Text style={{ fontSize: 12, fontWeight: 600 }}>Edges: {lineageData.edges?.length || 0}</Text>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(lineageData.nodes || []).map((node: any, i: number) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', background: '#F9FAFB', borderRadius: 8,
                  border: '1px solid #E5E7EB',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: node.type === 'source' ? '#DBEAFE' : node.type === 'golden_record' ? '#EAF7EF' : node.type === 'version' ? '#FEF3C7' : '#F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: node.type === 'source' ? '#2563EB' : node.type === 'golden_record' ? '#16A34A' : '#E8611D',
                  }}>
                    {node.type === 'source' ? '📥' : node.type === 'golden_record' ? '📋' : node.type === 'version' ? '🔄' : '📌'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{node.label}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {node.type} · {node.timestamp ? new Date(node.timestamp).toLocaleString() : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Connections</Text>
              {(lineageData.edges || []).map((edge: any, i: number) => (
                <div key={i} style={{ fontSize: 11, padding: '4px 0', color: '#6B7280' }}>
                  {edge.from?.substring(0, 8)} → {edge.to?.substring(0, 8)} ({edge.label})
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No lineage data found</div>
        )}
      </Drawer>

      {/* ============ SIDE-BY-SIDE COMPARISON DRAWER ============ */}
      <Drawer
        title={
          <span style={{ fontWeight: 600 }}>
            Side-by-Side Comparison
            {compareSuggestion && (
              <span style={{ fontSize: 11, fontWeight: 400, color: '#6B7280', marginLeft: 8 }}>
                · Confidence: {Math.round((compareSuggestion.confidence || 0) * 100)}%
                · {compareSuggestion.entityTypeA || 'Record'} ↔ {compareSuggestion.entityTypeB || 'Record'}
              </span>
            )}
          </span>
        }
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        width={900}
      >
        {compareLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>Loading comparison data...</div>
        ) : compareRecords ? (
          <div>
            {/* Matched fields highlight bar */}
            {compareMatchedFields.length > 0 && (
              <Card size="small" bodyStyle={{ padding: '10px 14px' }} style={{ marginBottom: 16, background: '#fffbeb', borderColor: '#fde68a' }}>
                <Text style={{ fontSize: 11, fontWeight: 600 }}>Matched Fields: </Text>
                {compareMatchedFields.map((f, i) => (
                  <Tag key={i} color="gold" style={{ fontSize: 10 }}>{f}</Tag>
                ))}
              </Card>
            )}

            <Row gutter={16}>
              {/* LEFT: Record A */}
              <Col span={12}>
                <Card
                  size="small"
                  title={
                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                      {compareSuggestion?.entityTypeA || 'Record A'}
                    </span>
                  }
                  bodyStyle={{ padding: '12px 16px' }}
                  style={{ borderColor: '#dbeafe' }}
                >
                  <Table
                    dataSource={Object.entries(compareRecords[0] || {}).map(([k, v]) => ({
                      key: k, field: k, value: String(v ?? '—'),
                      matched: compareMatchedFields.includes(k),
                    }))}
                    rowKey="field"
                    size="small"
                    pagination={false}
                    showHeader={false}
                    columns={[
                      {
                        dataIndex: 'field', width: 120,
                        render: (v: string, r: any) => (
                          <span style={{
                            fontSize: 10, fontWeight: r.matched ? 700 : 500,
                            color: r.matched ? '#d97706' : '#6B7280',
                            background: r.matched ? '#fffbeb' : 'transparent',
                            padding: '1px 4px', borderRadius: 3,
                          }}>
                            {v.replace(/_/g, ' ')}
                            {r.matched && ' ★'}
                          </span>
                        ),
                      },
                      {
                        dataIndex: 'value',
                        render: (v: string, r: any) => (
                          <span style={{
                            fontSize: 11,
                            background: r.matched ? '#fffbeb' : 'transparent',
                            padding: '1px 4px', borderRadius: 3, display: 'block',
                          }}>
                            {v && v.length > 40 ? v.substring(0, 40) + '...' : v}
                          </span>
                        ),
                      },
                    ]}
                  />
                </Card>
              </Col>

              {/* RIGHT: Record B */}
              <Col span={12}>
                <Card
                  size="small"
                  title={
                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                      {compareSuggestion?.entityTypeB || 'Record B'}
                    </span>
                  }
                  bodyStyle={{ padding: '12px 16px' }}
                  style={{ borderColor: '#dbeafe' }}
                >
                  <Table
                    dataSource={Object.entries(compareRecords[1] || {}).map(([k, v]) => ({
                      key: k, field: k, value: String(v ?? '—'),
                      matched: compareMatchedFields.includes(k),
                    }))}
                    rowKey="field"
                    size="small"
                    pagination={false}
                    showHeader={false}
                    columns={[
                      {
                        dataIndex: 'field', width: 120,
                        render: (v: string, r: any) => (
                          <span style={{
                            fontSize: 10, fontWeight: r.matched ? 700 : 500,
                            color: r.matched ? '#d97706' : '#6B7280',
                            background: r.matched ? '#fffbeb' : 'transparent',
                            padding: '1px 4px', borderRadius: 3,
                          }}>
                            {v.replace(/_/g, ' ')}
                            {r.matched && ' ★'}
                          </span>
                        ),
                      },
                      {
                        dataIndex: 'value',
                        render: (v: string, r: any) => (
                          <span style={{
                            fontSize: 11,
                            background: r.matched ? '#fffbeb' : 'transparent',
                            padding: '1px 4px', borderRadius: 3, display: 'block',
                          }}>
                            {v && v.length > 40 ? v.substring(0, 40) + '...' : v}
                          </span>
                        ),
                      },
                    ]}
                  />
                </Card>
              </Col>
            </Row>

            {/* Action buttons */}
            {compareSuggestion?.isNew ? (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Space size={12}>
                  <Button type="primary" icon={<LinkOutlined />}
                    onClick={async () => {
                      try {
                        await api.post('/intelligence/relationships', {
                          sourceEntityType: compareSuggestion.entityTypeA,
                          sourceRecordId: compareSuggestion.entityIdA,
                          targetEntityType: compareSuggestion.entityTypeB,
                          targetRecordId: compareSuggestion.entityIdB,
                          relationshipType: compareSuggestion.proposedAction?.relationshipType,
                          confidence: compareSuggestion.confidence,
                        });
                        message.success('Relationship created');
                        setCompareOpen(false);
                        loadAll();
                      } catch (err: any) {
                        if (err?.response?.status === 409) {
                          message.info('Already linked');
                        } else {
                          message.error(err?.response?.data?.message || 'Failed');
                        }
                      }
                    }}
                    style={{ background: '#009B3A' }}>
                    Link Records
                  </Button>
                </Space>
              </div>
            ) : compareSuggestion?.status === 'pending' ? (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Space size={12}>
                  <Button type="primary" icon={<CheckCircleOutlined />}
                    onClick={() => { handleAcceptSuggestion(compareSuggestion.id); setCompareOpen(false); }}
                    style={{ background: '#16A34A' }}>
                    Accept & Create Relationship
                  </Button>
                  <Button danger icon={<CloseCircleOutlined />}
                    onClick={() => { handleRejectSuggestion(compareSuggestion.id); setCompareOpen(false); }}>
                    Reject Suggestion
                  </Button>
                </Space>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
            Could not load comparison data. The records may not exist or you may not have access.
          </div>
        )}
      </Drawer>

      {/* ============ RULE MATCHES DRAWER ============ */}
      <Drawer
        title={
          selectedRule ? (
            <span style={{ fontWeight: 600 }}>
              Matches: {selectedRule.name}
              <span style={{ fontSize: 11, fontWeight: 400, color: '#6B7280', marginLeft: 8 }}>
                · {selectedRule.sourceEntityType?.replace(/_/g, ' ')} → {selectedRule.targetEntityType?.replace(/_/g, ' ')}
                · {ruleMatchesList.length} pending
              </span>
            </span>
          ) : 'Rule Matches'
        }
        open={ruleMatchesOpen}
        onClose={() => setRuleMatchesOpen(false)}
        width={700}
      >
        {compareViewMatch ? (
          <div>
            <Button type="link" icon={<ArrowLeftOutlined />}
              onClick={() => setCompareViewMatch(null)}
              style={{ fontSize: 11, padding: 0, marginBottom: 12 }}>
              Back to matches
            </Button>
            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title={<span style={{ fontSize: 11 }}>{compareViewMatch.entityTypeA || 'Record A'}</span>}
                  bodyStyle={{ padding: '8px 12px' }} style={{ borderColor: '#dbeafe' }}>
                  <Table
                    dataSource={Object.entries(compareViewMatch.recordDataA || {}).map(([k, v]) => ({
                      field: k, value: String(v ?? '—'),
                      matched: (compareViewMatch.matchedFields || []).includes(k),
                    }))}
                    rowKey="field" size="small" pagination={false} showHeader={false}
                    columns={[
                      { dataIndex: 'field', width: 100, render: (v: string, r: any) => <span style={{ fontSize: 10, fontWeight: r.matched ? 700 : 500, color: r.matched ? '#d97706' : '#6B7280', background: r.matched ? '#fffbeb' : 'transparent', padding: '1px 4px', borderRadius: 3 }}>{v.replace(/_/g, ' ')}{r.matched && ' ★'}</span> },
                      { dataIndex: 'value', render: (v: string, r: any) => <span style={{ fontSize: 10, background: r.matched ? '#fffbeb' : 'transparent', padding: '1px 4px', borderRadius: 3, display: 'block' }}>{v?.length > 60 ? v.substring(0, 60) + '...' : v}</span> },
                    ]}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title={<span style={{ fontSize: 11 }}>{compareViewMatch.entityTypeB || 'Record B'}</span>}
                  bodyStyle={{ padding: '8px 12px' }} style={{ borderColor: '#dbeafe' }}>
                  <Table
                    dataSource={Object.entries(compareViewMatch.recordDataB || {}).map(([k, v]) => ({
                      field: k, value: String(v ?? '—'),
                      matched: (compareViewMatch.matchedFields || []).includes(k),
                    }))}
                    rowKey="field" size="small" pagination={false} showHeader={false}
                    columns={[
                      { dataIndex: 'field', width: 100, render: (v: string, r: any) => <span style={{ fontSize: 10, fontWeight: r.matched ? 700 : 500, color: r.matched ? '#d97706' : '#6B7280', background: r.matched ? '#fffbeb' : 'transparent', padding: '1px 4px', borderRadius: 3 }}>{v.replace(/_/g, ' ')}{r.matched && ' ★'}</span> },
                      { dataIndex: 'value', render: (v: string, r: any) => <span style={{ fontSize: 10, background: r.matched ? '#fffbeb' : 'transparent', padding: '1px 4px', borderRadius: 3, display: 'block' }}>{v?.length > 60 ? v.substring(0, 60) + '...' : v}</span> },
                    ]}
                  />
                </Card>
              </Col>
            </Row>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              {compareViewMatch.isNew ? (
                <Button type="primary" size="small" icon={<LinkOutlined />}
                  onClick={async () => {
                    try {
                      await api.post('/intelligence/relationships', {
                        sourceEntityType: compareViewMatch.entityTypeA,
                        sourceRecordId: compareViewMatch.entityIdA,
                        targetEntityType: compareViewMatch.entityTypeB,
                        targetRecordId: compareViewMatch.entityIdB,
                        relationshipType: compareViewMatch.proposedAction?.relationshipType,
                        confidence: compareViewMatch.confidence,
                      });
                      message.success('Relationship created');
                      setRuleMatchesList(prev => prev.filter(s => s.id !== compareViewMatch.id));
                      setCompareViewMatch(null);
                      loadAll();
                    } catch (err: any) {
                      if (err?.response?.status === 409) {
                        message.info('Already linked');
                        setRuleMatchesList(prev => prev.filter(s => s.id !== compareViewMatch.id));
                        setCompareViewMatch(null);
                      } else {
                        message.error(err?.response?.data?.message || 'Failed');
                      }
                    }
                  }}
                  style={{ background: '#009B3A' }}>
                  Link Records
                </Button>
              ) : compareViewMatch.status === 'pending' ? (
                <Space size={12}>
                  <Button type="primary" size="small" icon={<CheckCircleOutlined />}
                    onClick={async () => {
                      await api.post(`/intelligence/suggestions/${compareViewMatch.id}/accept`);
                      message.success('Suggestion accepted');
                      setRuleMatchesList(prev => prev.filter(s => s.id !== compareViewMatch.id));
                      setCompareViewMatch(null);
                      loadAll();
                    }}
                    style={{ background: '#16A34A' }}>
                    Accept
                  </Button>
                  <Button danger size="small" icon={<CloseCircleOutlined />}
                    onClick={async () => {
                      await api.post(`/intelligence/suggestions/${compareViewMatch.id}/reject`);
                      message.success('Suggestion rejected');
                      setRuleMatchesList(prev => prev.filter(s => s.id !== compareViewMatch.id));
                      setCompareViewMatch(null);
                      loadAll();
                    }}>
                    Reject
                  </Button>
                </Space>
              ) : null}
            </div>
          </div>
        ) : ruleMatchesList.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: '#f0fdf4', borderRadius: 12,
            border: '2px dashed #86efac',
          }}>
            <div style={{ fontSize: 48, color: '#16a34a', marginBottom: 12 }}>
              <CheckCircleOutlined />
            </div>
            <Title level={5} style={{ color: '#15803d', margin: 0, fontSize: 14 }}>
              All Clear — No Pending Matches
            </Title>
            <Text style={{ display: 'block', fontSize: 12, color: '#16a34a', marginTop: 6, lineHeight: 1.6 }}>
              {selectedRule?.name
                ? `Every record pair for "${selectedRule.name}" has been reviewed.`
                : 'All records matched by this rule have been linked or resolved.'}
              <br />
              New source records imported in the future will be automatically
              checked against this rule.
            </Text>
            <div style={{ marginTop: 16, display: 'inline-flex', gap: 4, padding: '6px 16px', background: '#dcfce7', borderRadius: 20 }}>
              <SafetyOutlined style={{ color: '#16a34a', fontSize: 12 }} />
              <span style={{ fontSize: 11, color: '#15803d' }}>Auto-link rule is active</span>
            </div>
          </div>
        ) : (
          <div>
            {/* Selection toolbar */}
            {selectedMatchIds.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', marginBottom: 8,
                background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd',
              }}>
                <Text style={{ fontSize: 11, color: '#0369a1' }}>
                  <Checkbox checked={selectedMatchIds.length === ruleMatchesList.length}
                    indeterminate={selectedMatchIds.length > 0 && selectedMatchIds.length < ruleMatchesList.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMatchIds(ruleMatchesList.map(s => s.id));
                      } else {
                        setSelectedMatchIds([]);
                      }
                    }}
                  />
                  {' '}{selectedMatchIds.length} selected
                </Text>
                <Space size={8}>
                  <Button size="small" onClick={() => setSelectedMatchIds([])} style={{ fontSize: 10 }}>
                    Clear
                  </Button>
                  <Button size="small" type="primary" icon={<LinkOutlined />}
                    loading={bulkLinking}
                    onClick={handleBulkLink}
                    style={{ fontSize: 10, background: '#009B3A' }}>
                    Link Selected ({selectedMatchIds.length})
                  </Button>
                </Space>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ruleMatchesList.map((s: any) => {
              const previewA = s.recordDataA?.full_name || s.recordDataA?.first_name || s.entityIdA?.substring(0, 10);
              const previewB = s.recordDataB?.full_name || s.recordDataB?.first_name || s.entityIdB?.substring(0, 10);
              return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 16px', background: selectedMatchIds.includes(s.id) ? '#f0f9ff' : '#F9FAFB', borderRadius: 8,
                border: selectedMatchIds.includes(s.id) ? '1px solid #bae6fd' : '1px solid #E5E7EB',
              }}>
                <Checkbox checked={selectedMatchIds.includes(s.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedMatchIds([...selectedMatchIds, s.id]);
                    } else {
                      setSelectedMatchIds(selectedMatchIds.filter(id => id !== s.id));
                    }
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{s.title}</div>
                  <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
                    <Tag style={{ fontSize: 9 }}>{s.entityTypeA?.replace(/_/g, ' ')}</Tag>
                    <span style={{ fontWeight: 500 }}>{typeof previewA === 'string' ? previewA : JSON.stringify(previewA).substring(0, 20)}</span>
                    <span style={{ margin: '0 6px' }}>↔</span>
                    <Tag style={{ fontSize: 9 }}>{s.entityTypeB?.replace(/_/g, ' ')}</Tag>
                    <span style={{ fontWeight: 500 }}>{typeof previewB === 'string' ? previewB : JSON.stringify(previewB).substring(0, 20)}</span>
                    {' · '}
                    <span style={{ color: s.confidence >= 0.85 ? '#16A34A' : '#E8611D' }}>{Math.round((s.confidence || 0) * 100)}%</span>
                    {s.isNew && <Tag color="blue" style={{ fontSize: 9, marginLeft: 4 }}>new</Tag>}
                  </div>
                </div>
                <Space size={4}>
                  <Button size="small" icon={<EyeOutlined />}
                    onClick={() => { setSelectedMatchIds([]); setCompareViewMatch(s); }}
                    style={{ fontSize: 10, color: '#2563EB' }}>
                    Compare
                  </Button>
                  {s.isNew ? (
                    <Button size="small" type="primary"
                      onClick={async () => {
                        try {
                          await api.post('/intelligence/relationships', {
                            sourceEntityType: s.entityTypeA,
                            sourceRecordId: s.entityIdA,
                            targetEntityType: s.entityTypeB,
                            targetRecordId: s.entityIdB,
                            relationshipType: s.proposedAction?.relationshipType,
                            confidence: s.confidence,
                          });
                          message.success('Relationship created');
                          setRuleMatchesList(prev => prev.filter(x => x.id !== s.id));
                          setSelectedMatchIds(prev => prev.filter(id => id !== s.id));
                          loadAll();
                        } catch (err: any) {
                          if (err?.response?.status === 409) {
                            message.info('Already linked');
                            setRuleMatchesList(prev => prev.filter(x => x.id !== s.id));
                            setSelectedMatchIds(prev => prev.filter(id => id !== s.id));
                          } else {
                            message.error(err?.response?.data?.message || 'Failed');
                          }
                        }
                      }}
                      style={{ fontSize: 10, background: '#009B3A' }}>
                      Link
                    </Button>
                  ) : s.status === 'pending' ? (
                    <>
                      <Button size="small" type="link" icon={<CheckCircleOutlined />}
                        onClick={async () => {
                          await api.post(`/intelligence/suggestions/${s.id}/accept`);
                          message.success('Suggestion accepted');
                          setRuleMatchesList(prev => prev.filter(x => x.id !== s.id));
                          setSelectedMatchIds(prev => prev.filter(id => id !== s.id));
                          loadAll();
                        }}
                        style={{ fontSize: 10, color: '#16A34A' }} />
                      <Button size="small" type="link" icon={<CloseCircleOutlined />}
                        onClick={async () => {
                          await api.post(`/intelligence/suggestions/${s.id}/reject`);
                          message.success('Suggestion rejected');
                          setRuleMatchesList(prev => prev.filter(x => x.id !== s.id));
                          setSelectedMatchIds(prev => prev.filter(id => id !== s.id));
                          loadAll();
                        }}
                        style={{ fontSize: 10, color: '#DC2626' }} />
                    </>
                  ) : null}
                </Space>
              </div>
            )})}
            </div>
          </div>
        )}
      </Drawer>

      {/* ============ CREATE AUTO-LINK RULE MODAL ============ */}
      <Modal
        title="Create Auto-Link Rule"
        open={showCreateRule}
        onOk={createRule}
        onCancel={() => setShowCreateRule(false)}
        okText="Create"
        width={600}
        okButtonProps={{ style: { background: '#009B3A' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <Input size="small" placeholder="Rule name" value={newRule.name}
            onChange={e => setNewRule({ ...newRule, name: e.target.value })} />
          <Row gutter={8}>
            <Col span={12}>
              <Input size="small" placeholder="Source entity (e.g. person)" value={newRule.sourceEntityType}
                onChange={e => setNewRule({ ...newRule, sourceEntityType: e.target.value })} />
            </Col>
            <Col span={12}>
              <Input size="small" placeholder="Target entity (e.g. person)" value={newRule.targetEntityType}
                onChange={e => setNewRule({ ...newRule, targetEntityType: e.target.value })} />
            </Col>
          </Row>
          <Input size="small" placeholder="Relationship type (e.g. same_person, household_member)" value={newRule.relationshipType}
            onChange={e => setNewRule({ ...newRule, relationshipType: e.target.value })} />

          <div>
            <Text style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Field Mappings</Text>
            {newRule.fieldMappings.map((mapping: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <Input size="small" placeholder="Source field" value={mapping.sourceField}
                  onChange={e => {
                    const mappings = [...newRule.fieldMappings];
                    mappings[i].sourceField = e.target.value;
                    setNewRule({ ...newRule, fieldMappings: mappings });
                  }} style={{ flex: 1 }} />
                <Input size="small" placeholder="Target field" value={mapping.targetField}
                  onChange={e => {
                    const mappings = [...newRule.fieldMappings];
                    mappings[i].targetField = e.target.value;
                    setNewRule({ ...newRule, fieldMappings: mappings });
                  }} style={{ flex: 1 }} />
                <Select size="small" value={mapping.matchType}
                  onChange={v => {
                    const mappings = [...newRule.fieldMappings];
                    mappings[i].matchType = v;
                    setNewRule({ ...newRule, fieldMappings: mappings });
                  }} style={{ width: 100 }}
                  options={[
                    { label: 'Exact', value: 'exact' },
                    { label: 'Fuzzy', value: 'fuzzy' },
                    { label: 'Contains', value: 'contains' },
                  ]} />
                {newRule.fieldMappings.length > 1 && (
                  <Button size="small" type="text" danger onClick={() => {
                    setNewRule({ ...newRule, fieldMappings: newRule.fieldMappings.filter((_, j) => j !== i) });
                  }}>✕</Button>
                )}
              </div>
            ))}
            <Button size="small" onClick={() => setNewRule({
              ...newRule,
              fieldMappings: [...newRule.fieldMappings, { sourceField: '', targetField: '', matchType: 'exact' }],
            })}>+ Add Mapping</Button>
          </div>

          <Row gutter={8}>
            <Col span={12}>
              <Text style={{ fontSize: 10, color: '#9CA3AF' }}>Auto-accept above</Text>
              <Input size="small" type="number" min={0} max={1} step={0.05} value={newRule.autoAcceptAbove}
                onChange={e => setNewRule({ ...newRule, autoAcceptAbove: parseFloat(e.target.value) || 0.95 })} />
            </Col>
            <Col span={12}>
              <Text style={{ fontSize: 10, color: '#9CA3AF' }}>Suggest above</Text>
              <Input size="small" type="number" min={0} max={1} step={0.05} value={newRule.suggestAbove}
                onChange={e => setNewRule({ ...newRule, suggestAbove: parseFloat(e.target.value) || 0.5 })} />
            </Col>
          </Row>
        </div>
      </Modal>
    </div>
  );
}