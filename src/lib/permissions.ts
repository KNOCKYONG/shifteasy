/**
 * Permission Matrix for ShiftEasy
 * Defines all permissions and role-based access control
 */

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEMBER: 'member',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// Permission definitions
export const PERMISSIONS = {
  // Schedule permissions
  'schedule.create': 'Create new schedules',
  'schedule.edit': 'Edit existing schedules',
  'schedule.delete': 'Delete schedules',
  'schedule.publish': 'Publish schedules',
  'schedule.view': 'View all schedules',
  'schedule.view.own': 'View own schedules',

  // Staff permissions
  'staff.create': 'Create new staff members',
  'staff.edit': 'Edit staff information',
  'staff.delete': 'Remove staff members',
  'staff.view': 'View all staff',
  'staff.view.own': 'View own profile',

  // Swap permissions
  'swap.approve': 'Approve swap requests',
  'swap.reject': 'Reject swap requests',
  'swap.request': 'Request shift swaps',
  'swap.request.own': 'Request own shift swaps',
  'swap.view': 'View all swap requests',
  'swap.view.own': 'View own swap requests',

  // Assignment permissions
  'assignment.create': 'Create assignments',
  'assignment.edit': 'Edit assignments',
  'assignment.delete': 'Delete assignments',
  'assignment.lock': 'Lock assignments',
  'assignment.view': 'View all assignments',
  'assignment.view.own': 'View own assignments',

  // Attendance permissions
  'attendance.manage': 'Manage attendance records',
  'attendance.view': 'View all attendance',
  'attendance.view.own': 'View own attendance',
  'attendance.clock': 'Clock in/out',

  // Report permissions
  'report.create': 'Generate reports',
  'report.view': 'View reports',
  'report.export': 'Export reports',

  // Settings permissions
  'settings.manage': 'Manage organization settings',
  'settings.billing': 'Manage billing and subscriptions',
  'settings.security': 'Manage security settings',

  // Audit permissions
  'audit.view': 'View audit logs',
  'audit.export': 'Export audit logs',

  // User management permissions
  'user.invite': 'Invite new users',
  'user.remove': 'Remove users',
  'user.role.change': 'Change user roles',

  // Notification permissions
  'notification.send': 'Send notifications',
  'notification.view': 'View notifications',
  'notification.manage': 'Manage notifications',
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Role-Permission Matrix
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.OWNER]: [
    // Owner has all permissions
    ...Object.keys(PERMISSIONS) as Permission[],
  ],

  [ROLES.ADMIN]: [
    // Schedule management
    'schedule.create',
    'schedule.edit',
    'schedule.delete',
    'schedule.publish',
    'schedule.view',

    // Staff management
    'staff.create',
    'staff.edit',
    'staff.view',

    // Swap management
    'swap.approve',
    'swap.reject',
    'swap.request',
    'swap.view',

    // Assignment management
    'assignment.create',
    'assignment.edit',
    'assignment.lock',
    'assignment.view',

    // Attendance management
    'attendance.manage',
    'attendance.view',
    'attendance.clock',

    // Reports
    'report.create',
    'report.view',
    'report.export',

    // Settings (limited)
    'settings.manage',

    // Audit
    'audit.view',

    // User management
    'user.invite',
    'user.role.change',
  ],

  [ROLES.MANAGER]: [
    // Schedule viewing
    'schedule.view',

    // Staff viewing
    'staff.view',

    // Swap management
    'swap.approve',
    'swap.reject',
    'swap.request',
    'swap.view',

    // Assignment viewing
    'assignment.view',

    // Attendance
    'attendance.view',
    'attendance.clock',

    // Reports (limited)
    'report.view',
  ],

  [ROLES.MEMBER]: [
    // Limited schedule viewing
    'schedule.view.own',

    // Own profile
    'staff.view.own',

    // Own swaps
    'swap.request.own',
    'swap.view.own',

    // Own assignments
    'assignment.view.own',

    // Own attendance
    'attendance.view.own',
    'attendance.clock',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role];
  if (!rolePermissions) return false;

  // Check for wildcard permissions (owner has all)
  if (role === ROLES.OWNER) return true;

  return rolePermissions.includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role can perform an action on a resource
 */
export function canPerformAction(
  role: Role,
  action: string,
  resource: string,
  isOwn: boolean = false
): boolean {
  // Build permission string
  const permission = `${resource}.${action}` as Permission;
  const ownPermission = `${resource}.${action}.own` as Permission;

  // Check if user has general permission or own-resource permission
  if (hasPermission(role, permission)) return true;
  if (isOwn && hasPermission(role, ownPermission)) return true;

  return false;
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: Role): string {
  const displayNames: Record<Role, string> = {
    [ROLES.OWNER]: 'Owner',
    [ROLES.ADMIN]: 'Administrator',
    [ROLES.MANAGER]: 'Manager',
    [ROLES.MEMBER]: 'Member',
  };

  return displayNames[role] || role;
}

