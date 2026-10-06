import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card, Table, Tag, Button, Space, Spin, Skeleton, message, Modal, Result,
  Drawer, Tooltip, Select, Input, Popconfirm, Empty, InputNumber, Switch,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  HolderOutlined, FilterOutlined, SettingOutlined, DeleteOutlined, EditOutlined,
  AppstoreOutlined, LineChartOutlined, BarChartOutlined, PieChartOutlined,
  NumberOutlined, TableOutlined, OrderedListOutlined,
  CopyOutlined, SaveOutlined, EyeOutlined,
} from '@ant-design/icons';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, Filler, Tooltip as ChartTooltip, Legend, BarElement,
} from 'chart.js';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Filler, ChartTooltip, Legend, BarElement);

const C = {
  green: '#009B3A', greenBg: 'rgba(0,155,58,0.08)',
  red: '#CE1126', redBg: 'rgba(206,17,38,0.08)',
  orange: '#E8611D', orangeBg: 'rgba(232,97,29,0.08)',
  black: '#444', blackBg: 'rgba(0,0,0,0.05)',
};

const WIDGET_TYPES = [
  { type: 'number', label: 'Number Card', icon: <NumberOutlined /> },
  { type: 'kpi_card', label: 'KPI Card', icon: <AppstoreOutlined /> },
  { type: 'bar_chart', label: 'Bar Chart', icon: <BarChartOutlined /> },
  { type: 'line_chart', label: 'Line Chart', icon: <LineChartOutlined /> },
  { type: 'pie_chart', label: 'Pie Chart', icon: <PieChartOutlined /> },
  { type: 'table', label: 'Table', icon: <TableOutlined /> },
  { type: 'list', label: 'List', icon: <OrderedListOutlined /> },
];

const AGGREGATIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'distinct', label: 'Distinct Count' },
];

