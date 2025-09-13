import { db } from '@/db';
import { auditLogs } from '@/db/schema';

export interface AuditLogEntry {
  tenantId: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: any;
  after?: any;
  metadata?: {
    ip?: string;
    userAgent?: string;
    requestId?: string;
    url?: string;
    method?: string;
    [key: string]: any;
  };
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry) {
  try {
    const [log] = await db
      .insert(auditLogs)
      .values({
        tenantId: entry.tenantId,
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: entry.before,
        after: entry.after,
        metadata: entry.metadata,
      })
      .returning();

    return log;
  } catch (error) {
    // Log error but don't throw - audit logging should not break the main flow
    console.error('Failed to create audit log:', error);
    return null;
  }
}

/**
 * Batch create audit log entries
 */
export async function createAuditLogs(entries: AuditLogEntry[]) {
  try {
    const logs = await db
      .insert(auditLogs)
      .values(
        entries.map(entry => ({
          tenantId: entry.tenantId,
          actorId: entry.actorId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          before: entry.before,
          after: entry.after,
          metadata: entry.metadata,
        }))
      )
      .returning();

    return logs;
  } catch (error) {
    console.error('Failed to create audit logs:', error);
    return [];
  }
}

/**
 * Common audit log actions
 */
export const AUDIT_ACTIONS = {
  // Authentication
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_FAILED_LOGIN: 'auth.failed_login',
  AUTH_PASSWORD_RESET: 'auth.password_reset',
  AUTH_MFA_ENABLED: 'auth.mfa_enabled',
  AUTH_MFA_DISABLED: 'auth.mfa_disabled',

  // User management
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_INVITED: 'user.invited',
  USER_DEACTIVATED: 'user.deactivated',
  USER_REACTIVATED: 'user.reactivated',

  // Schedule operations
  SCHEDULE_CREATED: 'schedule.created',
  SCHEDULE_UPDATED: 'schedule.updated',
  SCHEDULE_DELETED: 'schedule.deleted',
  SCHEDULE_PUBLISHED: 'schedule.published',
  SCHEDULE_ARCHIVED: 'schedule.archived',
  SCHEDULE_GENERATED: 'schedule.generated',

  // Assignment operations
  ASSIGNMENT_CREATED: 'assignment.created',
  ASSIGNMENT_UPDATED: 'assignment.updated',
  ASSIGNMENT_DELETED: 'assignment.deleted',
  ASSIGNMENT_LOCKED: 'assignment.locked',
  ASSIGNMENT_UNLOCKED: 'assignment.unlocked',

  // Swap operations
  SWAP_REQUESTED: 'swap.requested',
  SWAP_ACCEPTED: 'swap.accepted',
  SWAP_REJECTED: 'swap.rejected',
  SWAP_APPROVED: 'swap.approved',
  SWAP_CANCELLED: 'swap.cancelled',

  // Attendance operations
  ATTENDANCE_CLOCK_IN: 'attendance.clock_in',
  ATTENDANCE_CLOCK_OUT: 'attendance.clock_out',
  ATTENDANCE_UPDATED: 'attendance.updated',

  // Settings operations
  SETTINGS_UPDATED: 'settings.updated',
  SETTINGS_BILLING_UPDATED: 'settings.billing_updated',
  SETTINGS_SECURITY_UPDATED: 'settings.security_updated',

  // Security events
  SECURITY_UNAUTHORIZED_ACCESS: 'security.unauthorized_access',
  SECURITY_RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
  SECURITY_SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',
  SECURITY_DATA_EXPORT: 'security.data_export',

  // API operations
  API_ACCESS: 'api.access',
  API_ERROR: 'api.error',
  API_RATE_LIMITED: 'api.rate_limited',
} as const;

/**
 * Helper to create a standardized audit log for API operations
 */
export async function auditApiOperation(
  ctx: {
    user?: { id: string };
    tenantId?: string;
    req?: {
      url?: string;
      method?: string;
      ip?: string;
      headers?: any;
    };
  },
  action: string,
  entityType: string,
  entityId?: string,
  data?: {
    before?: any;
    after?: any;
    metadata?: any;
  }
) {
  if (!ctx.tenantId) {
    return null;
  }

  return createAuditLog({
    tenantId: ctx.tenantId,
    actorId: ctx.user?.id,
    action,
    entityType,
    entityId,
    before: data?.before,
    after: data?.after,
    metadata: {
      ...data?.metadata,
      url: ctx.req?.url,
      method: ctx.req?.method,
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers?.['user-agent'],
    },
  });
}

/**
 * Helper to create audit log for data changes
 */
export async function auditDataChange(
  tenantId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  before: any,
  after: any,
  metadata?: any
) {
  // Filter out sensitive fields
  const sanitizeBefore = sanitizeData(before);
  const sanitizeAfter = sanitizeData(after);

  return createAuditLog({
    tenantId,
    actorId,
    action,
    entityType,
    entityId,
    before: sanitizeBefore,
    after: sanitizeAfter,
    metadata,
  });
}

/**
 * Sanitize sensitive data from audit logs
 */
function sanitizeData(data: any): any {
  if (!data) return data;

  const sensitiveFields = [
    'password',
    'passwordHash',
    'apiKey',
    'apiSecret',
    'token',
    'refreshToken',
    'secret',
    'privateKey',
    'creditCard',
    'cvv',
    'ssn',
  ];

  if (typeof data !== 'object') {
    return data;
  }

  const sanitized = { ...data };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}