import { pgTable, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  secretCode: text('secret_code').unique().notNull(), // 테넌트별 고유 시크릿 코드
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
    signupEnabled?: boolean; // 가입 허용 여부
  }>().default({
    timezone: 'Asia/Seoul',
    locale: 'ko',
    maxUsers: 10,
    maxDepartments: 3,
    features: [],
    signupEnabled: true
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const tenantsRelations = relations(tenants, ({ many }) => ({
  departments: many(departments),
  users: many(users),
  shiftTypes: many(shiftTypes),
  patterns: many(patterns),
  schedules: many(schedules),
}));

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  settings: jsonb('settings').$type<{
    minStaff?: number;
    maxStaff?: number;
    requiredRoles?: string[];
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [departments.tenantId],
    references: [tenants.id],
  }),
  users: many(users),
  schedules: many(schedules),
}));

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  departmentId: uuid('department_id').references(() => departments.id),
  clerkUserId: text('clerk_user_id').unique().notNull(),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  assignments: many(assignments),
  swapRequestsAsRequester: many(swapRequests, { relationName: 'requester' }),
  swapRequestsAsTarget: many(swapRequests, { relationName: 'target' }),
  notifications: many(notifications),
  pushSubscriptions: many(pushSubscriptions),
}));

export const shiftTypes = pgTable('shift_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  code: text('code').notNull(), // D, E, N, O, etc.
  name: text('name').notNull(),
  startTime: text('start_time').notNull(), // HH:mm format
  endTime: text('end_time').notNull(), // HH:mm format
  duration: integer('duration').notNull(), // in minutes
  color: text('color').notNull(),
  breakMinutes: integer('break_minutes').default(0),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const shiftTypesRelations = relations(shiftTypes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [shiftTypes.tenantId],
    references: [tenants.id],
  }),
  assignments: many(assignments),
}));

export const patterns = pgTable('patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  sequence: jsonb('sequence').$type<string[]>().notNull(), // ['D', 'D', 'E', 'E', 'O', 'O']
  constraints: jsonb('constraints').$type<{
    maxConsecutiveDays?: number;
    minRestBetweenShifts?: number;
    maxHoursPerWeek?: number;
    requiredRestDaysPerWeek?: number;
  }>(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const patternsRelations = relations(patterns, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [patterns.tenantId],
    references: [tenants.id],
  }),
  schedules: many(schedules),
}));

export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  departmentId: uuid('department_id').references(() => departments.id),
  patternId: uuid('pattern_id').references(() => patterns.id),
  name: text('name').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: text('status').notNull().default('draft'), // draft, published, archived
  metadata: jsonb('metadata').$type<{
    generatedBy?: string;
    generationMethod?: string;
    constraints?: any;
    statistics?: {
      totalShifts?: number;
      totalHours?: number;
      fairnessScore?: number;
    };
  }>(),
  publishedAt: timestamp('published_at'),
  publishedBy: uuid('published_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [schedules.tenantId],
    references: [tenants.id],
  }),
  department: one(departments, {
    fields: [schedules.departmentId],
    references: [departments.id],
  }),
  pattern: one(patterns, {
    fields: [schedules.patternId],
    references: [patterns.id],
  }),
  publisher: one(users, {
    fields: [schedules.publishedBy],
    references: [users.id],
  }),
  assignments: many(assignments),
}));

export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduleId: uuid('schedule_id').references(() => schedules.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  shiftTypeId: uuid('shift_type_id').references(() => shiftTypes.id).notNull(),
  date: timestamp('date').notNull(),
  isLocked: boolean('is_locked').notNull().default(false),
  lockedBy: uuid('locked_by').references(() => users.id),
  lockedAt: timestamp('locked_at'),
  lockedReason: text('locked_reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  schedule: one(schedules, {
    fields: [assignments.scheduleId],
    references: [schedules.id],
  }),
  user: one(users, {
    fields: [assignments.userId],
    references: [users.id],
  }),
  shiftType: one(shiftTypes, {
    fields: [assignments.shiftTypeId],
    references: [shiftTypes.id],
  }),
  locker: one(users, {
    fields: [assignments.lockedBy],
    references: [users.id],
  }),
  swapRequests: many(swapRequests),
  attendance: one(attendance),
}));

