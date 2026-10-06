export const DEFAULT_ROLES: Record<string, {
  name: string;
  description: string;
  isSystemRole: boolean;
  permissions: string[];
}> = {
  super_admin: {
    name: 'Super Admin',
    description: 'Full system access across all organizations',
    isSystemRole: true,
    permissions: ['*:*'],
  },
  org_admin: {
    name: 'Organization Admin',
    description: 'Full access within their organization',
    permissions: [
      'records:*',
      'forms:*',
      'workflows:*',
      'dashboards:*',
      'reports:*',
      'users:manage',
      'exports:*',
      'templates:*',
      'settings:manage',
      'connectors:*',
      'notifications:*',
      'webhooks:*',
    ],
    isSystemRole: true,
  },
  data_manager: {
    name: 'Data Manager',
    description: 'Can manage data but not system settings',
    permissions: [
      'records:read',
      'records:create',
      'records:update',
      'records:delete',
      'forms:submit',
      'forms:read',
      'forms:manage',
      'workflows:view',
      'workflows:approve',
      'dashboards:view',
      'dashboards:create',
      'reports:view',
      'reports:create',
      'exports:create',
      'connectors:view',
      'connectors:run',
    ],
    isSystemRole: true,
  },
  data_entry: {
    name: 'Data Entry Officer',
    description: 'Can create and view records only',
    permissions: [
      'records:read',
      'records:create',
      'forms:submit',
      'forms:read',
      'dashboards:view',
    ],
    isSystemRole: true,
  },
  reviewer: {
    name: 'Reviewer / Approver',
    description: 'Can view data and approve workflows',
    permissions: [
      'records:read',
      'forms:read',
      'workflows:view',
      'workflows:approve',
      'dashboards:view',
      'reports:view',
    ],
    isSystemRole: true,
  },
  viewer: {
    name: 'Read-Only Viewer',
    description: 'Can only view data and dashboards',
    permissions: [
      'records:read',
      'forms:read',
      'dashboards:view',
      'reports:view',
    ],
    isSystemRole: true,
  },
};