export * from './tenants';
export * from './hospitals';
export * from './wards';
export * from './staff';
export * from './shifts';
export * from './schedules';
export * from './assignments';
export * from './requests';
export * from './preferences';
export * from './system';

// Aliases for backward compatibility
export { wardAssignments as assignments } from './assignments';
export { auditLog as auditLogs } from './system';