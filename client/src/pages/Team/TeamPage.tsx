import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Input, Space, Tag, Card, Typography, Modal, Tabs,
  Row, Col, Statistic, Progress, Select, message, Popconfirm, Tooltip,
  Badge, Avatar, Form, Descriptions, Drawer, Timeline, Result, Empty,
} from 'antd';
import {
  ReloadOutlined, UserAddOutlined, TeamOutlined, SettingOutlined,
  PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined,
  CheckCircleOutlined, CloseCircleOutlined, StopOutlined,
  SendOutlined, UndoOutlined, FilterOutlined, SearchOutlined,
  MailOutlined, UserOutlined, SafetyOutlined, ClockCircleOutlined,
  BarChartOutlined, HistoryOutlined, CrownOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import api from '../../api/axios';
import { teamsApi } from '../../api/teams.api';
import { invitationsApi } from '../../api/invitations.api';

const { Text, Title } = Typography;

export default function TeamPage() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('teams');

  // ============ USERS ============
  const [users, setUsers] = useState<any[]>([]);
  const [userFilter, setUserFilter] = useState('all');

  // ============ ROLES ============
  const [roles, setRoles] = useState<any[]>([]);

  // ============ TEAMS ============
  const [teams, setTeams] = useState<any[]>([]);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [teamForm, setTeamForm] = useState({ name: '', description: '' });
  const [teamDetailOpen, setTeamDetailOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

  // ============ INVITATIONS ============
  const [invitations, setInvitations] = useState<any[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', teamIds: [] as string[], role: 'member' });

  // ============ ROLE ASSIGNMENT ============
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [assignUser, setAssignUser] = useState<any>(null);
  const [assignRoleId, setAssignRoleId] = useState('');

  // ============ USER DETAIL ============
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // ============ ADD TO TEAM ============
  const [addToTeamOpen, setAddToTeamOpen] = useState(false);
  const [addToTeamUser, setAddToTeamUser] = useState<any>(null);
  const [addToTeamId, setAddToTeamId] = useState('');

  // ============ REPORT ============
  const [reportPeriod, setReportPeriod] = useState('month');
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, teamsRes, invitesRes, rolesRes] = await Promise.all([
        api.get('/users').catch(() => ({ data: [] })),
        teamsApi.list().catch(() => ({ data: [] })),
        invitationsApi.list().catch(() => ({ data: [] })),
        api.get('/roles').catch(() => ({ data: [] })),
      ]);
      setUsers(usersRes.data || []);
      setTeams(teamsRes.data || []);
      setInvitations(invitesRes.data || []);
      setRoles(rolesRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ============ TEAM CRUD ============
  const createTeam = async () => {
    if (!teamForm.name.trim()) { message.warning('Team name is required'); return; }
    try {
      await teamsApi.create(teamForm);
      message.success('Team created');
      setCreateTeamOpen(false);
      setTeamForm({ name: '', description: '' });
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  const saveTeam = async () => {
    if (!editingTeam || !teamForm.name.trim()) return;
    try {
      await teamsApi.update(editingTeam.id, teamForm);
      message.success('Team updated');
      setEditingTeam(null);
      setTeamForm({ name: '', description: '' });
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  const deleteTeam = async (id: string) => {
    try {
      await teamsApi.delete(id);
      message.success('Team deleted');
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  const viewTeam = async (team: any) => {
    try {
      const res = await teamsApi.getById(team.id);
      setSelectedTeam(res.data || res);
      setTeamDetailOpen(true);
    } catch { setSelectedTeam(team); setTeamDetailOpen(true); }
  };

  const removeFromTeam = async (teamId: string, userId: string) => {
    try {
      await teamsApi.removeMember(teamId, userId);
      message.success('Member removed');
      if (selectedTeam?.id === teamId) {
        setSelectedTeam({
          ...selectedTeam,
          members: selectedTeam.members?.filter((m: any) => m.userId !== userId),
        });
      }
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  const changeMemberRole = async (teamId: string, userId: string, role: string) => {
    try {
      await teamsApi.updateMemberRole(teamId, userId, role);
      message.success('Role updated');
      if (selectedTeam?.id === teamId) {
        setSelectedTeam({
          ...selectedTeam,
          members: selectedTeam.members?.map((m: any) =>
            m.userId === userId ? { ...m, role } : m
          ),
        });
      }
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  // ============ INVITATIONS ============
  const sendInvite = async () => {
    if (!inviteForm.email.trim()) { message.warning('Email is required'); return; }
    try {
      await invitationsApi.create(inviteForm);
      message.success('Invitation sent');
      setInviteOpen(false);
      setInviteForm({ email: '', teamIds: [], role: 'member' });
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  const revokeInvite = async (id: string) => {
    try {
      await invitationsApi.revoke(id);
      message.success('Invitation revoked');
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  const resendInvite = async (id: string) => {
    try {
      await invitationsApi.resend(id);
      message.success('Invitation resent');
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  // ============ ROLE ASSIGNMENT ============
  const openAssignRole = (user: any) => {
    setAssignUser(user);
    setAssignRoleId(user.userRoles?.[0]?.role?.id || '');
    setAssignRoleOpen(true);
  };

  const saveRoleAssignment = async () => {
    if (!assignUser || !assignRoleId) return;
    try {
      const currentRoleId = assignUser.userRoles?.[0]?.role?.id;
      if (currentRoleId) {
        await api.delete(`/users/${assignUser.id}/roles/${currentRoleId}`);
      }
      await api.post(`/users/${assignUser.id}/roles/${assignRoleId}`);
      message.success('Role assigned');
      setAssignRoleOpen(false);
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  // ============ USER ACTIONS ============
  const toggleUserStatus = async (user: any) => {
    try {
      if (user.isActive) {
        await api.post(`/users/${user.id}/deactivate`);
        message.success('User deactivated');
      } else {
        await api.post(`/users/${user.id}/activate`);
        message.success('User activated');
      }
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  const viewUserDetail = async (user: any) => {
    setSelectedUser(user);
    setUserDetailOpen(true);
    setActivityLoading(true);
    try {
      const res = await api.get(`/users/${user.id}/activity`, { params: { limit: 50 } });
      setUserActivity(res.data || []);
    } catch { setUserActivity([]); }
    finally { setActivityLoading(false); }
  };

  const addUserToTeam = async () => {
    if (!addToTeamUser || !addToTeamId) return;
    try {
      await teamsApi.addMembers(addToTeamId, [addToTeamUser.id], 'member');
      message.success('User added to team');
      setAddToTeamOpen(false);
      setAddToTeamId('');
      loadAll();
    } catch (err: any) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  // ============ REPORT ============
  const generateReport = async () => {
    setReportLoading(true);
    try {
      const res = await api.get('/intelligence/reports/narrative', {
        params: { period: reportPeriod },
      });
      setReportData(res.data || res);
      message.success('Report generated');
    } catch { message.error('Failed to generate report'); }
    finally { setReportLoading(false); }
  };

  // ============ FILTERS ============
  const filteredUsers = userFilter === 'all'
    ? users
    : users.filter((u: any) => userFilter === 'active' ? u.isActive : !u.isActive);

  // ============ STATS ============
  const totalMembers = users.filter((u: any) => u.isActive).length;
  const totalTeams = teams.length;
  const pendingInvites = invitations.filter((i: any) => i.status === 'pending').length;
  const teamlessUsers = users.filter((u: any) => !u.teams?.length).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Team Management</h2>
          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
            Manage users, teams, roles, and invitations
          </Text>
        </div>
        <Space size={8}>
          <Button size="small" icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>Refresh</Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 10 }}>Active Members</span>}
              value={totalMembers} valueStyle={{ fontSize: 22, color: '#16A34A' }}
              prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 10 }}>Teams</span>}
              value={totalTeams} valueStyle={{ fontSize: 22, color: '#2563EB' }}
              prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 10 }}>Pending Invites</span>}
              value={pendingInvites} valueStyle={{ fontSize: 22, color: '#E8611D' }}
              prefix={<MailOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 10 }}>Teamless Users</span>}
              value={teamlessUsers} valueStyle={{ fontSize: 22, color: '#7C3AED' }}
              prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 10 }}>Roles</span>}
              value={roles.length} valueStyle={{ fontSize: 22, color: '#059669' }}
              prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" bodyStyle={{ padding: '14px 16px', textAlign: 'center' }}>
            <Statistic title={<span style={{ fontSize: 10 }}>Inactive</span>}
              value={users.filter((u: any) => !u.isActive).length}
              valueStyle={{ fontSize: 22, color: '#DC2626' }}
              prefix={<StopOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Tabs size="small" activeKey={activeTab} onChange={setActiveTab}
        items={[

          // ============ TEAMS TAB ============
          {
            key: 'teams',
            label: `Teams (${teams.length})`,
            children: (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <Button size="small" type="primary" icon={<PlusOutlined />}
                    onClick={() => { setTeamForm({ name: '', description: '' }); setCreateTeamOpen(true); }}
                    style={{ background: '#009B3A' }}>
                    Create Team
                  </Button>
                </div>
                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                  <Table
                    dataSource={teams}
                    rowKey="id"
                    size="small"
                    loading={loading}
                    pagination={{ size: 'small', pageSize: 15 }}
                    columns={[
                      {
                        title: 'NAME', key: 'name',
                        render: (_: any, r: any) => (
                          <Button type="link" size="small" onClick={() => viewTeam(r)}
                            style={{ fontWeight: 500, fontSize: 12, padding: 0 }}>
                            {r.name}
                          </Button>
                        ),
                      },
                      {
                        title: 'DESCRIPTION', dataIndex: 'description', key: 'desc',
                        ellipsis: true,
                        render: (v: string) => <span style={{ fontSize: 11, color: '#6B7280' }}>{v || '—'}</span>,
                      },
                      {
                        title: 'MEMBERS', key: 'members',
                        render: (_: any, r: any) => (
                          <span style={{ fontSize: 12, fontWeight: 600 }}>
                            {(r._count?.members || r.members?.length || 0)}
                          </span>
                        ),
                      },
                      {
                        title: 'CREATED', dataIndex: 'createdAt', key: 'created',
                        render: (v: string) => <span style={{ fontSize: 10, color: '#9CA3AF' }}>{v ? new Date(v).toLocaleDateString() : '—'}</span>,
                      },
                      {
                        title: '', key: 'actions', width: 160,
                        render: (_: any, r: any) => (
                          <Space size={4}>
                            <Button size="small" type="link" icon={<EyeOutlined />}
                              onClick={() => viewTeam(r)} style={{ fontSize: 10 }} />
                            <Button size="small" type="link" icon={<EditOutlined />}
                              onClick={() => { setEditingTeam(r); setTeamForm({ name: r.name, description: r.description || '' }); }}
                              style={{ fontSize: 10 }} />
                            <Popconfirm title="Delete team?" onConfirm={() => deleteTeam(r.id)}>
                              <Button size="small" type="link" danger icon={<DeleteOutlined />}
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

          // ============ USERS TAB ============
          {
            key: 'users',
            label: `Users (${users.length})`,
            children: (
              <div>
                <div style={{ marginBottom: 12, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                  <Space size={8}>
                    <Button size="small" type={userFilter === 'all' ? 'primary' : 'default'}
                      onClick={() => setUserFilter('all')} style={{ fontSize: 11 }}>All</Button>
                    <Button size="small" type={userFilter === 'active' ? 'primary' : 'default'}
                      onClick={() => setUserFilter('active')} style={{ fontSize: 11 }}>Active</Button>
                    <Button size="small" type={userFilter === 'inactive' ? 'primary' : 'default'}
                      onClick={() => setUserFilter('inactive')} style={{ fontSize: 11 }}>Inactive</Button>
                  </Space>
                  <Button size="small" icon={<UserAddOutlined />}
                    onClick={() => setInviteOpen(true)}>
                    Invite User
                  </Button>
                </div>
                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                  <Table
                    dataSource={filteredUsers}
                    rowKey="id"
                    size="small"
                    loading={loading}
                    pagination={{ size: 'small', pageSize: 15 }}
                    columns={[
                      {
                        title: 'USER', key: 'name',
                        render: (_: any, r: any) => (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar size={28} style={{ background: r.isActive ? '#16A34A' : '#9CA3AF', fontSize: 11 }}>
                              {r.firstName?.charAt(0) || r.email?.charAt(0)?.toUpperCase()}
                            </Avatar>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>
                                {r.firstName} {r.lastName}
                              </div>
                              <div style={{ fontSize: 10, color: '#9CA3AF' }}>{r.email}</div>
                            </div>
                          </div>
                        ),
                      },
                      {
                        title: 'USERNAME', dataIndex: 'username', key: 'username',
                        render: (v: string) => <span style={{ fontSize: 11, color: '#6B7280' }}>{v || '—'}</span>,
                      },
                      {
                        title: 'ROLES', key: 'roles',
                        render: (_: any, r: any) => (
                          <Space size={4} wrap>
                            {(r.userRoles || []).map((ur: any) => (
                              <Tag key={ur.role?.id || ur.roleId} color="blue" style={{ fontSize: 10 }}>
                                {ur.role?.name || 'Unknown'}
                              </Tag>
                            ))}
                            {!r.userRoles?.length && <span style={{ fontSize: 10, color: '#9CA3AF' }}>—</span>}
                          </Space>
                        ),
                      },
                      {
                        title: 'TEAMS', key: 'teams',
                        render: (_: any, r: any) => (
                          <Space size={4} wrap>
                            {(r.teams || []).map((t: any) => (
                              <Tag key={t.team?.id || t.teamId} style={{ fontSize: 10 }}>
                                {t.team?.name || 'Unknown'}
                              </Tag>
                            ))}
                            {!r.teams?.length && <span style={{ fontSize: 10, color: '#9CA3AF' }}>—</span>}
                          </Space>
                        ),
                      },
                      {
                        title: 'STATUS', dataIndex: 'isActive', key: 'status',
                        render: (v: boolean) => (
                          <Tag color={v ? 'green' : 'red'} style={{ fontSize: 10 }}>
                            {v ? 'Active' : 'Inactive'}
                          </Tag>
                        ),
                      },
                      {
                        title: '', key: 'actions', width: 200,
                        render: (_: any, r: any) => (
                          <Space size={4}>
                            <Tooltip title="View details">
                              <Button size="small" type="link" icon={<EyeOutlined />}
                                onClick={() => viewUserDetail(r)} style={{ fontSize: 10 }} />
                            </Tooltip>
                            <Tooltip title="Assign role">
                              <Button size="small" type="link" icon={<SafetyOutlined />}
                                onClick={() => openAssignRole(r)} style={{ fontSize: 10 }} />
                            </Tooltip>
                            <Tooltip title="Add to team">
                              <Button size="small" type="link" icon={<TeamOutlined />}
                                onClick={() => { setAddToTeamUser(r); setAddToTeamId(''); setAddToTeamOpen(true); }}
                                style={{ fontSize: 10 }} />
                            </Tooltip>
                            <Tooltip title={r.isActive ? 'Deactivate' : 'Activate'}>
                              <Button size="small" type="link"
                                icon={r.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
                                onClick={() => toggleUserStatus(r)}
                                style={{ fontSize: 10, color: r.isActive ? '#DC2626' : '#16A34A' }} />
                            </Tooltip>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              </div>
            ),
          },

          // ============ INVITATIONS TAB ============
          {
            key: 'invitations',
            label: `Invitations (${pendingInvites})`,
            children: (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <Button size="small" type="primary" icon={<UserAddOutlined />}
                    onClick={() => setInviteOpen(true)}
                    style={{ background: '#009B3A' }}>
                    Invite User
                  </Button>
                </div>
                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                  <Table
                    dataSource={invitations}
                    rowKey="id"
                    size="small"
                    loading={loading}
                    pagination={{ size: 'small', pageSize: 15 }}
                    columns={[
                      {
                        title: 'EMAIL', dataIndex: 'email', key: 'email',
                        render: (v: string) => (
                          <Space>
                            <MailOutlined style={{ color: '#9CA3AF' }} />
                            <span style={{ fontWeight: 500, fontSize: 12 }}>{v}</span>
                          </Space>
                        ),
                      },
                      {
                        title: 'ROLE', dataIndex: 'role', key: 'role',
                        render: (v: string) => (
                          <Tag color={v === 'admin' ? 'red' : v === 'manager' ? 'blue' : 'default'}
                            style={{ fontSize: 10 }}>
                            {v || 'member'}
                          </Tag>
                        ),
                      },
                      {
                        title: 'TEAMS', key: 'teams',
                        render: (_: any, r: any) => (
                          <Space size={4} wrap>
                            {(r.teams || r.teamIds || []).map((t: any, i: number) => (
                              <Tag key={i} style={{ fontSize: 10 }}>
                                {typeof t === 'string' ? t.substring(0, 8) : t.name || t}
                              </Tag>
                            ))}
                            {!r.teams?.length && !r.teamIds?.length &&
                              <span style={{ fontSize: 10, color: '#9CA3AF' }}>No teams</span>}
                          </Space>
                        ),
                      },
                      {
                        title: 'STATUS', dataIndex: 'status', key: 'status',
                        render: (v: string) => {
                          const colors: Record<string, string> = {
                            pending: 'orange', accepted: 'green', revoked: 'red', expired: 'default',
                          };
                          return <Tag color={colors[v] || 'default'} style={{ fontSize: 10 }}>{v || 'pending'}</Tag>;
                        },
                      },
                      {
                        title: 'SENT', dataIndex: 'createdAt', key: 'sent',
                        render: (v: string) => <span style={{ fontSize: 10, color: '#9CA3AF' }}>{v ? new Date(v).toLocaleDateString() : '—'}</span>,
                      },
                      {
                        title: '', key: 'actions', width: 120,
                        render: (_: any, r: any) => (
                          <Space size={4}>
                            {r.status === 'pending' && (
                              <>
                                <Tooltip title="Resend">
                                  <Button size="small" type="link" icon={<SendOutlined />}
                                    onClick={() => resendInvite(r.id)} style={{ fontSize: 10 }} />
                                </Tooltip>
                                <Popconfirm title="Revoke this invitation?" onConfirm={() => revokeInvite(r.id)}>
                                  <Button size="small" type="link" danger icon={<DeleteOutlined />}
                                    style={{ fontSize: 10 }} />
                                </Popconfirm>
                              </>
                            )}
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              </div>
            ),
          },

          // ============ ACTIVITY TAB ============
          {
            key: 'activity',
            label: 'Activity',
            children: (
              <div>
                <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 10, border: '1px solid #E5E7EB' }}>
                  {users.length === 0 ? (
                    <Empty description="No users found" />
                  ) : (
                    <Row gutter={12}>
                      {users.filter((u: any) => u.isActive).slice(0, 8).map((user: any) => (
                        <Col span={6} key={user.id} style={{ marginBottom: 12 }}>
                          <Card
                            size="small"
                            hoverable
                            bodyStyle={{ padding: 12 }}
                            onClick={() => viewUserDetail(user)}
                            style={{ borderRadius: 8 }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar size={36} style={{ background: '#2563EB', fontSize: 14 }}>
                                {user.firstName?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
                              </Avatar>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {user.firstName} {user.lastName}
                                </div>
                                <div style={{ fontSize: 10, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {user.email}
                                </div>
                                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
                                  {(user.userRoles || []).map((ur: any) => ur.role?.name).join(', ') || 'No role'}
                                </div>
                              </div>
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
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
                  <Card size="small" title="Generate Team Report" bodyStyle={{ padding: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <Select size="small" value={reportPeriod} onChange={setReportPeriod}
                        options={[
                          { label: 'Weekly', value: 'week' },
                          { label: 'Monthly', value: 'month' },
                          { label: 'Quarterly', value: 'quarter' },
                          { label: 'Yearly', value: 'year' },
                        ]} />
                      <Button type="primary" size="small" onClick={generateReport} loading={reportLoading}
                        style={{ background: '#009B3A' }} block>
                        Generate Report
                      </Button>
                      <Button size="small" icon={<ReloadOutlined />} onClick={loadAll} block>
                        Refresh Data
                      </Button>
                    </div>
                  </Card>
                  <Card size="small" title="Quick Stats" bodyStyle={{ padding: 16 }} style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, lineHeight: 2 }}>
                      <div><Text style={{ color: '#6B7280' }}>Members per team:</Text> <Text strong>{(totalTeams ? (totalMembers / totalTeams).toFixed(1) : 0)} avg</Text></div>
                      <div><Text style={{ color: '#6B7280' }}>Pending invites:</Text> <Text strong>{pendingInvites}</Text></div>
                      <div><Text style={{ color: '#6B7280' }}>Teamless users:</Text> <Text strong>{teamlessUsers}</Text></div>
                      <div><Text style={{ color: '#6B7280' }}>Roles defined:</Text> <Text strong>{roles.length}</Text></div>
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

      {/* ============ CREATE TEAM MODAL ============ */}
      <Modal
        title="Create Team"
        open={createTeamOpen}
        onOk={createTeam}
        onCancel={() => setCreateTeamOpen(false)}
        okText="Create"
        width={420}
        okButtonProps={{ style: { background: '#009B3A' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div>
            <Text style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block' }}>Team Name *</Text>
            <Input size="small" placeholder="e.g. Engineering" value={teamForm.name}
              onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} />
          </div>
          <div>
            <Text style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block' }}>Description</Text>
            <Input.TextArea size="small" rows={3} placeholder="Team description..." value={teamForm.description}
              onChange={e => setTeamForm({ ...teamForm, description: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* ============ EDIT TEAM MODAL ============ */}
      <Modal
        title="Edit Team"
        open={!!editingTeam}
        onOk={saveTeam}
        onCancel={() => { setEditingTeam(null); setTeamForm({ name: '', description: '' }); }}
        okText="Save"
        width={420}
        okButtonProps={{ style: { background: '#009B3A' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div>
            <Text style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block' }}>Team Name *</Text>
            <Input size="small" placeholder="e.g. Engineering" value={teamForm.name}
              onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} />
          </div>
          <div>
            <Text style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block' }}>Description</Text>
            <Input.TextArea size="small" rows={3} placeholder="Team description..." value={teamForm.description}
              onChange={e => setTeamForm({ ...teamForm, description: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* ============ TEAM DETAIL DRAWER ============ */}
      <Drawer
        title={<span style={{ fontWeight: 600 }}>{selectedTeam?.name || 'Team Details'}</span>}
        open={teamDetailOpen}
        onClose={() => { setTeamDetailOpen(false); setSelectedTeam(null); }}
        width={550}
      >
        {selectedTeam ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card size="small" title="Details">
              <Descriptions size="small" column={1} labelStyle={{ fontSize: 10, color: '#9CA3AF' }} contentStyle={{ fontSize: 12 }}>
                <Descriptions.Item label="Description">{selectedTeam.description || '—'}</Descriptions.Item>
                <Descriptions.Item label="Created">{selectedTeam.createdAt ? new Date(selectedTeam.createdAt).toLocaleString() : '—'}</Descriptions.Item>
                <Descriptions.Item label="Members">{(selectedTeam.members?.length || selectedTeam._count?.members || 0)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title={`Members (${selectedTeam.members?.length || 0})`} bodyStyle={{ padding: 0 }}>
              <Table
                dataSource={selectedTeam.members || []}
                rowKey={(r: any) => r.userId || r.id}
                size="small"
                pagination={false}
                columns={[
                  {
                    title: 'USER', key: 'user',
                    render: (_: any, r: any) => {
                      const user = r.user || users.find((u: any) => u.id === r.userId);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar size={24} style={{ background: '#2563EB', fontSize: 10 }}>
                            {user?.firstName?.charAt(0) || r.userId?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 500 }}>
                              {user?.firstName} {user?.lastName || 'Unknown'}
                            </div>
                            <div style={{ fontSize: 10, color: '#9CA3AF' }}>{user?.email || r.userId}</div>
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    title: 'ROLE', dataIndex: 'role', key: 'role',
                    render: (v: string) => (
                      <Select size="small" value={v || 'member'}
                        onChange={(newRole) => changeMemberRole(selectedTeam.id, selectedTeam.members?.find((m: any) => m.role === v)?.userId || v, newRole)}
                        style={{ width: 100 }}
                        options={[
                          { label: 'Admin', value: 'admin' },
                          { label: 'Manager', value: 'manager' },
                          { label: 'Member', value: 'member' },
                          { label: 'Viewer', value: 'viewer' },
                        ]}
                      />
                    ),
                  },
                  {
                    title: '', width: 60,
                    render: (_: any, r: any) => (
                      <Popconfirm title="Remove member?" onConfirm={() => removeFromTeam(selectedTeam.id, r.userId)}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    ),
                  },
                ]}
              />
            </Card>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading...</div>
        )}
      </Drawer>

      {/* ============ INVITE USER MODAL ============ */}
      <Modal
        title="Invite User"
        open={inviteOpen}
        onOk={sendInvite}
        onCancel={() => { setInviteOpen(false); setInviteForm({ email: '', teamIds: [], role: 'member' }); }}
        okText="Send Invitation"
        width={480}
        okButtonProps={{ style: { background: '#009B3A' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div>
            <Text style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block' }}>Email Address *</Text>
            <Input size="small" placeholder="user@example.com" value={inviteForm.email}
              onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} />
          </div>
          <div>
            <Text style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block' }}>Role</Text>
            <Select size="small" value={inviteForm.role} onChange={role => setInviteForm({ ...inviteForm, role })}
              style={{ width: '100%' }}
              options={[
                { label: 'Admin', value: 'admin' },
                { label: 'Manager', value: 'manager' },
                { label: 'Member', value: 'member' },
                { label: 'Viewer', value: 'viewer' },
              ]} />
          </div>
          <div>
            <Text style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, display: 'block' }}>Teams</Text>
            <Select size="small" mode="multiple" value={inviteForm.teamIds}
              onChange={ids => setInviteForm({ ...inviteForm, teamIds: ids })}
              style={{ width: '100%' }}
              placeholder="Select teams"
              options={teams.map((t: any) => ({ label: t.name, value: t.id }))}
            />
          </div>
        </div>
      </Modal>

      {/* ============ ASSIGN ROLE MODAL ============ */}
      <Modal
        title={`Assign Role — ${assignUser?.firstName || ''} ${assignUser?.lastName || ''}`}
        open={assignRoleOpen}
        onOk={saveRoleAssignment}
        onCancel={() => { setAssignRoleOpen(false); setAssignUser(null); }}
        okText="Assign"
        width={360}
        okButtonProps={{ style: { background: '#009B3A' } }}
      >
        <div style={{ marginTop: 12 }}>
          <Select placeholder="Select role" value={assignRoleId || undefined}
            onChange={setAssignRoleId} style={{ width: '100%' }} size="small"
            options={roles.map((r: any) => ({ label: r.name, value: r.id }))} />
        </div>
      </Modal>

      {/* ============ ADD TO TEAM MODAL ============ */}
      <Modal
        title={`Add to Team — ${addToTeamUser?.firstName || ''} ${addToTeamUser?.lastName || ''}`}
        open={addToTeamOpen}
        onOk={addUserToTeam}
        onCancel={() => { setAddToTeamOpen(false); setAddToTeamUser(null); setAddToTeamId(''); }}
        okText="Add"
        width={360}
        okButtonProps={{ style: { background: '#009B3A' } }}
      >
        <div style={{ marginTop: 12 }}>
          <Select placeholder="Select team" value={addToTeamId || undefined}
            onChange={setAddToTeamId} style={{ width: '100%' }} size="small"
            options={teams.map((t: any) => ({ label: t.name, value: t.id }))} />
        </div>
      </Modal>

      {/* ============ USER DETAIL DRAWER ============ */}
      <Drawer
        title={<span style={{ fontWeight: 600 }}>{selectedUser?.firstName || ''} {selectedUser?.lastName || ''}</span>}
        open={userDetailOpen}
        onClose={() => { setUserDetailOpen(false); setSelectedUser(null); setUserActivity([]); }}
        width={550}
      >
        {selectedUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Profile */}
            <Card size="small">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Avatar size={48} style={{ background: selectedUser.isActive ? '#16A34A' : '#9CA3AF', fontSize: 18 }}>
                  {selectedUser.firstName?.charAt(0) || selectedUser.email?.charAt(0)?.toUpperCase()}
                </Avatar>
                <div>
                  <Title level={5} style={{ margin: 0, fontSize: 14 }}>{selectedUser.firstName} {selectedUser.lastName}</Title>
                  <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{selectedUser.email}</Text>
                </div>
              </div>
              <Descriptions size="small" column={2} labelStyle={{ fontSize: 10, color: '#9CA3AF' }} contentStyle={{ fontSize: 12 }}>
                <Descriptions.Item label="Username">{selectedUser.username || '—'}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={selectedUser.isActive ? 'green' : 'red'} style={{ fontSize: 10 }}>
                    {selectedUser.isActive ? 'Active' : 'Inactive'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Timezone">{selectedUser.timezone || '—'}</Descriptions.Item>
                <Descriptions.Item label="Last Active">{selectedUser.lastActiveAt ? new Date(selectedUser.lastActiveAt).toLocaleString() : '—'}</Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Roles */}
            <Card size="small" title="Roles" bodyStyle={{ padding: 0 }}>
              <Table
                dataSource={selectedUser.userRoles || []}
                rowKey={(r: any) => r.role?.id || r.id}
                size="small"
                pagination={false}
                columns={[
                  { title: 'ROLE', key: 'role', render: (_: any, r: any) => <Tag color="blue" style={{ fontSize: 10 }}>{r.role?.name}</Tag> },
                  {
                    title: 'PERMISSIONS', key: 'perms',
                    render: (_: any, r: any) => (
                      <span style={{ fontSize: 10, color: '#6B7280' }}>
                        {(r.role?.permissions as string[])?.slice(0, 3).join(', ') || '—'}
                        {(r.role?.permissions as string[])?.length > 3 ? ` +${(r.role.permissions as string[]).length - 3}` : ''}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>

            {/* Teams */}
            <Card size="small" title="Teams" bodyStyle={{ padding: 0 }}>
              <Table
                dataSource={selectedUser.teams || []}
                rowKey={(r: any) => r.team?.id || r.teamId}
                size="small"
                pagination={false}
                columns={[
                  { title: 'TEAM', key: 'team', render: (_: any, r: any) => <span style={{ fontSize: 12 }}>{r.team?.name || 'Unknown'}</span> },
                  { title: 'ROLE', dataIndex: 'role', render: (v: string) => <Tag style={{ fontSize: 10 }}>{v || 'member'}</Tag> },
                ]}
              />
            </Card>

            {/* Activity */}
            <Card size="small" title="Recent Activity" bodyStyle={{ padding: 0 }}>
              {activityLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
              ) : userActivity.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 11 }}>No recent activity</div>
              ) : (
                <Timeline style={{ padding: 16 }}>
                  {userActivity.slice(0, 15).map((a: any, i: number) => (
                    <Timeline.Item key={i} color={['green', 'blue', 'orange', 'gray'][i % 4]}>
                      <div style={{ fontSize: 11 }}>{a.action || a.type?.replace(/_/g, ' ') || 'Event'}</div>
                      {a.details && <div style={{ fontSize: 10, color: '#6B7280' }}>{typeof a.details === 'string' ? a.details : JSON.stringify(a.details)}</div>}
                      <div style={{ fontSize: 9, color: '#9CA3AF' }}>{a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              )}
            </Card>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No user selected</div>
        )}
      </Drawer>
    </div>
  );
}