export default function DashboardPage() {
  const [state, setState] = useState<'loading' | 'error' | 'success'>('loading');
  const [workspace, setWorkspace] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [activityStats, setActivityStats] = useState<any>(null);
  const [entities, setEntities] = useState<any[]>([]);
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const [validationSummary, setValidationSummary] = useState<any>(null);
  const [anomalySummary, setAnomalySummary] = useState<any>(null);
  const [duplicateSummary, setDuplicateSummary] = useState<any>(null);
  const [connectors, setConnectors] = useState<any[]>([]);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [workflowDefs, setWorkflowDefs] = useState<any[]>([]);
  const [runningInstances, setRunningInstances] = useState<any[]>([]);
  const [activityUnread, setActivityUnread] = useState(0);

  const [dashboards, setDashboards] = useState<any[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<any>(null);
  const [currentWidgets, setCurrentWidgets] = useState<any[]>([]);
  const [widgetLoading, setWidgetLoading] = useState<Record<string, boolean>>({});
  const [widgetErrors, setWidgetErrors] = useState<Record<string, string>>({});

  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [editingWidget, setEditingWidget] = useState<any>(null);
  const [newWidget, setNewWidget] = useState({
    name: '', widgetType: 'number', dataSource: 'golden_records',
    config: { entityName: '', field: '', groupBy: '', aggregation: 'count', limit: 10, sortDirection: 'desc' },
    position: { x: 0, y: 0, w: 3, h: 2 }, refreshSeconds: 0,
  });

  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [taskDrawer, setTaskDrawer] = useState<{ open: boolean; task: any }>({ open: false, task: null });
  const [drillDrawer, setDrillDrawer] = useState<{ open: boolean; title: string; entityName: string; records: any[] }>({ open: false, title: '', entityName: '', records: [] });
  const [drillLoading, setDrillLoading] = useState(false);
  const [layoutChanged, setLayoutChanged] = useState(false);

  const [kpiOrder, setKpiOrder] = useState([0, 1, 2, 3]);
  const dragKpi = useRef<number | null>(null);
  const dragOverKpi = useRef<number | null>(null);
  const navigate = useNavigate();
  const unwrap = (v: any) => (v?.success === true ? v.data : v);

  // ============ LOAD ALL ============
  const loadAll = useCallback(async () => {
    setState('loading');
    try {
      const results = await Promise.allSettled([
        api.get('/dashboards/my/workspace'),
        api.get('/workflows/tasks/my'),
        api.get('/activity', { params: { limit: 8 } }),
        api.get('/activity/stats', { params: { days: 7 } }),
        api.get('/dashboards'),
        api.get('/entities'),
        api.get('/validation/summary'),
        api.get('/anomalies/summary'),
        api.get('/intelligence/duplicates/summary'),
        api.get('/connectors'),
        api.get('/saved-searches'),
        api.get('/workflows/definitions'),
        api.get('/workflows/instances', { params: { status: 'running' } }),
        api.get('/activity/unread-count'),
      ]);

      setWorkspace(results[0].status === 'fulfilled' ? unwrap(results[0].value) : null);
      const td = results[1].status === 'fulfilled' ? unwrap(results[1].value) : null;
      setTasks(td?.data ?? td ?? []);
      setActivity(results[2].status === 'fulfilled' ? (unwrap(results[2].value)?.data ?? []) : []);
      setActivityStats(results[3].status === 'fulfilled' ? unwrap(results[3].value) : null);

      if (results[5].status === 'fulfilled') {
        const el = unwrap(results[5].value)?.data ?? unwrap(results[5].value) ?? [];
        setEntities(Array.isArray(el) ? el : []);
        const counts: Record<string, number> = {};
        await Promise.all((Array.isArray(el) ? el : []).map(async (e: any) => {
          try { const r: any = await api.get(`/mdm/records/${e.name}`, { params: { limit: 1 } }); counts[e.name] = unwrap(r)?.total ?? 0; }
          catch { counts[e.name] = 0; }
        }));
        setRecordCounts(counts);
      }

      setValidationSummary(results[6].status === 'fulfilled' ? unwrap(results[6].value) : null);
      setAnomalySummary(results[7].status === 'fulfilled' ? unwrap(results[7].value) : null);
      setDuplicateSummary(results[8].status === 'fulfilled' ? unwrap(results[8].value) : null);
      setConnectors(results[9].status === 'fulfilled' ? (unwrap(results[9].value)?.data ?? unwrap(results[9].value) ?? []) : []);
      setSavedSearches(results[10].status === 'fulfilled' ? (unwrap(results[10].value)?.data ?? unwrap(results[10].value) ?? []) : []);
      setWorkflowDefs(results[11].status === 'fulfilled' ? (unwrap(results[11].value)?.data ?? unwrap(results[11].value) ?? []) : []);
      setRunningInstances(results[12].status === 'fulfilled' ? (unwrap(results[12].value)?.data ?? unwrap(results[12].value) ?? []) : []);
      setActivityUnread(results[13].status === 'fulfilled' ? (unwrap(results[13].value)?.count ?? 0) : 0);

      if (results[4].status === 'fulfilled') {
        const dd = unwrap(results[4].value); const dl = dd?.data ?? dd ?? [];
        setDashboards(dl);
        const def = dl.find((d: any) => d.isDefault) || dl[0];
        if (def) {
          setCurrentDashboard(def);
          await loadWidgetsForDashboard(def.id);
        }
      }
      setState('success');
    } catch (err) { console.error(err); setState('error'); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ============ LOAD WIDGETS FOR DASHBOARD ============
  const loadWidgetsForDashboard = async (dashboardId: string) => {
    try {
      const full: any = await api.get(`/dashboards/${dashboardId}/full`);
      const widgets = unwrap(full)?.widgets ?? [];
      setCurrentWidgets(widgets);
      setLayoutChanged(false);

      // Load data for each widget
      widgets.forEach((w: any) => loadWidgetData(w.id));
    } catch (err) { setCurrentWidgets([]); }
  };

  const loadWidgetData = async (widgetId: string) => {
    setWidgetLoading(prev => ({ ...prev, [widgetId]: true }));
    setWidgetErrors(prev => { const n = { ...prev }; delete n[widgetId]; return n; });
    try {
      const res: any = await api.get(`/dashboards/widgets/${widgetId}/data`);
      const data = unwrap(res);
      setCurrentWidgets(prev => prev.map(w => w.id === widgetId ? { ...w, data } : w));
    } catch (err: any) {
      setWidgetErrors(prev => ({ ...prev, [widgetId]: err?.message || 'Failed to load' }));
    } finally {
      setWidgetLoading(prev => ({ ...prev, [widgetId]: false }));
    }
  };

  // ============ ACTIONS ============
  const handleApprove = async (taskId: string) => {
    try { await api.post(`/workflows/tasks/${taskId}/approve`); message.success('Approved'); loadAll(); }
    catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  const handleReject = async (taskId: string) => {
    Modal.confirm({
      title: 'Reject task?', okText: 'Reject', cancelText: 'Cancel', okButtonProps: { danger: true, size: 'small' },
      onOk: async () => { try { await api.post(`/workflows/tasks/${taskId}/reject`); message.success('Rejected'); loadAll(); } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); } },
    });
  };

  const handleDrillDown = async (entityName: string, title: string) => {
    setDrillDrawer({ open: true, title, entityName, records: [] });
    setDrillLoading(true);
    try {
      const res: any = await api.get(`/mdm/records/${entityName}`, { params: { limit: 50 } });
      setDrillDrawer(prev => ({ ...prev, records: unwrap(res)?.data ?? unwrap(res) ?? [] }));
    } catch { setDrillDrawer(prev => ({ ...prev, records: [] })); }
    finally { setDrillLoading(false); }
  };

  // ============ KPI DRAG ============
  const handleKpiDragStart = (i: number) => { dragKpi.current = i; };
  const handleKpiDragEnter = (i: number) => { dragOverKpi.current = i; };
  const handleKpiDragEnd = () => {
    if (dragKpi.current === null || dragOverKpi.current === null) return;
    const n = [...kpiOrder]; const [r] = n.splice(dragKpi.current, 1);
    n.splice(dragOverKpi.current, 0, r); setKpiOrder(n);
    dragKpi.current = null; dragOverKpi.current = null;
  };

  // ============ DASHBOARD MANAGEMENT ============
  const handleCreateDashboard = () => {
    let name = '';
    Modal.confirm({
      title: 'Create Dashboard', okText: 'Create', cancelText: 'Cancel',
      content: <Input placeholder="Name" className="mt-3" size="small" onChange={e => { name = e.target.value; }} />,
      onOk: async () => {
        if (!name) { message.warning('Enter a name'); return Promise.reject(); }
        try { const r: any = await api.post('/dashboards', { name, description: '', layout: {}, isDefault: false }); setCurrentDashboard(unwrap(r)); setCurrentWidgets([]); const dr: any = await api.get('/dashboards'); setDashboards(unwrap(dr)?.data ?? []); message.success('Created'); }
        catch { message.error('Failed'); }
      },
    });
  };

  const handleSwitchDashboard = async (id: string) => {
    const d = dashboards.find(x => x.id === id); if (!d) return;
    setCurrentDashboard(d); await loadWidgetsForDashboard(id);
  };

  const handleSetDefault = async (id: string) => { try { await api.put(`/dashboards/${id}`, { isDefault: true }); message.success('Default set'); loadAll(); } catch { message.error('Failed'); } };
  const handleDeleteDashboard = async (id: string) => {
    Modal.confirm({ title: 'Delete?', okText: 'Delete', cancelText: 'Cancel', okButtonProps: { danger: true }, onOk: async () => { try { await api.delete(`/dashboards/${id}`); message.success('Deleted'); loadAll(); } catch { message.error('Failed'); } } });
  };

  // ============ WIDGET MANAGEMENT ============
  const handleAddWidget = async () => {
    if (!currentDashboard?.id) { message.warning('Select a dashboard first'); return; }
    if (!newWidget.name.trim()) { message.warning('Widget name required'); return; }
    try {
      await api.post(`/dashboards/${currentDashboard.id}/widgets`, { ...newWidget, dataSource: 'golden_records' });
      message.success('Widget added'); setShowAddWidget(false);
      setNewWidget({ name: '', widgetType: 'number', dataSource: 'golden_records', config: { entityName: '', field: '', groupBy: '', aggregation: 'count', limit: 10, sortDirection: 'desc' }, position: { x: 0, y: 0, w: 3, h: 2 }, refreshSeconds: 0 });
      await loadWidgetsForDashboard(currentDashboard.id);
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  const handleDeleteWidget = async (widgetId: string) => {
    try { await api.delete(`/dashboards/widgets/${widgetId}`); message.success('Removed'); if (currentDashboard?.id) await loadWidgetsForDashboard(currentDashboard.id); }
    catch { message.error('Failed'); }
  };

  const handleUpdateWidget = async () => {
    if (!editingWidget) return;
    try {
      await api.put(`/dashboards/widgets/${editingWidget.id}`, { name: editingWidget.name, widgetType: editingWidget.widgetType, config: editingWidget.config, position: editingWidget.position, refreshSeconds: editingWidget.refreshSeconds, dataSource: 'golden_records' });
      message.success('Updated'); setEditingWidget(null);
      if (currentDashboard?.id) await loadWidgetsForDashboard(currentDashboard.id);
    } catch { message.error('Failed'); }
  };

  const handleDuplicateWidget = async (widget: any) => {
    try {
      await api.post(`/dashboards/${currentDashboard.id}/widgets`, { name: `${widget.name} (copy)`, widgetType: widget.widgetType, dataSource: 'golden_records', config: widget.config, position: { x: (widget.position?.x || 0) + 1, y: (widget.position?.y || 0) + 1, w: widget.position?.w || 3, h: widget.position?.h || 2 }, refreshSeconds: widget.refreshSeconds || 0 });
      message.success('Duplicated');
      if (currentDashboard?.id) await loadWidgetsForDashboard(currentDashboard.id);
    } catch { message.error('Failed'); }
  };

  const handleSaveLayout = async () => {
    if (!currentDashboard?.id) return;
    try {
      await Promise.all(currentWidgets.map(w => api.put(`/dashboards/widgets/${w.id}`, { position: w.position })));
      message.success('Layout saved'); setLayoutChanged(false);
    } catch { message.error('Failed to save layout'); }
  };

  const handleWidgetPositionChange = (widgetId: string, newPosition: any) => {
    setCurrentWidgets(prev => prev.map(w => w.id === widgetId ? { ...w, position: newPosition } : w));
    setLayoutChanged(true);
  };

  // ============ WIDGET DATA RENDERER ============
  const renderWidgetContent = (widget: any) => {
    const wId = widget.id;
    if (widgetLoading[wId]) return <Skeleton active paragraph={{ rows: 2 }} />;
    if (widgetErrors[wId]) return <div className="text-center py-4"><span className="text-[11px] text-[#CE1126]">{widgetErrors[wId]}</span><br /><Button size="small" type="link" onClick={() => loadWidgetData(wId)} className="!text-[9px]">Retry</Button></div>;
    if (!widget.data && widget.data !== 0) return <div className="text-center py-4 text-[10px] text-[#99A1B3]">No data loaded</div>;

    const d = widget.data;

    switch (widget.widgetType) {
      case 'number':
      case 'kpi_card':
        return <div className="font-[Space_Grotesk] text-2xl font-bold text-[#1A1F2E]">{d?.value ?? d ?? '—'}</div>;
      case 'bar_chart':
        return d?.labels ? <div className="h-[150px]"><Bar data={{ labels: d.labels, datasets: [{ data: d.values || d.datasets?.[0]?.data || [], backgroundColor: [C.green, C.orange, C.red, '#777', '#00B844'], borderRadius: 4 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 9 }, color: '#99A1B3' } }, y: { ticks: { font: { size: 9 }, color: '#99A1B3' } } } }} /></div> : <div className="text-[10px] text-[#99A1B3]">No chart data</div>;
      case 'line_chart':
        return d?.labels ? <div className="h-[150px]"><Line data={{ labels: d.labels, datasets: d.datasets || [{ data: d.values || [], borderColor: C.green, tension: 0.4 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 9 }, color: '#99A1B3' } }, y: { ticks: { font: { size: 9 }, color: '#99A1B3' } } } }} /></div> : <div className="text-[10px] text-[#99A1B3]">No chart data</div>;
      case 'pie_chart':
        return d?.labels ? <div className="h-[150px]"><Doughnut data={{ labels: d.labels, datasets: [{ data: d.values || [], backgroundColor: [C.green, C.orange, C.red, '#777', '#00B844'] }] }} options={{ responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { font: { size: 8 }, color: '#5F6880', boxWidth: 6 } } } }} /></div> : <div className="text-[10px] text-[#99A1B3]">No chart data</div>;
      case 'table':
        return d?.rows ? <Table dataSource={d.rows.slice(0, 10)} columns={(d.columns || []).slice(0, 5).map((c: string) => ({ title: c.toUpperCase(), dataIndex: c, key: c, render: (v: any) => <span className="text-[10px]">{String(v ?? '—')}</span> }))} size="small" pagination={false} /> : <div className="text-[10px] text-[#99A1B3]">No table data</div>;
      case 'list':
        return d?.items ? <div className="flex flex-col gap-1">{d.items.slice(0, 8).map((item: any, i: number) => <div key={i} className="text-[10px] text-[#5F6880] py-0.5 border-b border-[#F3F4F6] last:border-0">{item.title || item.label || item}</div>)}</div> : <div className="text-[10px] text-[#99A1B3]">No items</div>;
      default:
        return <div className="text-[10px] text-[#99A1B3]">Unknown widget type: {widget.widgetType}</div>;
    }
  };

  // ============ RENDER ============
  if (state === 'loading') return <div><div className="h-0.5 rounded-sm mb-4 opacity-70" style={{ background: `linear-gradient(90deg, ${C.green} 0%, ${C.green} 35%, ${C.red} 35%, ${C.red} 55%, #1A1A1A 55%, #1A1A1A 75%, ${C.orange} 75%, ${C.orange} 100%)` }} /><div className="grid grid-cols-4 gap-3 mb-4">{Array(4).fill(0).map((_, i) => <Skeleton key={i} active paragraph={{ rows: 2 }} />)}</div></div>;
  if (state === 'error') return <Result status="warning" title="Failed to load" extra={<Button type="primary" onClick={loadAll} icon={<ReloadOutlined />} className="!bg-[#009B3A]">Retry</Button>} />;

  const totalRecords = Object.values(recordCounts).reduce((s, c) => s + c, 0);
  const primaryEntity = entities[0];
  const pendingTasksCount = (tasks || []).filter(t => t.status === 'pending').length;
  const qualityScore = validationSummary?.dataQualityScore ?? 100;
  const anomalyTotal = anomalySummary ? ((anomalySummary?.critical ?? 0) + (anomalySummary?.high ?? 0) + (anomalySummary?.medium ?? 0) + (anomalySummary?.low ?? 0)) : 0;
  const duplicateCount = duplicateSummary?.pendingCount ?? duplicateSummary?.total ?? 0;
  const connectorCount = (connectors || []).length;
  const savedSearchCount = (savedSearches || []).length;
  const workflowDefCount = (workflowDefs || []).length;
  const activeConnectors = (connectors || []).filter((c: any) => c.status === 'active' || c.isActive).length;

  const kpis = [
    { title: 'Pending Tasks', value: pendingTasksCount, color: 'green' as const, icon: '⏰', entity: null as string | null },
    { title: primaryEntity ? `${primaryEntity.name.replace(/_/g, ' ')} Records` : 'Records', value: recordCounts[primaryEntity?.name] || 0, color: 'red' as const, icon: '🗄️', entity: primaryEntity?.name || null },
    { title: 'Total Records', value: totalRecords, color: 'orange' as const, icon: '📊', entity: null },
    { title: 'Data Quality', value: `${qualityScore}%`, color: 'black' as const, icon: '🛡️', entity: null },
  ];

  const enterpriseKpis = [
    { title: 'Anomalies', value: anomalyTotal, color: 'red' as const, icon: '⚠️', entity: null as string | null, link: '/anomalies' },
    { title: 'Duplicate Pairs', value: duplicateCount, color: 'orange' as const, icon: '🔀', entity: null, link: '/intelligence' },
    { title: 'Active Connectors', value: activeConnectors, color: 'green' as const, icon: '🔌', entity: null, link: '/integrations' },
    { title: 'Workflows', value: workflowDefCount, color: 'black' as const, icon: '⚙️', entity: null, link: '/workflows' },
  ];

  const cs: Record<string, { bg: string; text: string; bar: string }> = { green: { bg: C.greenBg, text: C.green, bar: C.green }, red: { bg: C.redBg, text: C.red, bar: C.red }, orange: { bg: C.orangeBg, text: C.orange, bar: C.orange }, black: { bg: C.blackBg, text: C.black, bar: C.black } };

  const orderedKpis = kpiOrder.map(i => kpis[i]);

