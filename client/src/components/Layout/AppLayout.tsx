import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown } from 'antd';
import {
  DashboardOutlined, DatabaseOutlined, ApartmentOutlined,
  TeamOutlined, BarChartOutlined, SafetyOutlined, SettingOutlined,
  UserOutlined, LogoutOutlined, ThunderboltOutlined, ShopOutlined, FormOutlined,
  BulbOutlined, WarningOutlined, BellOutlined, MonitorOutlined,
  SaveOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

import Navbar from './Navbar';

const { Sider, Content } = Layout;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => { logout(); navigate('/login'); };

  const userMenu = {
    items: [
      { key: 'account', icon: <UserOutlined />, label: 'Account', onClick: () => navigate('/settings') },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Sign Out', danger: true, onClick: handleLogout },
    ],
  };

  const menuItems = [
    { type: 'group' as const, label: 'Data Flow', children: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
      { key: '/records', icon: <DatabaseOutlined />, label: 'Records' },
      { key: '/quality', icon: <SafetyOutlined />, label: 'Data Quality' },
      { key: '/intelligence', icon: <BulbOutlined />, label: 'Intelligence' },
      { key: '/workflows', icon: <ApartmentOutlined />, label: 'Workflows' },
    ]},
    { type: 'group' as const, label: 'Operations', children: [
      { key: '/integrations', icon: <ThunderboltOutlined />, label: 'Integrations' },
      { key: '/forms', icon: <FormOutlined />, label: 'Forms' },
      { key: '/reports', icon: <BarChartOutlined />, label: 'Reports' },
    ]},
    { type: 'group' as const, label: 'Management', children: [
      { key: '/team', icon: <TeamOutlined />, label: 'Team' },
      { key: '/notifications', icon: <BellOutlined />, label: 'Notifications' },
      { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
    ]},
  ];

  return (
    <Layout className="min-h-screen">
      <Sider trigger={null} collapsible collapsed={collapsed} width={200} className="!bg-white !border-r !border-[#E3E7EE] shadow-sm !h-screen !sticky !top-0 flex flex-col overflow-hidden">
        <div className="px-3.5 py-3.5 border-b border-[#EEF0F4] flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-[7px] bg-gradient-to-br from-[#009B3A] to-[#E8611D] flex items-center justify-center text-white text-[11px] font-bold font-[Space_Grotesk] flex-shrink-0">OC</div>
          {!collapsed && <span className="text-[13px] font-bold text-[#1A1F2E] tracking-tight font-[Space_Grotesk]">Omni<span className="text-[#E8611D]">Core</span></span>}
        </div>
        <div className="flex-1 overflow-y-auto px-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#E3E7EE]">
          <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} className="px-2 py-2 !border-none" />
        </div>
        <div className="p-2.5 border-t border-[#EEF0F4] flex-shrink-0">
          <Dropdown menu={userMenu} placement="topRight">
            <div className="flex items-center gap-2 p-1.5 rounded-md cursor-pointer hover:bg-[#F7F8FA]">
              <Avatar size={28} className="!rounded-[7px] !bg-gradient-to-br !from-[#E8611D] !to-[#CE1126] !text-[10px] !font-bold">{user?.given_name?.charAt(0) || 'U'}</Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold text-[#1A1F2E] truncate">{user?.given_name || 'User'}</div>
                  <div className="text-[9px] text-[#99A1B3]">Admin</div>
                </div>
              )}
            </div>
          </Dropdown>
        </div>
      </Sider>
      <Layout>
        <Navbar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <Content className="p-4 min-h-[calc(100vh-52px)]">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}