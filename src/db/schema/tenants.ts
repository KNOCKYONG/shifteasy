/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { pgTable, uuid, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { teams } from './teams';

export const BILLING_STATUSES = ['inactive', 'trialing', 'active', 'past_due', 'canceled'] as const;
export type BillingStatus = typeof BILLING_STATUSES[number];

// Tenants table - Multi-tenant structure
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  secretCode: text('secret_code').unique().notNull(),
  plan: text('plan').notNull().default('free'), // free, pro, enterprise
  billingEmail: text('billing_email'),
  billingStatus: text('billing_status').$type<BillingStatus>().notNull().default('inactive'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  billingPeriodEnd: timestamp('billing_period_end', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  billingMetadata: jsonb('billing_metadata').$type<{
    lastEventId?: string;
    lastError?: string;
    planHistory?: Array<{
      plan: string;
      changedAt: string;
      reason?: string;
    }>;
    seatQuantity?: number;
    defaultPriceId?: string;
  }>().default({
    planHistory: [],
  }),
  settings: jsonb('settings').$type<{
    timezone?: string;
    locale?: string;
    maxUsers?: number;
    maxDepartments?: number;
    features?: string[];
    signupEnabled?: boolean;
    planExpiresAt?: string; // 플랜 만료일 (ISO 8601 형식)
    isGuestTrial?: boolean; // 게스트 체험판 여부
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
  billingStatusIdx: index('tenants_billing_status_idx').on(table.billingStatus),
}));

// Departments table
export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  code: text('code'),
  secretCode: text('secret_code').unique(),
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
  secretCodeIdx: index('departments_secret_code_idx').on(table.secretCode),
}));

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  teamId: uuid('team_id').references((): any => (require('./teams').teams).id, { onDelete: 'set null' }),
  clerkUserId: text('clerk_user_id').unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('member'), // owner, admin, manager, member
  employeeId: text('employee_id'),
  position: text('position'),
  profile: jsonb('profile').$type<{
    phone?: string;
    avatar?: string;
  }>(),
  notificationPreferences: jsonb('notification_preferences').$type<{
    enabled?: boolean; // 전체 알림 on/off
    channels?: {
      sse?: boolean; // 실시간 알림
      push?: boolean; // 푸시 알림
      email?: boolean; // 이메일 알림
    };
    types?: {
      handoff_submitted?: boolean;
      handoff_completed?: boolean;
      handoff_critical_patient?: boolean;
      handoff_reminder?: boolean;
      schedule_published?: boolean;
      schedule_updated?: boolean;
      swap_requested?: boolean;
      swap_approved?: boolean;
      swap_rejected?: boolean;
    };
    quietHours?: {
      enabled?: boolean;
      start?: string; // "22:00"
      end?: string; // "08:00"
    };
  }>().default({
    enabled: true,
    channels: { sse: true, push: false, email: false },
    types: {
      handoff_submitted: true,
      handoff_completed: true,
      handoff_critical_patient: true,
      handoff_reminder: true,
      schedule_published: true,
      schedule_updated: true,
      swap_requested: true,
      swap_approved: true,
      swap_rejected: true,
    },
    quietHours: { enabled: false, start: '22:00', end: '08:00' },
  }),
  status: text('status').notNull().default('active'), // active, inactive, on_leave
  // Career/Experience fields
  hireDate: timestamp('hire_date', { withTimezone: true }), // 입사일 (근속 년수 계산용)
  yearsOfService: integer('years_of_service').default(0), // 근속 년수 (경력)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  tenantIdx: index('users_tenant_id_idx').on(table.tenantId),
  emailIdx: index('users_email_idx').on(table.email),
  clerkUserIdx: index('users_clerk_user_id_idx').on(table.clerkUserId),
  departmentIdx: index('users_department_id_idx').on(table.departmentId),
  teamIdx: index('users_team_id_idx').on(table.teamId),
}));

