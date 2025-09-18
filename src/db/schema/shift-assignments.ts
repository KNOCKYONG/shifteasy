import { pgTable, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const shiftAssignments = pgTable('shift_assignments', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  shiftId: varchar('shift_id', { length: 255 }).notNull(),
  date: timestamp('date').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  status: varchar('status', { length: 50 }).default('scheduled'),
  notes: jsonb('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type ShiftAssignment = typeof shiftAssignments.$inferSelect;
export type NewShiftAssignment = typeof shiftAssignments.$inferInsert;