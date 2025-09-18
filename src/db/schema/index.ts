// Core multi-tenant schema
export * from './tenants';
export * from './system';

// Domain schemas
export * from './shift-assignments';

// Legacy schemas (to be migrated)
export * from './hospitals';
export * from './wards';
export * from './staff';
export * from './shifts';
export * from './schedules';
export * from './assignments';
export * from './preferences';
export * from './requests';

// Aliases for backward compatibility
export { wardAssignments as assignments } from './assignments';
export { auditLog as auditLogs } from './system';