// Schedules table
export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }).notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('draft'), // draft, published, archived
  version: integer('version').notNull().default(1), // Version starts at 1, increments on updates
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publishedBy: uuid('published_by').references(() => users.id),
  deletedFlag: text('deleted_flag'), // 'X' for soft deleted schedules
  metadata: jsonb('metadata').$type<{
    notes?: string;
    constraints?: any;
    stats?: {
      totalShifts?: number;
      averageHours?: number;
      coverage?: Record<string, number>;
    };
    confirmedAt?: string;
    confirmedBy?: string;
    approverNotes?: string;
    validationScore?: number;
    assignments?: any;
    offAccruals?: Array<{
      employeeId: string;
      extraOffDays: number;
      guaranteedOffDays: number;
      actualOffDays: number;
    }>;
    versionHistory?: Array<{
      version: number;
      updatedAt: string;
      updatedBy: string;
      reason: string;
      changes?: any;
    }>;
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('schedules_tenant_id_idx').on(table.tenantId),
  departmentIdx: index('schedules_department_id_idx').on(table.departmentId),
  dateRangeIdx: index('schedules_date_range_idx').on(table.startDate, table.endDate),
  statusIdx: index('schedules_status_idx').on(table.status),
  deletedFlagIdx: index('schedules_deleted_flag_idx').on(table.deletedFlag),
  versionIdx: index('schedules_version_idx').on(table.version),
}));

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  departments: many(departments),
  users: many(users),
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
  team: one(teams, {
    fields: [users.teamId],
    references: [teams.id],
  }),
  publishedSchedules: many(schedules),
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
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),

  // Core notification fields
  type: text('type').notNull().default('general'),
  // Notification types: schedule_published, schedule_updated, swap_requested, swap_approved,
  // swap_rejected, emergency_call, shift_reminder, general
  priority: text('priority').notNull().default('medium'), // low, medium, high, urgent
  title: text('title').notNull(),
  message: text('message').notNull(),

  // Optional fields
  topic: text('topic'), // For topic-based subscriptions (e.g., 'ward:123:emergency')
  actionUrl: text('action_url'), // URL to navigate when notification is clicked

  // Rich data storage
  data: jsonb('data').$type<any>(), // Additional notification data
  actions: jsonb('actions').$type<Array<{
    id: string;
    label: string;
    url?: string;
    action?: string;
    style?: 'primary' | 'secondary' | 'danger';
  }>>(), // Action buttons for notification

  // Status tracking
  readAt: timestamp('read_at', { withTimezone: true }), // When notification was read (null = unread)
  deliveredAt: timestamp('delivered_at', { withTimezone: true }), // When notification was delivered

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('notifications_tenant_id_idx').on(table.tenantId),
  departmentIdx: index('notifications_department_id_idx').on(table.departmentId),
  userIdx: index('notifications_user_id_idx').on(table.userId),
  typeIdx: index('notifications_type_idx').on(table.type),
  priorityIdx: index('notifications_priority_idx').on(table.priority),
  readAtIdx: index('notifications_read_at_idx').on(table.readAt),
  topicIdx: index('notifications_topic_idx').on(table.topic),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
}));

// Swap requests table
export const swapRequests = pgTable('swap_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }).notNull(),
  requesterId: uuid('requester_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'cascade' }),
  originalShiftId: text('original_shift_id'),
  targetShiftId: text('target_shift_id'),
  date: timestamp('date', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('pending'), // pending, approved, rejected, cancelled
  reason: text('reason'),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvalNotes: text('approval_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('swap_requests_tenant_id_idx').on(table.tenantId),
  departmentIdx: index('swap_requests_department_id_idx').on(table.departmentId),
  requesterIdx: index('swap_requests_requester_id_idx').on(table.requesterId),
  targetUserIdx: index('swap_requests_target_user_id_idx').on(table.targetUserId),
  statusIdx: index('swap_requests_status_idx').on(table.status),
  dateIdx: index('swap_requests_date_idx').on(table.date),
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
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type SwapRequest = typeof swapRequests.$inferSelect;
export type NewSwapRequest = typeof swapRequests.$inferInsert;
