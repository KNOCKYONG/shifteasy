import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants, users, departments } from './tenants';

// Notifications table - stores all user notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // schedule_published, schedule_updated, swap_requested, etc.
  priority: text('priority').notNull(), // low, medium, high, urgent
  title: text('title').notNull(),
  message: text('message').notNull(),
  topic: text('topic'), // For topic-based notifications
  actionUrl: text('action_url'), // URL to navigate to when clicked
  data: jsonb('data'), // Additional notification data
  actions: jsonb('actions').$type<Array<{
    id: string;
    label: string;
    url?: string;
    action?: string;
    style?: 'primary' | 'secondary' | 'danger';
  }>>(), // Action buttons for notification
  readAt: timestamp('read_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  notifTenantIdx: index('notif_tenant_id_idx').on(table.tenantId),
  notifUserIdx: index('notif_user_id_idx').on(table.userId),
  notifTypeIdx: index('notif_type_idx').on(table.type),
  notifReadAtIdx: index('notif_read_at_idx').on(table.readAt),
  notifCreatedAtIdx: index('notif_created_at_idx').on(table.createdAt),
}));

// Push subscriptions table - stores web push notification subscriptions
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  pushSubUserIdx: index('push_sub_user_id_idx').on(table.userId),
  pushSubEndpointIdx: index('push_sub_endpoint_idx').on(table.endpoint),
}));
