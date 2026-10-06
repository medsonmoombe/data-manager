import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const orgId = useAuthStore((s) => s.orgId);
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check for required actions (e.g., UPDATE_PASSWORD after registration)
  const requiredActions = user?.required_actions || [];
  if (requiredActions.includes('UPDATE_PASSWORD')) {
    return <Navigate to="/change-password" replace />;
  }

  if (!orgId) {
    return <Navigate to="/org-select" replace />;
  }

  return <>{children}</>;
}