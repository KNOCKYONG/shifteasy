import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

// Consulting Requests table - For free consulting applications
export const consultingRequests = pgTable('consulting_requests', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Basic Information
  companyName: text('company_name').notNull(),
  contactName: text('contact_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  industry: text('industry').notNull(), // healthcare, manufacturing, service, retail, other
  teamSize: text('team_size').notNull(), // 1-10, 11-30, 31-50, 51+

  // Schedule Information
  currentMethod: text('current_method').notNull(), // excel, paper, software, other

  // Files metadata (stored in Supabase Storage)
  files: jsonb('files').$type<Array<{
    name: string;
    size: number;
    type: string;
    url: string;
    uploadedAt: string;
  }>>().notNull().default([]),

  // Detailed Information
  painPoints: text('pain_points').notNull(),
  specialRequirements: text('special_requirements').notNull(),
  additionalNotes: text('additional_notes'),

  // Status tracking
  status: text('status').notNull().default('pending'), // pending, reviewing, contacted, completed, rejected
  assignedTo: text('assigned_to'), // Admin user email or ID
  responseNotes: text('response_notes'), // Admin notes/response

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  contactedAt: timestamp('contacted_at', { withTimezone: true }), // When admin contacted the applicant
  completedAt: timestamp('completed_at', { withTimezone: true }), // When request was completed
}, (table) => ({
  emailIdx: index('consulting_requests_email_idx').on(table.email),
  statusIdx: index('consulting_requests_status_idx').on(table.status),
  createdAtIdx: index('consulting_requests_created_at_idx').on(table.createdAt),
}));

export type ConsultingRequest = typeof consultingRequests.$inferSelect;
export type NewConsultingRequest = typeof consultingRequests.$inferInsert;
