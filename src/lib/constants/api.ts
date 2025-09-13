/**
 * API-related constants
 */

// API endpoints
export const API_ENDPOINTS = {
  // Schedule
  SCHEDULE_GENERATE: '/api/schedule/generate',
  SCHEDULE_LIST: '/api/schedule',
  SCHEDULE_GET: (id: string) => `/api/schedule/${id}`,
  SCHEDULE_UPDATE: (id: string) => `/api/schedule/${id}`,
  SCHEDULE_DELETE: (id: string) => `/api/schedule/${id}`,

  // Staff
  STAFF_LIST: '/api/staff',
  STAFF_GET: (id: string) => `/api/staff/${id}`,
  STAFF_CREATE: '/api/staff',
  STAFF_UPDATE: (id: string) => `/api/staff/${id}`,
  STAFF_DELETE: (id: string) => `/api/staff/${id}`,

  // Swap
  SWAP_REQUEST: '/api/swap',
  SWAP_APPROVE: (id: string) => `/api/swap/${id}/approve`,
  SWAP_REJECT: (id: string) => `/api/swap/${id}/reject`,
  SWAP_LIST: '/api/swap',

  // SSE (Server-Sent Events)
  SSE_CONNECT: '/api/sse',

  // Auth
  AUTH_SIGNIN: '/api/auth/signin',
  AUTH_SIGNUP: '/api/auth/signup',
  AUTH_SIGNOUT: '/api/auth/signout',
  AUTH_VERIFY: '/api/auth/verify-secret-code',

  // User
  USER_ME: '/api/users/me',
  USER_LIST: '/api/users/list',
  USER_UPDATE: (id: string) => `/api/users/${id}`,
  USER_CHANGE_PASSWORD: '/api/users/change-password',
  USER_ROLE: (id: string) => `/api/users/${id}/role`,

  // Tenant
  TENANT_INFO: '/api/tenant/info',
  TENANT_REGENERATE_SECRET: '/api/tenant/regenerate-secret',

  // Admin
  ADMIN_TENANT: '/api/admin/tenant',
  ADMIN_TENANT_REGENERATE_CODE: '/api/admin/tenant/regenerate-code',
  ADMIN_TENANT_TOGGLE_SIGNUP: '/api/admin/tenant/toggle-signup',
} as const;

// HTTP methods
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
} as const;

// API response status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Request headers
export const REQUEST_HEADERS = {
  CONTENT_TYPE_JSON: { 'Content-Type': 'application/json' },
  CONTENT_TYPE_FORM: { 'Content-Type': 'application/x-www-form-urlencoded' },
  CONTENT_TYPE_MULTIPART: { 'Content-Type': 'multipart/form-data' },
} as const;

// API timeouts (ms)
export const API_TIMEOUTS = {
  DEFAULT: 30000,
  LONG_RUNNING: 60000,
  SSE: 120000,
} as const;