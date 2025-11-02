import { pgTable, uuid, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Tenants table - Multi-tenant structure
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  secretCode: text('secret_code').unique().notNull(),
  plan: text('plan').notNull().default('free'), // free, pro, enterprise
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
  clerkUserId: text('clerk_user_id').unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('member'), // owner, admin, manager, member
  employeeId: text('employee_id'),
  position: text('position'),
  profile: jsonb('profile').$type<{
    phone?: string;
    avatar?: string;
    team?: string; // A, B, C, D 등 팀 구분
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
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
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
  departmentIdx: index('shift_types_department_id_idx').on(table.departmentId),
  codeIdx: index('shift_types_code_idx').on(table.code),
  tenantDeptCodeIdx: index('shift_types_tenant_dept_code_idx').on(table.tenantId, table.departmentId, table.code),
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

// Handoffs table (간호사 인수인계)
export const handoffs = pgTable('handoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }).notNull(),
  shiftDate: timestamp('shift_date', { withTimezone: true }).notNull(),
  shiftType: text('shift_type').notNull(), // D, E, N (주간, 저녁, 야간)
  handoverUserId: uuid('handover_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(), // 인계자
  receiverUserId: uuid('receiver_user_id').references(() => users.id, { onDelete: 'set null' }), // 인수자
  status: text('status').notNull().default('draft'), // draft, submitted, in_review, completed
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  duration: integer('duration'), // 소요 시간 (분)
  overallNotes: text('overall_notes'), // 전체 메모
  metadata: jsonb('metadata').$type<{
    totalPatients?: number;
    criticalCount?: number;
    highCount?: number;
    checklistCompleted?: boolean;
    checklist?: Array<{
      item: string;
      checked: boolean;
      checkedAt?: string;
    }>;
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('handoffs_tenant_id_idx').on(table.tenantId),
  departmentIdx: index('handoffs_department_id_idx').on(table.departmentId),
  shiftDateIdx: index('handoffs_shift_date_idx').on(table.shiftDate),
  statusIdx: index('handoffs_status_idx').on(table.status),
  handoverUserIdx: index('handoffs_handover_user_id_idx').on(table.handoverUserId),
  receiverUserIdx: index('handoffs_receiver_user_id_idx').on(table.receiverUserId),
}));

// Handoff items table (환자별 인수인계 항목)
export const handoffItems = pgTable('handoff_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  handoffId: uuid('handoff_id').references(() => handoffs.id, { onDelete: 'cascade' }).notNull(),
  patientIdentifier: text('patient_identifier').notNull(), // 환자 식별자
  roomNumber: text('room_number').notNull(), // 병실 번호
  bedNumber: text('bed_number'), // 침상 번호
  priority: text('priority').notNull().default('medium'), // critical, high, medium, low

  // SBAR (Situation, Background, Assessment, Recommendation)
  situation: text('situation').notNull(), // 현재 상황
  background: text('background').notNull(), // 배경 정보 (진단명, 입원일 등)
  assessment: text('assessment').notNull(), // 평가 (활력징후, 의식수준, 통증 등)
  recommendation: text('recommendation').notNull(), // 권고사항 (해야 할 일)

  // 세부 정보
  vitalSigns: jsonb('vital_signs').$type<{
    bloodPressure?: string; // 혈압
    heartRate?: number; // 심박수
    temperature?: number; // 체온
    respiratoryRate?: number; // 호흡수
    oxygenSaturation?: number; // 산소포화도
    consciousness?: string; // 의식수준
    painScore?: number; // 통증 점수 (0-10)
    recordedAt?: string;
  }>(),

  medications: jsonb('medications').$type<Array<{
    name: string;
    dose?: string;
    time: string;
    route: string; // 투약 경로 (PO, IV, IM 등)
    note?: string;
  }>>(),

  scheduledProcedures: jsonb('scheduled_procedures').$type<Array<{
    procedure: string;
    scheduledTime: string;
    preparation?: string;
    note?: string;
  }>>(),

  alerts: jsonb('alerts').$type<Array<{
    type: 'allergy' | 'fall_risk' | 'infection' | 'isolation' | 'dnr' | 'other';
    description: string;
    severity?: 'high' | 'medium' | 'low';
  }>>(),

  // 추적 및 협업
  status: text('status').notNull().default('pending'), // pending, reviewed, acknowledged
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  questions: jsonb('questions').$type<Array<{
    id: string;
    question: string;
    answer?: string;
    askedBy: string; // user id
    askedAt: string;
    answeredBy?: string;
    answeredAt?: string;
  }>>(),

  attachments: jsonb('attachments').$type<Array<{
    type: 'image' | 'document';
    url: string;
    description?: string;
    uploadedAt: string;
  }>>(),

  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  handoffIdx: index('handoff_items_handoff_id_idx').on(table.handoffId),
  priorityIdx: index('handoff_items_priority_idx').on(table.priority),
  statusIdx: index('handoff_items_status_idx').on(table.status),
  roomIdx: index('handoff_items_room_number_idx').on(table.roomNumber),
}));

// Handoff templates table (인수인계 템플릿)
export const handoffTemplates = pgTable('handoff_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isDefault: text('is_default').notNull().default('false'),
  category: text('category'), // general, icu, er, ward 등
  config: jsonb('config').$type<{
    quickPhrases?: Array<{
      category: string;
      phrases: string[];
    }>;
    checklistItems?: string[];
    priorityGuidelines?: {
      critical: string;
      high: string;
      medium: string;
      low: string;
    };
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  tenantIdx: index('handoff_templates_tenant_id_idx').on(table.tenantId),
  departmentIdx: index('handoff_templates_department_id_idx').on(table.departmentId),
  isDefaultIdx: index('handoff_templates_is_default_idx').on(table.isDefault),
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
export type Handoff = typeof handoffs.$inferSelect;
export type NewHandoff = typeof handoffs.$inferInsert;
export type HandoffItem = typeof handoffItems.$inferSelect;
export type NewHandoffItem = typeof handoffItems.$inferInsert;
export type HandoffTemplate = typeof handoffTemplates.$inferSelect;
export type NewHandoffTemplate = typeof handoffTemplates.$inferInsert;
