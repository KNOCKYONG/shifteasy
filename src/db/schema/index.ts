// Core multi-tenant schema
export * from './tenants';
export * from './system';
export * from './notifications';

// Domain schemas
export * from './nurse-preferences';
export * from './team-patterns';
export * from './holidays';
export * from './special-requests';
export * from './tenant-configs';
export * from './teams';

// Alias for backward compatibility
export { auditLog as auditLogs } from './system';