const sparkOpts = (color: string) => {
  // Convert hex to rgba for the fill
  let fillColor = 'rgba(0,155,58,0.08)'; // default fallback
  try {
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      fillColor = `rgba(${r}, ${g}, ${b}, 0.08)`;
    } else if (color.startsWith('rgb')) {
      fillColor = color.replace(')', ',0.08)').replace('rgb', 'rgba');
    }
  } catch { /* use default */ }

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    elements: {
      point: { radius: 0 },
      line: {
        borderColor: color,
        borderWidth: 1.5,
        tension: 0.4,
        fill: true,
        backgroundColor: fillColor,
      },
    },
  };
};

  const eventTypes = activityStats?.byType ?? [];
  const barData = { labels: eventTypes.map((t: any) => t.eventType?.replace(/_/g, ' ') || 'Unknown'), datasets: [{ data: eventTypes.map((t: any) => t.count), backgroundColor: [C.green, C.orange, C.red, '#777', '#00B844'], borderRadius: 6 }] };
  const barOpts: any = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#99A1B3', font: { size: 9 } } }, y: { grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { color: '#99A1B3', font: { size: 9 } } } } };

  const entityChartData = { labels: entities.map(e => e.name.replace(/_/g, ' ')), datasets: [{ data: entities.map(e => recordCounts[e.name] || 0), backgroundColor: [C.green, C.orange, C.red, '#777', '#00B844'], borderRadius: 6 }] };

  const healthBars = [
    { name: 'Total Records', pct: totalRecords > 0 ? 100 : 0, color: C.green },
    { name: 'Data Quality', pct: qualityScore, color: C.orange },
    { name: 'Pending Tasks', pct: totalRecords > 0 ? Math.min(100, Math.round((pendingTasksCount / totalRecords) * 100)) : 0, color: C.red },
    { name: 'Entities', pct: entities.length > 0 ? 100 : 0, color: C.green },
  ];

  return (
    <div>
      <div className="h-0.5 rounded-sm mb-4 opacity-70" style={{ background: `linear-gradient(90deg, ${C.green} 0%, ${C.green} 35%, ${C.red} 35%, ${C.red} 55%, #1A1A1A 55%, #1A1A1A 75%, ${C.orange} 75%, ${C.orange} 100%)` }} />

      {Object.keys(activeFilters).length > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-white border border-[#009B3A] rounded-lg">
          <FilterOutlined className="text-[#009B3A] text-xs" /> <span className="text-[10px] font-semibold">Filters:</span>
          {Object.entries(activeFilters).map(([k, v]) => <Tag key={k} closable onClose={() => setActiveFilters(prev => { const n = { ...prev }; delete n[k]; return n; })} className="!text-[9px] !bg-[rgba(0,155,58,0.08)] !text-[#009B3A]">{k}:{v}</Tag>)}
          <Button size="small" type="link" onClick={() => setActiveFilters({})} className="!text-[9px] !text-[#CE1126] !p-0">Clear All</Button>
        </div>
      )}

      <PageHeader title={currentDashboard?.name || 'My Workspace'}
        subtitle="Monitor records, workflows, and system health at a glance">
        {dashboards.length > 1 && (
          <Select size="large" value={currentDashboard?.id} onChange={handleSwitchDashboard}
            className="!w-40" options={dashboards.map((d: any) => ({ label: d.name, value: d.id }))} />
        )}
        {layoutChanged && <Button size="small" icon={<SaveOutlined />} onClick={handleSaveLayout}>Save Layout</Button>}
        <Button size="small" icon={<ReloadOutlined />} onClick={loadAll}>Refresh</Button>
        <Button size="small" icon={<PlusOutlined />} onClick={handleCreateDashboard}>New Dashboard</Button>
        <Button size="small" type="primary" icon={<SettingOutlined />} onClick={() => setCustomizeOpen(true)} className="!bg-[#009B3A]">Customize</Button>
      </PageHeader>

      {/* Draggable KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {orderedKpis.map((kpi, i) => (
          <div key={i} draggable onDragStart={() => handleKpiDragStart(i)} onDragEnter={() => handleKpiDragEnter(i)} onDragEnd={handleKpiDragEnd} onDragOver={e => e.preventDefault()}
            onClick={() => kpi.entity ? handleDrillDown(kpi.entity, kpi.title) : null}
            className="bg-white border border-[#E3E7EE] rounded-[10px] p-3.5 shadow-sm cursor-pointer hover:shadow-md transition-all relative group"
          >
            <div className="absolute top-1 right-2 text-[#CBD2DE] text-[8px] opacity-0 group-hover:opacity-100"><HolderOutlined /></div>
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[10px]" style={{ background: cs[kpi.color].bar }} />
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[13px]" style={{ background: cs[kpi.color].bg, color: cs[kpi.color].text }}>{kpi.icon}</div>
            </div>
            <div className="font-heading text-xl font-bold text-[#1A1F2E]">{kpi.value}</div>
            <div className="text-[10px] text-[#99A1B3]">{kpi.title}</div>
          </div>
        ))}
      </div>

      {/* Enterprise KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {enterpriseKpis.map((kpi, i) => (
          <div
            key={`e${i}`}
            onClick={() => kpi.link && navigate(kpi.link)}
            className="bg-white border border-[#E3E7EE] rounded-[10px] p-3.5 shadow-sm cursor-pointer hover:shadow-md transition-all relative group"
          >
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[10px]" style={{ background: cs[kpi.color].bar }} />
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[13px]" style={{ background: cs[kpi.color].bg, color: cs[kpi.color].text }}>{kpi.icon}</div>
              {anomalySummary && anomalySummary.critical > 0 && kpi.title === 'Anomalies' && (
                <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">{anomalySummary.critical} critical</span>
              )}
            </div>
            <div className="font-heading text-xl font-bold text-[#1A1F2E]">{kpi.value}</div>
            <div className="text-[10px] text-[#99A1B3]">{kpi.title}</div>
          </div>
        ))}
      </div>

      {/* Custom Widgets Grid - RESPECTS WIDTH SETTINGS */}
      {currentWidgets.length > 0 && (
        <div className="mb-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
            {currentWidgets.map((w: any) => {
              const width = Math.min(12, Math.max(1, w.position?.w || 3));
              const height = w.position?.h || 2;

              return (
                <div
                  key={w.id}
                  className="bg-white border border-[#E3E7EE] rounded-[10px] p-4 shadow-sm relative group transition-all duration-150 hover:shadow-md"
                  style={{
                    gridColumn: `span ${width}`,
                    minHeight: height === 1 ? '120px' : height === 2 ? '180px' : height === 3 ? '240px' : height === 4 ? '300px' : 'auto',
                  }}
                >
                  {/* Resize Handle */}
                  <div
                    className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 cursor-se-resize transition-opacity z-10"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startWidth = width;
                      const startHeight = height;

                      const onMouseMove = (moveEvent: MouseEvent) => {
                        const deltaX = moveEvent.clientX - startX;
                        const deltaY = moveEvent.clientY - startY;
                        const deltaCols = Math.round(deltaX / 20);
                        const deltaRows = Math.round(deltaY / 30);

                        const newWidth = Math.min(12, Math.max(1, startWidth + deltaCols));
                        const newHeight = Math.min(4, Math.max(1, startHeight + deltaRows));

                        handleWidgetPositionChange(w.id, { ...w.position, w: newWidth, h: newHeight });
                        moveEvent.preventDefault();
                      };

                      const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        setTimeout(() => handleSaveLayout(), 500);
                      };

                      document.addEventListener('mousemove', onMouseMove);
                      document.addEventListener('mouseup', onMouseUp);
                    }}
                  >
                    <div className="w-4 h-4 flex items-center justify-center text-[#CBD2DE]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 20L20 16M12 20L20 12M8 20L20 8M4 20L20 4" stroke="currentColor" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>

                  {/* Widget Header */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-[Space_Grotesk] text-xs font-bold truncate flex-1">{w.name}</h3>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Tooltip title="Refresh"><Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => loadWidgetData(w.id)} className="!text-[9px] !p-0.5" /></Tooltip>
                      <Tooltip title="Edit"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditingWidget(w)} className="!text-[9px] !p-0.5" /></Tooltip>
                      <Tooltip title="Duplicate"><Button size="small" type="text" icon={<CopyOutlined />} onClick={() => handleDuplicateWidget(w)} className="!text-[9px] !p-0.5" /></Tooltip>
                      <Popconfirm title="Remove?" onConfirm={() => handleDeleteWidget(w.id)}><Tooltip title="Delete"><Button size="small" type="text" danger icon={<DeleteOutlined />} className="!text-[9px] !p-0.5" /></Tooltip></Popconfirm>
                    </div>
                  </div>

                  {/* Widget Content */}
                  <div className="overflow-auto" style={{ maxHeight: 'calc(100% - 40px)' }}>
                    {renderWidgetContent(w)}
                  </div>

                  {/* Width indicator */}
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-[8px] text-[#99A1B3] bg-white px-1 rounded">
                    {width}/12
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Enterprise Insights Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-[#E3E7EE] rounded-[10px] p-4 shadow-sm">
          <h3 className="font-[Space_Grotesk] text-xs font-bold mb-3 flex items-center gap-2">⚠️ Anomaly Overview</h3>
          {anomalySummary ? (
            <div>
              <div className="flex gap-3 mb-3">
                <div className="flex-1 text-center p-2 rounded-md bg-red-50">
                  <div className="text-lg font-bold text-[#CE1126]">{anomalySummary.critical ?? 0}</div>
                  <div className="text-[9px] text-[#CE1126]">Critical</div>
                </div>
                <div className="flex-1 text-center p-2 rounded-md bg-orange-50">
                  <div className="text-lg font-bold text-[#E8611D]">{anomalySummary.high ?? 0}</div>
                  <div className="text-[9px] text-[#E8611D]">High</div>
                </div>
                <div className="flex-1 text-center p-2 rounded-md bg-yellow-50">
                  <div className="text-lg font-bold text-[#CA8A04]">{anomalySummary.medium ?? 0}</div>
                  <div className="text-[9px] text-[#CA8A04]">Medium</div>
                </div>
              </div>
              <Button size="small" onClick={() => navigate('/anomalies')} className="!text-[9px] w-full">View All Anomalies</Button>
            </div>
          ) : (
            <div className="text-center py-4 text-[10px] text-[#99A1B3]">No anomaly data</div>
          )}
        </div>
        <div className="bg-white border border-[#E3E7EE] rounded-[10px] p-4 shadow-sm">
          <h3 className="font-[Space_Grotesk] text-xs font-bold mb-3 flex items-center gap-2">🔀 Duplicate Detection</h3>
          {duplicateSummary ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: duplicateCount > 0 ? C.redBg : C.greenBg, color: duplicateCount > 0 ? C.red : C.green }}>
                  {duplicateCount}
                </div>
                <div>
                  <div className="text-[11px] font-semibold">{duplicateCount > 0 ? 'Pending Review' : 'All Clear'}</div>
                  <div className="text-[9px] text-[#99A1B3]">Duplicate groups to resolve</div>
                </div>
              </div>
              <Button size="small" onClick={() => navigate('/intelligence')} className="!text-[9px] w-full">Review Duplicates</Button>
            </div>
          ) : (
            <div className="text-center py-4 text-[10px] text-[#99A1B3]">No duplicate data</div>
          )}
        </div>
        <div className="bg-white border border-[#E3E7EE] rounded-[10px] p-4 shadow-sm">
          <h3 className="font-[Space_Grotesk] text-xs font-bold mb-3 flex items-center gap-2">🔌 Connector Health</h3>
          {connectors.length > 0 ? (
            <div>
              <div className="flex gap-2 mb-3">
                <div className="flex-1 text-center p-2 rounded-md bg-green-50">
                  <div className="text-lg font-bold text-[#009B3A]">{activeConnectors}</div>
                  <div className="text-[9px] text-[#009B3A]">Active</div>
                </div>
                <div className="flex-1 text-center p-2 rounded-md bg-red-50">
                  <div className="text-lg font-bold text-[#CE1126]">{connectors.length - activeConnectors}</div>
                  <div className="text-[9px] text-[#CE1126]">Inactive</div>
                </div>
              </div>
              <Button size="small" onClick={() => navigate('/integrations')} className="!text-[9px] w-full">Manage Connectors</Button>
            </div>
          ) : (
            <div className="text-center py-4 text-[10px] text-[#99A1B3]">No connectors configured</div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white border border-[#E3E7EE] rounded-[10px] p-4 shadow-sm">
          <h3 className="font-[Space_Grotesk] text-xs font-bold mb-3">Activity Events</h3>
          {eventTypes.length > 0 ? <div className="h-[180px]"><Bar data={barData} options={barOpts} /></div> : <div className="h-[180px] flex items-center justify-center text-[11px] text-[#99A1B3]">No activity</div>}
        </div>
        <div className="bg-white border border-[#E3E7EE] rounded-[10px] p-4 shadow-sm">
          <h3 className="font-[Space_Grotesk] text-xs font-bold mb-3">Records by Entity</h3>
          {entities.length > 0 && Object.values(recordCounts).some(v => v > 0) ? <div className="h-[180px]"><Bar data={entityChartData} options={barOpts} /></div> : <div className="h-[180px] flex items-center justify-center text-[11px] text-[#99A1B3]">No records</div>}
        </div>
      </div>

      {/* Pending Tasks */}
      <div className="bg-white border border-[#E3E7EE] rounded-[10px] overflow-hidden mb-4 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#EEF0F4]">
          <h3 className="font-[Space_Grotesk] text-xs font-bold">Pending Tasks ({pendingTasksCount})</h3>
          <Button size="small" onClick={() => navigate('/workflows')} className="!text-[9px]">View All</Button>
        </div>
        {pendingTasksCount > 0 ? (
          <Table dataSource={(tasks || []).filter(t => t.status === 'pending').slice(0, 8)} rowKey="id" size="small" pagination={false}
            columns={[
              { title: 'TASK', dataIndex: 'taskName', render: (v: string) => <span className="font-semibold text-[11px]">{v}</span> },
              { title: 'WORKFLOW', key: 'wf', render: (_: any, r: any) => <span className="text-[10px] text-[#5F6880]">{r.instance?.definition?.name || '—'}</span> },
              { title: 'DUE', dataIndex: 'dueAt', render: (v: string) => <span className="text-[10px] text-[#5F6880]">{v ? new Date(v).toLocaleDateString() : '—'}</span> },
              { title: '', key: 'actions', width: 80, render: (_: any, r: any) => <Space size={4}><Button size="small" type="link" icon={<CheckCircleOutlined />} onClick={() => handleApprove(r.id)} className="!text-[10px] !text-[#009B3A] !p-0" /><Button size="small" type="link" icon={<CloseCircleOutlined />} onClick={() => handleReject(r.id)} className="!text-[10px] !text-[#CE1126] !p-0" /></Space> },
            ]} />
        ) : <div className="text-center py-8 text-xs text-[#99A1B3]">No pending tasks</div>}
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-[#E3E7EE] rounded-[10px] p-4 shadow-sm">
          <h3 className="font-[Space_Grotesk] text-xs font-bold mb-3 flex items-center gap-2">Recent Activity {activityUnread > 0 && <span className="text-[8px] bg-[#009B3A] text-white px-1.5 py-0.5 rounded-full ml-1">{activityUnread} unread</span>}</h3>
          {(activity || []).length > 0 ? activity.slice(0, 5).map((e: any, i: number) => (
            <div key={i} className="flex gap-2 py-2 border-b border-[#EEF0F4] last:border-0">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${['bg-[#009B3A]', 'bg-[#E8611D]', 'bg-[#CE1126]'][i % 3]}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-[#5F6880] truncate">{e.summary || e.eventType?.replace(/_/g, ' ')}</div>
                <div className="text-[9px] text-[#99A1B3]">{e.occurredAt ? new Date(e.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</div>
              </div>
            </div>
          )) : <div className="text-center py-4 text-[10px] text-[#99A1B3]">No activity</div>}
        </div>
        <div className="bg-white border border-[#E3E7EE] rounded-[10px] p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-[Space_Grotesk] text-xs font-bold">System Health</h3>
            <Button size="small" type="link" onClick={() => navigate('/system-health')} className="!text-[9px] !p-0">Details</Button>
          </div>
          {healthBars.map(h => (
            <div key={h.name} className="flex items-center justify-between py-2 border-b border-[#EEF0F4] last:border-0">
              <span className="text-[10px] text-[#5F6880]">{h.name}</span>
              <div className="flex items-center gap-2"><div className="w-20 h-1 bg-[rgba(0,0,0,0.05)] rounded-sm overflow-hidden"><div className="h-full rounded-sm" style={{ width: `${h.pct}%`, background: h.color }} /></div><span className="text-[10px] font-bold" style={{ color: h.color }}>{h.pct}%</span></div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-[#E3E7EE] rounded-[10px] p-4 shadow-sm">
          <h3 className="font-[Space_Grotesk] text-xs font-bold mb-3">Quick Access</h3>
          {[
            { n: 'Records', c: 'green', p: '/records' },
            { n: 'Forms', c: 'orange', p: '/forms' },
            { n: 'Workflows', c: 'red', p: '/workflows' },
            { n: 'Anomalies', c: 'red', p: '/anomalies' },
            { n: 'Saved Searches', c: 'green', p: '/saved-searches' },
            { n: 'System Health', c: 'orange', p: '/system-health' },
          ].map(m => (
            <div key={m.n} onClick={() => navigate(m.p)} className="flex items-center gap-2.5 py-2 px-2.5 rounded-md bg-[#F7F8FA] border border-[#EEF0F4] cursor-pointer mb-1.5 hover:bg-[rgba(0,155,58,0.04)] transition-all">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] ${m.c === 'green' ? 'bg-[rgba(0,155,58,0.07)] text-[#009B3A]' : m.c === 'orange' ? 'bg-[rgba(232,97,29,0.07)] text-[#E8611D]' : 'bg-[rgba(206,17,38,0.07)] text-[#CE1126]'}`}>{m.n.charAt(0)}</div>
              <div className="text-[10px] font-semibold text-[#1A1F2E]">{m.n}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== CUSTOMIZE DRAWER ===== */}
      <Drawer title={<span className="font-[Space_Grotesk] text-sm font-bold">Customize Dashboard</span>} open={customizeOpen} onClose={() => setCustomizeOpen(false)} width={500}>
        <div className="flex flex-col gap-4">
          <Card size="small" title="Your Dashboards">
            {dashboards.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between p-2 bg-[#F7F8FA] rounded-md mb-2">
                <div><div className="text-[11px] font-semibold">{d.name} {d.isDefault && <Tag color="green" className="!text-[8px] ml-1">Default</Tag>}</div></div>
                <Space size={4}>
                  <Button size="small" onClick={() => { handleSwitchDashboard(d.id); setCustomizeOpen(false); }} className="!text-[9px]">View</Button>
                  {!d.isDefault && <Button size="small" onClick={() => handleSetDefault(d.id)} className="!text-[9px]">Set Default</Button>}
                  <Button size="small" danger onClick={() => handleDeleteDashboard(d.id)} className="!text-[9px]">Delete</Button>
                </Space>
              </div>
            ))}
          </Card>
          {currentDashboard && (
            <Card size="small" title={`Widgets (${currentWidgets.length})`} extra={<Button size="small" icon={<PlusOutlined />} onClick={() => { setNewWidget({ name: '', widgetType: 'number', dataSource: 'golden_records', config: { entityName: '', field: '', groupBy: '', aggregation: 'count', limit: 10, sortDirection: 'desc' }, position: { x: 0, y: 0, w: 3, h: 2 }, refreshSeconds: 0 }); setShowAddWidget(true); }} className="!text-[9px]">Add Widget</Button>}>
              {currentWidgets.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between p-2 border-b border-[#EEF0F4] last:border-0">
                  <div><div className="text-[11px] font-semibold">{w.name}</div><div className="text-[9px] text-[#99A1B3]">{w.widgetType} • {w.config?.entityName || 'N/A'}</div></div>
                  <Space size={4}>
                    <Button size="small" type="link" icon={<EditOutlined />} onClick={() => setEditingWidget(w)} className="!text-[9px] !p-0" />
                    <Button size="small" type="link" icon={<CopyOutlined />} onClick={() => handleDuplicateWidget(w)} className="!text-[9px] !p-0" />
                    <Popconfirm title="Remove?" onConfirm={() => handleDeleteWidget(w.id)}><Button size="small" type="link" danger icon={<DeleteOutlined />} className="!text-[9px] !p-0" /></Popconfirm>
                  </Space>
                </div>
              ))}
            </Card>
          )}
        </div>
      </Drawer>

      {/* ===== ADD WIDGET MODAL ===== */}
      <Modal title={<span className="font-[Space_Grotesk] text-sm font-bold">Add Widget</span>} open={showAddWidget} onOk={handleAddWidget} onCancel={() => setShowAddWidget(false)} okText="Add" width={550}>
        <div className="flex flex-col gap-3 mt-3">
          <Input size="large" placeholder="Widget name" value={newWidget.name} onChange={e => setNewWidget({ ...newWidget, name: e.target.value })} />
          <div className="grid grid-cols-4 gap-2">
            {WIDGET_TYPES.map(t => (
              <div key={t.type} onClick={() => setNewWidget({ ...newWidget, widgetType: t.type })}
                className={`p-2 rounded-md border cursor-pointer text-center ${newWidget.widgetType === t.type ? 'border-[#009B3A] bg-[rgba(0,155,58,0.06)]' : 'border-[#E3E7EE]'}`}>
                <div className="text-sm mb-1">{t.icon}</div><div className="text-[9px] font-semibold">{t.label}</div>
              </div>
            ))}
          </div>
          <Select size="large" placeholder="Entity" value={newWidget.config.entityName || undefined} onChange={v => setNewWidget({ ...newWidget, config: { ...newWidget.config, entityName: v } })}
            options={entities.map((e: any) => ({ label: e.name.replace(/_/g, ' '), value: e.name }))} />
          {newWidget.config.entityName && (
            <Select size="large" placeholder="Field" value={newWidget.config.field || undefined} onChange={v => setNewWidget({ ...newWidget, config: { ...newWidget.config, field: v } })}
              options={(entities.find(e => e.name === newWidget.config.entityName)?.attributes || []).map((a: any) => ({ label: a.displayName || a.name, value: a.name }))} />
          )}
          <Select size="large" placeholder="Group By (for charts)" allowClear value={newWidget.config.groupBy || undefined} onChange={v => setNewWidget({ ...newWidget, config: { ...newWidget.config, groupBy: v || '' } })}
            options={newWidget.config.entityName ? (entities.find(e => e.name === newWidget.config.entityName)?.attributes || []).map((a: any) => ({ label: a.displayName || a.name, value: a.name })) : []} />
          <Select size="large" value={newWidget.config.aggregation} onChange={v => setNewWidget({ ...newWidget, config: { ...newWidget.config, aggregation: v } })} options={AGGREGATIONS} />

          {/* Width / Height */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-[#5F6880]">Width (1-12):</span>
            <div className="flex items-center gap-1">
              <Button size="small" className="!text-[10px] !px-2" onClick={() => {
                const newW = Math.max(1, (newWidget.position?.w || 3) - 1);
                setNewWidget({ ...newWidget, position: { ...newWidget.position, w: newW } });
              }}>-</Button>
              <InputNumber size="small" min={1} max={12} value={newWidget.position?.w || 3} onChange={v => setNewWidget({ ...newWidget, position: { ...newWidget.position, w: v || 3 } })} style={{ width: 60 }} />
              <Button size="small" className="!text-[10px] !px-2" onClick={() => {
                const newW = Math.min(12, (newWidget.position?.w || 3) + 1);
                setNewWidget({ ...newWidget, position: { ...newWidget.position, w: newW } });
              }}>+</Button>
            </div>
            <span className="text-[10px] text-[#5F6880] ml-2">Height:</span>
            <div className="flex items-center gap-1">
              <Button size="small" className="!text-[10px] !px-2" onClick={() => {
                const newH = Math.max(1, (newWidget.position?.h || 2) - 1);
                setNewWidget({ ...newWidget, position: { ...newWidget.position, h: newH } });
              }}>-</Button>
              <InputNumber size="small" min={1} max={6} value={newWidget.position?.h || 2} onChange={v => setNewWidget({ ...newWidget, position: { ...newWidget.position, h: v || 2 } })} style={{ width: 60 }} />
              <Button size="small" className="!text-[10px] !px-2" onClick={() => {
                const newH = Math.min(6, (newWidget.position?.h || 2) + 1);
                setNewWidget({ ...newWidget, position: { ...newWidget.position, h: newH } });
              }}>+</Button>
            </div>
          </div>

          <Space size={8}>
            <span className="text-[10px] text-[#99A1B3]">Limit:</span>
            <InputNumber size="small" min={1} max={100} value={newWidget.config.limit} onChange={v => setNewWidget({ ...newWidget, config: { ...newWidget.config, limit: v || 10 } })} />
            <span className="text-[10px] text-[#99A1B3]">Refresh (s):</span>
            <InputNumber size="small" min={0} max={3600} value={newWidget.refreshSeconds} onChange={v => setNewWidget({ ...newWidget, refreshSeconds: v || 0 })} />
          </Space>
        </div>
      </Modal>

      {/* ===== EDIT WIDGET MODAL ===== */}
      <Modal title={<span className="font-[Space_Grotesk] text-sm font-bold">Edit Widget</span>} open={!!editingWidget} onOk={handleUpdateWidget} onCancel={() => setEditingWidget(null)} okText="Save" width={550}>
        {editingWidget && (
          <div className="flex flex-col gap-3 mt-3">
            <Input size="large" value={editingWidget.name} onChange={e => setEditingWidget({ ...editingWidget, name: e.target.value })} />
            <Select size="large" value={editingWidget.widgetType} onChange={v => setEditingWidget({ ...editingWidget, widgetType: v })} options={WIDGET_TYPES.map(t => ({ label: t.label, value: t.type }))} />

            <div className="border-t border-[#EEF0F4] my-2" />

            {/* Data Configuration */}
            <div className="text-[11px] font-semibold text-[#1A1F2E]">Data Source</div>
            <Select size="large" placeholder="Entity" value={editingWidget.config?.entityName || undefined} onChange={v => setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, entityName: v } })}
              options={entities.map((e: any) => ({ label: e.name.replace(/_/g, ' '), value: e.name }))} />
            {editingWidget.config?.entityName && (
              <Select size="large" placeholder="Field" value={editingWidget.config?.field || undefined} onChange={v => setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, field: v } })}
                options={(entities.find(e => e.name === editingWidget.config?.entityName)?.attributes || []).map((a: any) => ({ label: a.displayName || a.name, value: a.name }))} />
            )}
            <Select size="large" placeholder="Group By" allowClear value={editingWidget.config?.groupBy || undefined} onChange={v => setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, groupBy: v || '' } })}
              options={editingWidget.config?.entityName ? (entities.find(e => e.name === editingWidget.config?.entityName)?.attributes || []).map((a: any) => ({ label: a.displayName || a.name, value: a.name })) : []} />
            <Select size="large" value={editingWidget.config?.aggregation || 'count'} onChange={v => setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, aggregation: v } })} options={AGGREGATIONS} />

            <div className="border-t border-[#EEF0F4] my-2" />

            {/* Size Configuration */}
            <div className="text-[11px] font-semibold text-[#1A1F2E]">Widget Size</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#5F6880]">Width:</span>
                <div className="flex items-center gap-1">
                  <Button size="small" className="!text-[10px] !px-2" onClick={() => {
                    const newW = Math.max(1, (editingWidget.position?.w || 3) - 1);
                    setEditingWidget({ ...editingWidget, position: { ...editingWidget.position, w: newW } });
                  }}>-</Button>
                  <InputNumber size="small" min={1} max={12} value={editingWidget.position?.w || 3} onChange={v => setEditingWidget({ ...editingWidget, position: { ...editingWidget.position, w: v || 3 } })} style={{ width: 60 }} />
                  <Button size="small" className="!text-[10px] !px-2" onClick={() => {
                    const newW = Math.min(12, (editingWidget.position?.w || 3) + 1);
                    setEditingWidget({ ...editingWidget, position: { ...editingWidget.position, w: newW } });
                  }}>+</Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#5F6880]">Height:</span>
                <div className="flex items-center gap-1">
                  <Button size="small" className="!text-[10px] !px-2" onClick={() => {
                    const newH = Math.max(1, (editingWidget.position?.h || 2) - 1);
                    setEditingWidget({ ...editingWidget, position: { ...editingWidget.position, h: newH } });
                  }}>-</Button>
                  <InputNumber size="small" min={1} max={6} value={editingWidget.position?.h || 2} onChange={v => setEditingWidget({ ...editingWidget, position: { ...editingWidget.position, h: v || 2 } })} style={{ width: 60 }} />
                  <Button size="small" className="!text-[10px] !px-2" onClick={() => {
                    const newH = Math.min(6, (editingWidget.position?.h || 2) + 1);
                    setEditingWidget({ ...editingWidget, position: { ...editingWidget.position, h: newH } });
                  }}>+</Button>
                </div>
              </div>
            </div>

            {/* Visual width preview */}
            <div className="mt-2 p-2 bg-[#F9FAFB] rounded-md">
              <div className="text-[9px] text-[#99A1B3] mb-1">Preview:</div>
              <div className="flex gap-0.5">
                {Array.from({ length: 12 }).map((_, idx) => (
                  <div key={idx} className={`h-2 rounded-sm flex-1 ${idx < (editingWidget.position?.w || 3) ? 'bg-[#009B3A]' : 'bg-[#E5E7EB]'}`} />
                ))}
              </div>
              <div className="text-[9px] text-[#009B3A] mt-1">
                {editingWidget.position?.w || 3} of 12 columns ({Math.round(((editingWidget.position?.w || 3) / 12) * 100)}% width)
              </div>
            </div>

            <div className="border-t border-[#EEF0F4] my-2" />

            {/* Other settings */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#5F6880]">Limit:</span>
              <InputNumber size="small" min={1} max={100} value={editingWidget.config?.limit || 10} onChange={v => setEditingWidget({ ...editingWidget, config: { ...editingWidget.config, limit: v || 10 } })} />
              <span className="text-[10px] text-[#5F6880] ml-2">Refresh (s):</span>
              <InputNumber size="small" min={0} max={3600} value={editingWidget.refreshSeconds || 0} onChange={v => setEditingWidget({ ...editingWidget, refreshSeconds: v || 0 })} />
            </div>
          </div>
        )}
      </Modal>
{/* ===== DRILL-DOWN DRAWER ===== */}
<Drawer 
  title={<span className="font-[Space_Grotesk] text-sm font-bold">{drillDrawer.title}</span>} 
  open={drillDrawer.open} 
  onClose={() => setDrillDrawer(p => ({ ...p, open: false }))} 
  width={750}
  extra={
    <Button 
      size="small" 
      onClick={() => { 
        setDrillDrawer(p => ({ ...p, open: false })); 
        navigate(`/records?entity=${drillDrawer.entityName}`); 
      }} 
      className="!text-[9px]"
    >
      View All
    </Button>
  }
>
  {drillLoading ? (
    <div className="flex justify-center py-8"><Spin size="small" /></div>
  ) : drillDrawer.records.length > 0 ? (
    <Table
      dataSource={drillDrawer.records}
      rowKey="id"
      size="small"
      pagination={{ size: 'small', pageSize: 15 }}
      scroll={{ x: 600 }}
      columns={(() => {
        // Find the entity to get its attributes
        const entity = entities.find(e => e.name === drillDrawer.entityName);
        const attrs = entity?.attributes || [];
        
        if (attrs.length === 0) {
          // Fallback: extract keys from first record's data
          const firstData = drillDrawer.records[0]?.data || {};
          const keys = Object.keys(firstData).slice(0, 6);
          return [
            {
              title: 'ID', dataIndex: 'id', key: 'id', width: 100,
              render: (v: string) => <span className="font-mono text-[9px] text-[#9CA3AF]">{v?.substring(0, 8)}...</span>,
            },
            ...keys.map(k => ({
              title: k.replace(/_/g, ' ').toUpperCase(),
              key: k,
              ellipsis: true,
              render: (_: any, r: any) => {
                const val = r.data?.[k];
                if (val === null || val === undefined) return <span className="text-[10px] text-[#D1D5DB]">—</span>;
                if (k.includes('email')) return <span className="text-[10px] text-[#2563EB]">{String(val)}</span>;
                if (k.includes('status')) {
                  const colors: Record<string, string> = { active: 'green', approved: 'green', pending: 'orange', rejected: 'red' };
                  return <Tag color={colors[String(val)] || 'default'} className="!text-[9px]">{String(val)}</Tag>;
                }
                return <span className="text-[10px] text-[#374151]">{String(val)}</span>;
              },
            })),
          ];
        }
        
        // Use entity attributes for proper columns
        return [
          {
            title: 'ID', dataIndex: 'id', key: 'id', width: 90,
            render: (v: string) => <span className="font-mono text-[9px] text-[#9CA3AF]">{v?.substring(0, 8)}...</span>,
          },
          ...attrs.slice(0, 6).map((attr: any) => ({
            title: (attr.displayName || attr.name).replace(/_/g, ' ').toUpperCase(),
            key: attr.name,
            ellipsis: true,
            render: (_: any, r: any) => {
              const val = r.data?.[attr.name];
              if (val === null || val === undefined) return <span className="text-[10px] text-[#D1D5DB]">—</span>;
              if (attr.name.toLowerCase().includes('email')) return <span className="text-[10px] text-[#2563EB]">{String(val)}</span>;
              if (attr.name.toLowerCase().includes('status')) {
                const colors: Record<string, string> = { active: 'green', approved: 'green', pending: 'orange', rejected: 'red' };
                return <Tag color={colors[String(val)] || 'default'} className="!text-[9px]">{String(val)}</Tag>;
              }
              if (attr.dataType === 'date' && val) return <span className="text-[10px] text-[#374151]">{new Date(val).toLocaleDateString()}</span>;
              return <span className="text-[10px] text-[#374151]">{String(val)}</span>;
            },
          })),
          {
            title: 'UPDATED', key: 'updatedAt', width: 90,
            render: (_: any, r: any) => <span className="text-[9px] text-[#9CA3AF]">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}</span>,
          },
        ];
      })()}
    />
  ) : (
    <div className="text-center py-12">
      <span className="text-[12px] text-[#9CA3AF]">No records found for this entity</span>
    </div>
  )}
</Drawer>

      {/* ===== TASK DRAWER ===== */}
      <Drawer title="Task Detail" open={taskDrawer.open} onClose={() => setTaskDrawer({ open: false, task: null })} width={500}>
        {taskDrawer.task ? (
          <div className="flex flex-col gap-3">
            <div><span className="text-[10px] text-[#99A1B3]">Task</span><div className="text-xs font-semibold">{taskDrawer.task.taskName}</div></div>
            <div><span className="text-[10px] text-[#99A1B3]">Workflow</span><div className="text-xs">{taskDrawer.task.instance?.definition?.name || '—'}</div></div>
            <div className="flex gap-2 mt-3"><Button type="primary" size="small" onClick={() => { handleApprove(taskDrawer.task.id); setTaskDrawer({ open: false, task: null }); }} className="!bg-[#009B3A] !text-[9px]">Approve</Button><Button size="small" danger onClick={() => { handleReject(taskDrawer.task.id); setTaskDrawer({ open: false, task: null }); }} className="!text-[9px]">Reject</Button></div>
          </div>
        ) : <div className="text-center py-8 text-xs text-[#99A1B3]">No pending tasks</div>}
      </Drawer>
    </div>
  );
}