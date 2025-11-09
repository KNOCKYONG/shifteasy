import { pgTable, text, timestamp, uuid, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants, departments, users } from './tenants';

export const handoffs = pgTable(
  'handoffs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    shiftDate: timestamp('shift_date', { withTimezone: true }).notNull(),
    shiftType: text('shift_type').notNull(),
    handoverUserId: uuid('handover_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    receiverUserId: uuid('receiver_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull().default('draft'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    duration: integer('duration'),
    overallNotes: text('overall_notes'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('handoffs_tenant_id_idx').on(table.tenantId),
    departmentIdIdx: index('handoffs_department_id_idx').on(table.departmentId),
    shiftDateIdx: index('handoffs_shift_date_idx').on(table.shiftDate),
    statusIdx: index('handoffs_status_idx').on(table.status),
    handoverUserIdIdx: index('handoffs_handover_user_id_idx').on(table.handoverUserId),
    receiverUserIdIdx: index('handoffs_receiver_user_id_idx').on(table.receiverUserId),
  })
);

export const handoffItems = pgTable(
  'handoff_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    handoffId: uuid('handoff_id')
      .notNull()
      .references(() => handoffs.id, { onDelete: 'cascade' }),
    patientIdentifier: text('patient_identifier').notNull(),
    roomNumber: text('room_number').notNull(),
    bedNumber: text('bed_number'),
    priority: text('priority').notNull().default('medium'),
    situation: text('situation').notNull(),
    background: text('background').notNull(),
    assessment: text('assessment').notNull(),
    recommendation: text('recommendation').notNull(),
    vitalSigns: jsonb('vital_signs'),
    medications: jsonb('medications'),
    scheduledProcedures: jsonb('scheduled_procedures'),
    alerts: jsonb('alerts'),
    status: text('status').notNull().default('pending'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    questions: jsonb('questions'),
    attachments: jsonb('attachments'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    handoffIdIdx: index('handoff_items_handoff_id_idx').on(table.handoffId),
    priorityIdx: index('handoff_items_priority_idx').on(table.priority),
    statusIdx: index('handoff_items_status_idx').on(table.status),
    roomNumberIdx: index('handoff_items_room_number_idx').on(table.roomNumber),
  })
);

export const handoffTemplates = pgTable(
  'handoff_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id').references(() => departments.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    description: text('description'),
    isDefault: text('is_default').notNull().default('false'),
    category: text('category'),
    config: jsonb('config'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('handoff_templates_tenant_id_idx').on(table.tenantId),
    departmentIdIdx: index('handoff_templates_department_id_idx').on(table.departmentId),
    isDefaultIdx: index('handoff_templates_is_default_idx').on(table.isDefault),
  })
);
