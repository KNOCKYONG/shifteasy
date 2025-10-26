// Core multi-tenant schema
export * from './tenants';
export * from './system';

// Domain schemas
export * from './shift-assignments';
export * from './nurse-skills';
export * from './nurse-preferences';
export * from './team-patterns';
export * from './holidays';
export * from './special-requests';

// Alias for backward compatibility
export { auditLog as auditLogs } from './system';