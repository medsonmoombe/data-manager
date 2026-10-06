import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme, App as AntApp } from 'antd';
import AppLayout from './components/Layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/Login/LoginPage';
import OrgSelectPage from './pages/OrgSelect/OrgSelectPage';
import TwoFactorPage from './pages/TwoFactor/TwoFactorPage';
import ForgotPasswordPage from './pages/ForgotPassword/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPassword/ResetPasswordPage';
import ChangePasswordPage from './pages/ChangePassword/ChangePasswordPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import RecordsPage from './pages/Records/RecordsPage';
import RecordDetailPage from './pages/Records/RecordsPage';
import DataQualityPage from './pages/Quality/DataQualityPage';
import IntelligencePage from './pages/IntelligencePage/IntelligencePage';
import WorkflowsPage from './pages/WorkflowsPage/WorkflowsPage';
import IntegrationsPage from './pages/IntegrationsPage/IntegrationsPage';
import FormsPage from './pages/FormsPage/FormsPage';
import ReportsPage from './pages/ReportsPage/ReportsPage';
import TeamPage from './pages/Team/TeamPage';
import NotificationsPage from './pages/Notifications/NotificationPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import AnomaliesPage from './pages/AnomaliesPage/AnomaliesPage';
import SystemHealthPage from './pages/SystemHealth/SystemHealthPage';
import SavedSearchesPage from './pages/SavedSearches/SavedSearchesPage';
import MarketplacePage from './pages/MarketplacePage/MarketplacePage';
import RegisterPage from './pages/Register/RegisterPage';
import AcceptInvitationPage from './pages/Register/AcceptInvitationPage';
import VerifyEmailPage from './pages/verifyEmail/verifyEmail';
import NotFoundPage from './pages/NotFound/NotFound';

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            <Route path="/org-select" element={<OrgSelectPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/2fa" element={<TwoFactorPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="records" element={<RecordsPage />} />
              <Route path="records/:id" element={<RecordDetailPage />} />
              <Route path="quality" element={<DataQualityPage />} />
              <Route path="intelligence" element={<IntelligencePage />} />
              <Route path="workflows" element={<WorkflowsPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="forms" element={<FormsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="anomalies" element={<AnomaliesPage />} />
              <Route path="system-health" element={<SystemHealthPage />} />
              <Route path="saved-searches" element={<SavedSearchesPage />} />
              <Route path="marketplace" element={<MarketplacePage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}