import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '../trpc';
import { scopedDb, createAuditLog } from '@/lib/db-helpers';
import { schedules, users, departments, nursePreferences, offBalanceLedger } from '@/db/schema';
import { eq, and, gte, lte, desc, inArray, isNull, ne, or } from 'drizzle-orm';
import { db } from '@/db';

export const scheduleRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(),
      status: z.enum(['draft', 'published', 'archived']).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      limit: z.number().default(10),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const conditions = [
        eq(schedules.tenantId, tenantId),
        // Filter out soft-deleted schedules (deletedFlag != 'X' or null)
        or(
          isNull(schedules.deletedFlag),
          ne(schedules.deletedFlag, 'X')
        ),
      ];

      if (ctx.user?.role === 'member') {
        if (!ctx.user.departmentId) {
          return [];
        }
        conditions.push(eq(schedules.departmentId, ctx.user.departmentId));
        // Members can only see published schedules (not draft or archived)
        conditions.push(eq(schedules.status, 'published'));
      } else if (input.departmentId) {
        conditions.push(eq(schedules.departmentId, input.departmentId));
      }

      // Only apply status filter for non-members (admin/manager can filter by any status)
      if (input.status && ctx.user?.role !== 'member') {
        conditions.push(eq(schedules.status, input.status));
      }
      if (input.startDate) {
        conditions.push(gte(schedules.startDate, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(schedules.endDate, input.endDate));
      }

      // Get schedules
      const scheduleResults = await db
        .select()
        .from(schedules)
        .where(and(...conditions))
        .orderBy(desc(schedules.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Get unique department IDs
      const deptIds = [...new Set(scheduleResults.map(s => s.departmentId).filter(Boolean))] as string[];

      // Fetch department information separately
      const depts = deptIds.length > 0
        ? await db
            .select()
            .from(departments)
            .where(and(
              eq(departments.tenantId, tenantId),
              inArray(departments.id, deptIds)
            ))
        : [];

      // Create department map
      const deptMap = new Map(depts.map(d => [d.id, d]));

      // Combine results
      return scheduleResults.map(schedule => ({
        ...schedule,
        department: schedule.departmentId && deptMap.has(schedule.departmentId)
          ? {
              id: deptMap.get(schedule.departmentId)!.id,
              name: deptMap.get(schedule.departmentId)!.name,
              code: deptMap.get(schedule.departmentId)!.code,
            }
          : null,
      }));
    }),

  get: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const [schedule] = await db
        .select()
        .from(schedules)
        .where(and(
          eq(schedules.id, input.id),
          eq(schedules.tenantId, tenantId),
          // Filter out soft-deleted schedules (deletedFlag != 'X' or null)
          or(
            isNull(schedules.deletedFlag),
            ne(schedules.deletedFlag, 'X')
          )
        ));

      if (!schedule) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });
      }

      if (ctx.user?.role === 'member') {
        if (!ctx.user.departmentId || schedule.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '본인 부서의 스케줄만 조회할 수 있습니다.',
          });
        }
        // Members can only see published schedules
        if (schedule.status !== 'published') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '확정된 스케줄만 조회할 수 있습니다.',
          });
        }
      }

      return schedule;
    }),

  generate: protectedProcedure
    .input(z.object({
      name: z.string(),
      departmentId: z.string().optional(),
      patternId: z.string().optional(),
      startDate: z.date(),
      endDate: z.date(),
      constraints: z.object({
        minStaffPerShift: z.number().optional(),
        maxConsecutiveDays: z.number().optional(),
        minRestBetweenShifts: z.number().optional(),
        fairnessWeight: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      // Check permissions: manager can only generate schedules for their department
      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '부서 정보가 없습니다.',
          });
        }
        if (input.departmentId && input.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 생성할 수 있습니다.',
          });
        }
        // Force departmentId to be the manager's department
        input.departmentId = ctx.user.departmentId;
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 생성할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      // TODO: Implement scheduling algorithm
      // For now, create a draft schedule
      const [schedule] = await db.insert(schedules, {
        name: input.name,
        departmentId: input.departmentId,
        patternId: input.patternId,
        startDate: input.startDate,
        endDate: input.endDate,
        status: 'draft',
        metadata: {
          generatedBy: (ctx.user?.id || 'dev-user-id'),
          generationMethod: 'manual',
          constraints: input.constraints,
        },
      });

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'schedule.generated',
        entityType: 'schedule',
        entityId: schedule.id,
        after: schedule,
      });

      return schedule;
    }),

  publish: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      const [schedule] = await db.query(schedules, eq(schedules.id, input.id));

      if (!schedule) {
        throw new Error('Schedule not found');
      }

      // Check permissions: manager can only publish schedules for their department
      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId || schedule.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 확정할 수 있습니다.',
          });
        }
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 확정할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      const [updated] = await db.update(
        schedules,
        {
          status: 'published',
          publishedAt: new Date(),
          publishedBy: (ctx.user?.id || 'dev-user-id'),
        },
        eq(schedules.id, input.id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'schedule.published',
        entityType: 'schedule',
        entityId: schedule.id,
        before: schedule,
        after: updated,
      });

      // Calculate off-balance for all employees
      try {
        const tenantId = (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d');

        // Get schedule assignments from metadata
        const assignments = (schedule.metadata as any)?.assignments || [];

        if (assignments.length > 0) {
          // Get all unique employee IDs from assignments
          const employeeIds = [...new Set(assignments.map((a: any) => a.employeeId as string))] as string[];

          // Get nurse preferences for all employees
          const employeePreferences = await db.query(
            nursePreferences,
            and(
              eq(nursePreferences.tenantId, tenantId),
              inArray(nursePreferences.nurseId, employeeIds)
            )
          );

          // Create a map for quick lookup
          const preferencesMap = new Map(
            employeePreferences.map(p => [p.nurseId, p])
          );

          // Calculate period boundaries
          const periodStart = schedule.startDate;
          const periodEnd = schedule.endDate;
          const year = periodStart.getFullYear();
          const month = periodStart.getMonth() + 1;

          // Process each employee
          const offBalanceRecords = [];

          for (const employeeId of employeeIds) {
            // Count actual OFF days assigned to this employee (using shift code instead of ID)
            const employeeAssignments = assignments.filter((a: any) => a.employeeId === employeeId);
            const actualOffDays = employeeAssignments.filter((a: any) =>
              a.shiftType === 'O' || a.shiftType === 'OFF'
            ).length;

            // Calculate guaranteed OFF days for this specific month
            // TODO: Implement dynamic calculation based on work pattern, holidays, weekends
            // For now, use a default value of 8 days
            const guaranteedOffDays = 8;

            // Calculate remaining OFF days
            const remainingOffDays = guaranteedOffDays - actualOffDays;

            // Only create ledger record and update balance if there are remaining OFF days
            if (remainingOffDays > 0) {
              offBalanceRecords.push({
                tenantId,
                nurseId: employeeId,
                year,
                month,
                periodStart,
                periodEnd,
                guaranteedOffDays,
                actualOffDays,
                remainingOffDays,
                compensationType: null, // Will be determined by user allocation
                status: 'pending',
                scheduleId: schedule.id,
              });

              // Automatically add remaining OFF days to accumulated balance
              // User will later allocate between accumulation and allowance
              const preferences = preferencesMap.get(employeeId);
              const currentBalance = preferences?.accumulatedOffDays || 0;

              await db.update(
                nursePreferences,
                {
                  accumulatedOffDays: currentBalance + remainingOffDays,
                  updatedAt: new Date(),
                },
                and(
                  eq(nursePreferences.nurseId, employeeId),
                  eq(nursePreferences.tenantId, tenantId)
                )
              );
            }
          }

          // Bulk insert off-balance ledger records
          if (offBalanceRecords.length > 0) {
            await db.insert(offBalanceLedger, offBalanceRecords);
          }
        }
      } catch (error) {
        console.error('Error calculating off-balance:', error);
        // Don't fail the publish if off-balance calculation fails
      }

      // TODO: Send notifications to affected users

      return updated;
    }),

  archive: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = scopedDb((ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'));

      // Get schedule to check permissions
      const [schedule] = await db.query(schedules, eq(schedules.id, input.id));

      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      // Check permissions: manager can only archive schedules for their department
      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId || schedule.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 관리할 수 있습니다.',
          });
        }
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 아카이브할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      const [updated] = await db.update(
        schedules,
        {
          status: 'archived',
        },
        eq(schedules.id, input.id)
      );

      await createAuditLog({
        tenantId: (ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d'),
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'schedule.archived',
        entityType: 'schedule',
        entityId: input.id,
        after: updated,
      });

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get schedule to check permissions
      const [schedule] = await db
        .select()
        .from(schedules)
        .where(and(
          eq(schedules.id, input.id),
          eq(schedules.tenantId, tenantId)
        ));

      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      // Check permissions: manager can only delete schedules for their department
      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId || schedule.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 삭제할 수 있습니다.',
          });
        }
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 삭제할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      // Soft delete: set deletedFlag to 'X'
      await db
        .update(schedules)
        .set({
          deletedFlag: 'X',
          updatedAt: new Date()
        })
        .where(and(
          eq(schedules.id, input.id),
          eq(schedules.tenantId, tenantId)
        ));

      await createAuditLog({
        tenantId: tenantId,
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'schedule.deleted',
        entityType: 'schedule',
        entityId: input.id,
        before: schedule,
      });

      return { success: true };
    }),

  // Check for existing published schedules in a date range
  checkExisting: protectedProcedure
    .input(z.object({
      departmentId: z.string(),
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Check for published schedules that overlap with the requested date range
      const existingSchedules = await db
        .select({
          id: schedules.id,
          startDate: schedules.startDate,
          endDate: schedules.endDate,
          version: schedules.version,
          publishedAt: schedules.publishedAt,
          publishedBy: schedules.publishedBy,
          metadata: schedules.metadata,
        })
        .from(schedules)
        .where(and(
          eq(schedules.tenantId, tenantId),
          eq(schedules.departmentId, input.departmentId),
          eq(schedules.status, 'published'),
          or(
            isNull(schedules.deletedFlag),
            ne(schedules.deletedFlag, 'X')
          ),
          // Check for overlap: schedule.startDate <= input.endDate AND schedule.endDate >= input.startDate
          lte(schedules.startDate, input.endDate),
          gte(schedules.endDate, input.startDate)
        ))
        .orderBy(desc(schedules.publishedAt));

      return {
        hasExisting: existingSchedules.length > 0,
        schedules: existingSchedules,
      };
    }),

  // Increment schedule version (used for swaps and updates)
  incrementVersion: protectedProcedure
    .input(z.object({
      scheduleId: z.string(),
      reason: z.string(),
      changes: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get current schedule
      const [currentSchedule] = await db
        .select()
        .from(schedules)
        .where(and(
          eq(schedules.id, input.scheduleId),
          eq(schedules.tenantId, tenantId),
          or(
            isNull(schedules.deletedFlag),
            ne(schedules.deletedFlag, 'X')
          )
        ));

      if (!currentSchedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      const newVersion = currentSchedule.version + 1;
      const versionHistory = (currentSchedule.metadata as any)?.versionHistory || [];

      // Add to version history
      versionHistory.push({
        version: newVersion,
        updatedAt: new Date().toISOString(),
        updatedBy: ctx.user?.id || 'dev-user-id',
        reason: input.reason,
        changes: input.changes,
      });

      // Update schedule with new version
      const [updated] = await db
        .update(schedules)
        .set({
          version: newVersion,
          metadata: {
            ...currentSchedule.metadata as any,
            versionHistory,
          },
          updatedAt: new Date(),
        })
        .where(and(
          eq(schedules.id, input.scheduleId),
          eq(schedules.tenantId, tenantId)
        ))
        .returning();

      await createAuditLog({
        tenantId: tenantId,
        actorId: (ctx.user?.id || 'dev-user-id'),
        action: 'schedule.version_updated',
        entityType: 'schedule',
        entityId: input.scheduleId,
        before: currentSchedule,
        after: updated,
      });

      return updated;
    }),
});
