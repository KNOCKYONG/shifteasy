import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '@/server/trpc';
import { scopedDb, createAuditLog } from '@/lib/db-helpers';
import { attendance } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export const attendanceRouter = createTRPCRouter({
  clockIn: protectedProcedure
    .input(z.object({
      shiftType: z.string().optional(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      // Check if already clocked in for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existing = await db.query(
        attendance,
        and(
          eq(attendance.userId, ctx.user?.id || 'dev-user-id'),
          gte(attendance.date, today),
          lte(attendance.date, tomorrow)
        )
      );

      const existingRecord = existing[0];

      let result;
      if (existingRecord) {
        if (existingRecord.checkIn) {
          throw new Error('Already clocked in');
        }

        const updated = await db.update(
          attendance,
          {
            checkIn: new Date(),
            status: 'present',
            updatedAt: new Date(),
          },
          eq(attendance.id, existingRecord.id)
        );
        result = updated[0];
      } else {
        const inserted = await db.insert(attendance, {
          userId: ctx.user?.id || 'dev-user-id',
          date: new Date(),
          checkIn: new Date(),
          status: 'present',
          shiftType: input.shiftType || 'D',
        });
        result = inserted[0];
      }

      await createAuditLog({
        tenantId: (ctx.tenantId || 'dev-org-id'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'attendance.clock_in',
        entityType: 'attendance',
        entityId: result.id,
        after: result,
        metadata: { location: input.location },
      });

      return result;
    }),

  clockOut: protectedProcedure
    .input(z.object({
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number(),
      }).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      // Get today's attendance record
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existing = await db.query(
        attendance,
        and(
          eq(attendance.userId, ctx.user?.id || 'dev-user-id'),
          gte(attendance.date, today),
          lte(attendance.date, tomorrow)
        )
      );

      const existingRecord = existing[0];

      if (!existingRecord) {
        throw new Error('No clock-in record found');
      }

      if (!existingRecord.checkIn) {
        throw new Error('Must clock in first');
      }

      if (existingRecord.checkOut) {
        throw new Error('Already clocked out');
      }

      const updated = await db.update(
        attendance,
        {
          checkOut: new Date(),
          notes: input.notes,
          status: 'present',
          updatedAt: new Date(),
        },
        eq(attendance.id, existingRecord.id)
      );
      const result = updated[0];

      await createAuditLog({
        tenantId: (ctx.tenantId || 'dev-org-id'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'attendance.clock_out',
        entityType: 'attendance',
        entityId: result.id,
        before: existingRecord,
        after: result,
        metadata: { location: input.location, notes: input.notes },
      });

      return result;
    }),

  report: adminProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      departmentId: z.string().optional(),
      userId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || 'dev-org-id'));

      // Get all attendance records in date range
      let conditions = [
        gte(attendance.date, input.startDate),
        lte(attendance.date, input.endDate),
      ];

      if (input.userId) {
        conditions.push(eq(attendance.userId, input.userId));
      }

      const attendanceResults = await db.query(attendance, and(...conditions));

      // Calculate statistics
      const stats = {
        totalRecords: attendanceResults.length,
        presentCount: 0,
        absentCount: 0,
        lateArrivals: 0,
      };

      attendanceResults.forEach(record => {
        if (record.status === 'present') {
          stats.presentCount++;
        } else if (record.status === 'absent') {
          stats.absentCount++;
        } else if (record.status === 'late') {
          stats.lateArrivals++;
        }
      });

      return {
        stats,
        details: attendanceResults,
      };
    }),
});