/**
 * Get role hierarchy level (higher number = more permissions)
 */
export function getRoleLevel(role: Role): number {
  const levels: Record<Role, number> = {
    [ROLES.OWNER]: 4,
    [ROLES.ADMIN]: 3,
    [ROLES.MANAGER]: 2,
    [ROLES.MEMBER]: 1,
  };

  return levels[role] || 0;
}

/**
 * Check if one role is superior to another
 */
export function isRoleSuperior(role1: Role, role2: Role): boolean {
  return getRoleLevel(role1) > getRoleLevel(role2);
}

/**
 * Check if roles are equal in hierarchy
 */
export function areRolesEqual(role1: Role, role2: Role): boolean {
  return getRoleLevel(role1) === getRoleLevel(role2);
}

/**
 * Pages accessible by each role
 */
export const ROLE_PAGES: Record<Role, string[]> = {
  [ROLES.OWNER]: [
    '/dashboard',
    '/schedule',
    '/department',
    '/config',
    '/requests',
    '/handoff',
    '/notifications',
    '/settings',
  ],
  [ROLES.ADMIN]: [
    '/dashboard',
    '/schedule',
    '/department',
    '/config',
    '/requests',
    '/handoff',
    '/notifications',
    '/settings',
  ],
  [ROLES.MANAGER]: [
    '/dashboard',
    '/schedule',
    '/department',
    '/config',
    '/requests',
    '/handoff',
    '/notifications',
    '/settings',
  ],
  [ROLES.MEMBER]: [
    '/dashboard',
    '/schedule',
    '/requests',
    '/handoff',
    '/notifications',
    '/settings',
  ],
};

/**
 * Navigation items for each role
 */
export const ROLE_NAVIGATION: Record<Role, Array<{
  href: string;
  label: string;
  icon?: string;
}>> = {
  [ROLES.OWNER]: [
    { href: '/dashboard', label: '대시보드' },
    { href: '/schedule', label: '스케줄' },
    { href: '/department', label: '부서 관리' },
    { href: '/config', label: '설정' },
    { href: '/requests', label: '요청사항' },
    { href: '/handoff', label: '인수인계' },
    { href: '/settings', label: '시스템 설정' },
  ],
  [ROLES.ADMIN]: [
    { href: '/dashboard', label: '대시보드' },
    { href: '/schedule', label: '스케줄' },
    { href: '/department', label: '부서 관리' },
    { href: '/config', label: '설정' },
    { href: '/requests', label: '요청사항' },
    { href: '/handoff', label: '인수인계' },
  ],
  [ROLES.MANAGER]: [
    { href: '/dashboard', label: '대시보드' },
    { href: '/schedule', label: '스케줄' },
    { href: '/department', label: '부서 관리' },
    { href: '/config', label: '설정' },
    { href: '/requests', label: '요청사항' },
    { href: '/handoff', label: '인수인계' },
  ],
  [ROLES.MEMBER]: [
    { href: '/dashboard', label: '내 일정' },
    { href: '/schedule', label: '전체 스케줄' },
    { href: '/requests', label: '내 요청' },
    { href: '/handoff', label: '인수인계' },
  ],
};

/**
 * Check if a role can access a specific page
 */
export function canAccessPage(role: Role | undefined | null, path: string): boolean {
  if (!role) return false;

  // Remove query params and hash for comparison
  const cleanPath = path.split('?')[0].split('#')[0];

  // Check if the path starts with any allowed page
  const allowedPages = ROLE_PAGES[role] ?? [];
  return allowedPages.some(page => cleanPath.startsWith(page));
}

/**
 * Get navigation items for a role
 */
export function getNavigationForRole(role: Role | undefined | null) {
  if (!role) return [];
  return ROLE_NAVIGATION[role] ?? [];
}

/**
 * Check if user can view a specific department
 */
export function canViewDepartment(
  userRole: Role | undefined | null,
  userDepartmentId: string | undefined | null,
  targetDepartmentId: string
): boolean {
  if (!userRole) return false;

  // Owners and admins can view all departments
  if (userRole === ROLES.OWNER || userRole === ROLES.ADMIN) {
    return true;
  }

  // Managers can only view their own department
  if (userRole === ROLES.MANAGER) {
    return userDepartmentId === targetDepartmentId;
  }

  // Members don't have department viewing permissions
  return false;
}

/**
 * Get filtered users based on role permissions
 */
export function filterUsersByPermission(
  users: any[],
  currentUserRole: Role | undefined | null,
  currentUserDepartmentId: string | undefined | null
): any[] {
  if (!currentUserRole) return [];

  // Owners and admins see all users
  if (currentUserRole === ROLES.OWNER || currentUserRole === ROLES.ADMIN) {
    return users;
  }

  // Managers see only their department members
  if (currentUserRole === ROLES.MANAGER && currentUserDepartmentId) {
    return users.filter(user => user.departmentId === currentUserDepartmentId);
  }

  // Members don't see user list
  return [];
}