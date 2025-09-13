import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '@/server/trpc';
import { scopedDb, createAuditLog } from '@/lib/db-helpers';
import { attendance, assignments } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export const attendanceRouter = createTRPCRouter({
  clockIn: protectedProcedure
    .input(z.object({
      assignmentId: z.string(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb(ctx.tenantId!);

      // Check if assignment belongs to user
      const [assignment] = await db.query(assignments, eq(assignments.id, input.assignmentId));

      if (!assignment) {
        throw new Error('Assignment not found');
      }

      if (assignment.userId !== ctx.user!.id) {
        throw new Error('This assignment does not belong to you');
      }

      // Check if already clocked in
      const [existing] = await db.query(attendance, eq(attendance.assignmentId, input.assignmentId));

      let result;
      if (existing) {
        if (existing.clockInTime) {
          throw new Error('Already clocked in');
        }

        [result] = await db.update(
          attendance,
          {
            clockInTime: new Date(),
            clockInLocation: input.location,
            status: 'in_progress',
          },
          eq(attendance.id, existing.id)
        );
      } else {
        [result] = await db.insert(attendance, {
          assignmentId: input.assignmentId,
          clockInTime: new Date(),
          clockInLocation: input.location,
          status: 'in_progress',
        });
      }

      await createAuditLog({
        tenantId: ctx.tenantId!,
        actorId: ctx.user!.id,
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
      assignmentId: z.string(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number(),
      }).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb(ctx.tenantId!);

      const [existing] = await db.query(attendance, eq(attendance.assignmentId, input.assignmentId));

      if (!existing) {
        throw new Error('No clock-in record found');
      }

      if (!existing.clockInTime) {
        throw new Error('Must clock in first');
      }

      if (existing.clockOutTime) {
        throw new Error('Already clocked out');
      }

      const clockOutTime = new Date();
      const workDuration = clockOutTime.getTime() - existing.clockInTime.getTime();
      const overtimeMinutes = Math.max(0, Math.floor(workDuration / 60000) - 480); // Assuming 8 hour shift

      const [result] = await db.update(
        attendance,
        {
          clockOutTime,
          clockOutLocation: input.location,
          notes: input.notes,
          overtimeMinutes,
          status: 'completed',
        },
        eq(attendance.id, existing.id)
      );

      await createAuditLog({
        tenantId: ctx.tenantId!,
        actorId: ctx.user!.id,
        action: 'attendance.clock_out',
        entityType: 'attendance',
        entityId: existing.id,
        before: existing,
        after: result,
        metadata: { location: input.location, overtimeMinutes },
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
      const db = scopedDb(ctx.tenantId!);

      // Get all assignments in date range
      let assignmentConditions = [
        gte(assignments.date, input.startDate),
        lte(assignments.date, input.endDate),
      ];

      if (input.userId) {
        assignmentConditions.push(eq(assignments.userId, input.userId));
      }

      const assignmentResults = await db.query(assignments, and(...assignmentConditions));

      // Get attendance records for these assignments
      const assignmentIds = assignmentResults.map(a => a.id);
      const attendanceResults = await Promise.all(
        assignmentIds.map(id => db.query(attendance, eq(attendance.assignmentId, id)))
      );

      const attendanceMap = new Map();
      attendanceResults.flat().forEach(a => {
        attendanceMap.set(a.assignmentId, a);
      });

      // Calculate statistics
      const stats = {
        totalShifts: assignmentResults.length,
        completedShifts: 0,
        lateArrivals: 0,
        absences: 0,
        totalOvertimeMinutes: 0,
      };

      assignmentResults.forEach(assignment => {
        const record = attendanceMap.get(assignment.id);
        if (record) {
          if (record.status === 'completed') {
            stats.completedShifts++;
          }
          if (record.status === 'late') {
            stats.lateArrivals++;
          }
          stats.totalOvertimeMinutes += record.overtimeMinutes || 0;
        } else {
          if (assignment.date < new Date()) {
            stats.absences++;
          }
        }
      });

      return {
        stats,
        details: assignmentResults.map(a => ({
          assignment: a,
          attendance: attendanceMap.get(a.id),
        })),
      };
    }),
});