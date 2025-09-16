import { pgTable, uuid, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Tenants table - Multi-tenant structure
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  secretCode: text('secret_code').unique().notNull(),
  plan: text('plan').notNull().default('free'), // free, pro, enterprise
  billingInfo: jsonb('billing_info').$type<{
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodEnd?: string;
    paymentMethodId?: string;
  }>(),
  settings: jsonb('settings').$type<{
    timezone?: string;
    locale?: string;
    maxUsers?: number;
    maxDepartments?: number;
    features?: string[];
    signupEnabled?: boolean;
  }>().default({
    timezone: 'Asia/Seoul',
    locale: 'ko',
    maxUsers: 10,
    maxDepartments: 3,
    features: [],
    signupEnabled: true
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  slugIdx: index('tenants_slug_idx').on(table.slug),
  secretCodeIdx: index('tenants_secret_code_idx').on(table.secretCode),
}));

// Departments table
export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  settings: jsonb('settings').$type<{
    minStaff?: number;
    maxStaff?: number;
    requiredRoles?: string[];
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  tenantIdx: index('departments_tenant_id_idx').on(table.tenantId),
}));

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
  clerkUserId: text('clerk_user_id').unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('member'), // owner, admin, manager, member
  employeeId: text('employee_id'),
  position: text('position'),
  profile: jsonb('profile').$type<{
    phone?: string;
    avatar?: string;
    skills?: string[];
    certifications?: string[];
    preferences?: {
      preferredShifts?: string[];
      unavailableDates?: string[];
      maxHoursPerWeek?: number;
      minHoursPerWeek?: number;
    };
  }>(),
  status: text('status').notNull().default('active'), // active, inactive, on_leave
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  tenantIdx: index('users_tenant_id_idx').on(table.tenantId),
  emailIdx: index('users_email_idx').on(table.email),
  clerkUserIdx: index('users_clerk_user_id_idx').on(table.clerkUserId),
  departmentIdx: index('users_department_id_idx').on(table.departmentId),
}));

// Shift Types table
export const shiftTypes = pgTable('shift_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  code: text('code').notNull(), // D, E, N, O
  name: text('name').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  duration: integer('duration').notNull(), // in minutes
  color: text('color').notNull(),
  breakMinutes: integer('break_minutes').default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('shift_types_tenant_id_idx').on(table.tenantId),
  codeIdx: index('shift_types_code_idx').on(table.code),
}));

// Patterns table (for recurring schedules)
export const patterns = pgTable('patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pattern: jsonb('pattern').$type<{
    cycle: number; // days in cycle
    shifts: Record<string, string[]>; // { day: [shiftTypeIds] }
  }>().notNull(),
  isActive: text('is_active').notNull().default('true'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('patterns_tenant_id_idx').on(table.tenantId),
}));

// Schedules table
export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }).notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('draft'), // draft, published, archived
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publishedBy: uuid('published_by').references(() => users.id),
  metadata: jsonb('metadata').$type<{
    notes?: string;
    constraints?: any;
    stats?: {
      totalShifts?: number;
      averageHours?: number;
      coverage?: Record<string, number>;
    };
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('schedules_tenant_id_idx').on(table.tenantId),
  departmentIdx: index('schedules_department_id_idx').on(table.departmentId),
  dateRangeIdx: index('schedules_date_range_idx').on(table.startDate, table.endDate),
  statusIdx: index('schedules_status_idx').on(table.status),
}));

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  departments: many(departments),
  users: many(users),
  shiftTypes: many(shiftTypes),
  patterns: many(patterns),
  schedules: many(schedules),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [departments.tenantId],
    references: [tenants.id],
  }),
  users: many(users),
  schedules: many(schedules),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  publishedSchedules: many(schedules),
}));

export const shiftTypesRelations = relations(shiftTypes, ({ one }) => ({
  tenant: one(tenants, {
    fields: [shiftTypes.tenantId],
    references: [tenants.id],
  }),
}));

export const patternsRelations = relations(patterns, ({ one }) => ({
  tenant: one(tenants, {
    fields: [patterns.tenantId],
    references: [tenants.id],
  }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [schedules.tenantId],
    references: [tenants.id],
  }),
  department: one(departments, {
    fields: [schedules.departmentId],
    references: [departments.id],
  }),
  publisher: one(users, {
    fields: [schedules.publishedBy],
    references: [users.id],
  }),
}));

// Notifications table
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'), // info, warning, error, success
  read: text('read').notNull().default('false'),
  metadata: jsonb('metadata').$type<any>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('notifications_tenant_id_idx').on(table.tenantId),
  userIdx: index('notifications_user_id_idx').on(table.userId),
  readIdx: index('notifications_read_idx').on(table.read),
}));

// Swap requests table
export const swapRequests = pgTable('swap_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  requesterId: uuid('requester_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'cascade' }),
  originalShiftId: uuid('original_shift_id'),
  targetShiftId: uuid('target_shift_id'),
  date: timestamp('date', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('pending'), // pending, approved, rejected, cancelled
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('swap_requests_tenant_id_idx').on(table.tenantId),
  requesterIdx: index('swap_requests_requester_id_idx').on(table.requesterId),
  targetUserIdx: index('swap_requests_target_user_id_idx').on(table.targetUserId),
  statusIdx: index('swap_requests_status_idx').on(table.status),
  dateIdx: index('swap_requests_date_idx').on(table.date),
}));

// Attendance table
export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  checkIn: timestamp('check_in', { withTimezone: true }),
  checkOut: timestamp('check_out', { withTimezone: true }),
  status: text('status').notNull().default('absent'), // present, absent, late, early_leave
  shiftType: text('shift_type'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('attendance_tenant_id_idx').on(table.tenantId),
  userIdx: index('attendance_user_id_idx').on(table.userId),
  dateIdx: index('attendance_date_idx').on(table.date),
}));

// Push subscriptions table
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  endpoint: text('endpoint').notNull(),
  keys: jsonb('keys').$type<{ p256dh: string; auth: string }>().notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  userIdx: index('push_subscriptions_user_id_idx').on(table.userId),
  endpointIdx: index('push_subscriptions_endpoint_idx').on(table.endpoint),
}));

// Alias for backward compatibility
export { auditLog as auditLogs } from './system';

// Type exports
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ShiftType = typeof shiftTypes.$inferSelect;
export type NewShiftType = typeof shiftTypes.$inferInsert;
export type Pattern = typeof patterns.$inferSelect;
export type NewPattern = typeof patterns.$inferInsert;
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type SwapRequest = typeof swapRequests.$inferSelect;
export type NewSwapRequest = typeof swapRequests.$inferInsert;
export type Attendance = typeof attendance.$inferSelect;
export type NewAttendance = typeof attendance.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;