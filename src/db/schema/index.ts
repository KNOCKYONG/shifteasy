// Core multi-tenant schema
export * from './tenants';
export * from './system';

// Domain schemas
export * from './nurse-preferences';
export * from './department-patterns';
export * from './holidays';
export * from './special-requests';
export * from './configs';
export * from './teams';
export * from './handoffs';
export * from './payments';
export * from './consulting-requests';
export * from './community';

// Alias for backward compatibility
export { auditLog as auditLogs } from './system';
export { departmentPatterns as teamPatterns } from './department-patterns'; // Backward compatibility
