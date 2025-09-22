// Core multi-tenant schema
export * from './tenants';
export * from './system';

// Domain schemas
export * from './shift-assignments';

// Alias for backward compatibility
export { auditLog as auditLogs } from './system';