export const swapRequests = pgTable('swap_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  requesterId: uuid('requester_id').references(() => users.id).notNull(),
  targetUserId: uuid('target_user_id').references(() => users.id),
  requesterAssignmentId: uuid('requester_assignment_id').references(() => assignments.id).notNull(),
  targetAssignmentId: uuid('target_assignment_id').references(() => assignments.id),
  status: text('status').notNull().default('pending'), // pending, accepted, rejected, approved, cancelled
  reason: text('reason'),
  requestMessage: text('request_message'),
  responseMessage: text('response_message'),
  respondedAt: timestamp('responded_at'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  approvalNotes: text('approval_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const swapRequestsRelations = relations(swapRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [swapRequests.tenantId],
    references: [tenants.id],
  }),
  requester: one(users, {
    fields: [swapRequests.requesterId],
    references: [users.id],
    relationName: 'requester',
  }),
  targetUser: one(users, {
    fields: [swapRequests.targetUserId],
    references: [users.id],
    relationName: 'target',
  }),
  requesterAssignment: one(assignments, {
    fields: [swapRequests.requesterAssignmentId],
    references: [assignments.id],
  }),
  targetAssignment: one(assignments, {
    fields: [swapRequests.targetAssignmentId],
    references: [assignments.id],
  }),
  approver: one(users, {
    fields: [swapRequests.approvedBy],
    references: [users.id],
  }),
}));

export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  assignmentId: uuid('assignment_id').references(() => assignments.id).notNull().unique(),
  clockInTime: timestamp('clock_in_time'),
  clockInLocation: jsonb('clock_in_location').$type<{
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  }>(),
  clockOutTime: timestamp('clock_out_time'),
  clockOutLocation: jsonb('clock_out_location').$type<{
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  }>(),
  status: text('status').notNull().default('not_started'), // not_started, in_progress, completed, absent, late
  notes: text('notes'),
  overtimeMinutes: integer('overtime_minutes').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const attendanceRelations = relations(attendance, ({ one }) => ({
  assignment: one(assignments, {
    fields: [attendance.assignmentId],
    references: [assignments.id],
  }),
}));

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // schedule_published, swap_requested, swap_approved, etc.
  title: text('title').notNull(),
  message: text('message').notNull(),
  payload: jsonb('payload').$type<any>(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  tenant: one(tenants, {
    fields: [notifications.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  endpoint: text('endpoint').notNull().unique(),
  keys: jsonb('keys').$type<{
    p256dh: string;
    auth: string;
  }>().notNull(),
  device: jsonb('device').$type<{
    browser?: string;
    os?: string;
    userAgent?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [pushSubscriptions.tenantId],
    references: [tenants.id],
  }),
}));

export const calendarLinks = pgTable('calendar_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  icsToken: text('ics_token').notNull().unique(),
  visibility: text('visibility').notNull().default('all'), // all, published, approved
  isActive: boolean('is_active').notNull().default(true),
  lastAccessedAt: timestamp('last_accessed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const calendarLinksRelations = relations(calendarLinks, ({ one }) => ({
  user: one(users, {
    fields: [calendarLinks.userId],
    references: [users.id],
  }),
}));

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  actorId: uuid('actor_id').references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  before: jsonb('before').$type<any>(),
  after: jsonb('after').$type<any>(),
  metadata: jsonb('metadata').$type<{
    ip?: string;
    userAgent?: string;
    requestId?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(),
  payload: jsonb('payload').$type<any>().notNull(),
  status: text('status').notNull().default('pending'), // pending, processing, completed, failed
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  error: text('error'),
  result: jsonb('result').$type<any>(),
  scheduledFor: timestamp('scheduled_for'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

import { boolean } from 'drizzle-orm/pg-core';