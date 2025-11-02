import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { createAuditLog } from '@/lib/db-helpers';
import { handoffs, handoffItems, handoffTemplates, users } from '@/db/schema';
import { eq, and, desc, gte, lte, or, isNull } from 'drizzle-orm';
import { db } from '@/db';

// Zod schemas for validation
const vitalSignsSchema = z.object({
  bloodPressure: z.string().optional(),
  heartRate: z.number().optional(),
  temperature: z.number().optional(),
  respiratoryRate: z.number().optional(),
  oxygenSaturation: z.number().optional(),
  consciousness: z.string().optional(),
  painScore: z.number().min(0).max(10).optional(),
  recordedAt: z.string().optional(),
});

const medicationSchema = z.object({
  name: z.string(),
  dose: z.string().optional(),
  time: z.string(),
  route: z.string(),
  note: z.string().optional(),
});

const procedureSchema = z.object({
  procedure: z.string(),
  scheduledTime: z.string(),
  preparation: z.string().optional(),
  note: z.string().optional(),
});

const alertSchema = z.object({
  type: z.enum(['allergy', 'fall_risk', 'infection', 'isolation', 'dnr', 'other']),
  description: z.string(),
  severity: z.enum(['high', 'medium', 'low']).optional(),
});

export const handoffRouter = createTRPCRouter({
  // 인수인계 목록 조회
  list: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(),
      shiftDate: z.date().optional(),
      status: z.enum(['draft', 'submitted', 'in_review', 'completed']).optional(),
      isHandover: z.boolean().optional(), // 내가 인계자인 경우
      isReceiver: z.boolean().optional(), // 내가 인수자인 경우
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const userId = ctx.user?.id || 'dev-user-id';

      const conditions = [eq(handoffs.tenantId, tenantId)];

      if (input.departmentId) {
        conditions.push(eq(handoffs.departmentId, input.departmentId));
      }

      if (input.shiftDate) {
        conditions.push(eq(handoffs.shiftDate, input.shiftDate));
      }

      if (input.status) {
        conditions.push(eq(handoffs.status, input.status));
      }

      if (input.isHandover) {
        conditions.push(eq(handoffs.handoverUserId, userId));
      }

      if (input.isReceiver) {
        conditions.push(eq(handoffs.receiverUserId, userId));
      }

      const results = await db
        .select()
        .from(handoffs)
        .where(and(...conditions))
        .orderBy(desc(handoffs.shiftDate))
        .limit(input.limit)
        .offset(input.offset);

      return results;
    }),

  // 인수인계 상세 조회 (환자 목록 포함)
  get: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const [handoff] = await db
        .select()
        .from(handoffs)
        .where(and(
          eq(handoffs.id, input.id),
          eq(handoffs.tenantId, tenantId)
        ));

      if (!handoff) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '인수인계를 찾을 수 없습니다.',
        });
      }

      // 환자 목록 조회 (우선순위 순)
      const items = await db
        .select()
        .from(handoffItems)
        .where(eq(handoffItems.handoffId, input.id))
        .orderBy(
          // Critical > High > Medium > Low 순서로 정렬
          handoffItems.priority,
          handoffItems.sortOrder
        );

      return {
        ...handoff,
        items,
      };
    }),

  // 인수인계 생성
  create: protectedProcedure
    .input(z.object({
      departmentId: z.string(),
      shiftDate: z.date(),
      shiftType: z.enum(['D', 'E', 'N']),
      receiverUserId: z.string().optional(),
      overallNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const userId = ctx.user?.id || 'dev-user-id';

      const [handoff] = await db
        .insert(handoffs)
        .values({
          tenantId,
          departmentId: input.departmentId,
          shiftDate: input.shiftDate,
          shiftType: input.shiftType,
          handoverUserId: userId,
          receiverUserId: input.receiverUserId,
          overallNotes: input.overallNotes,
          status: 'draft',
        })
        .returning();

      await createAuditLog({
        tenantId,
        actorId: userId,
        action: 'handoff.created',
        entityType: 'handoff',
        entityId: handoff.id,
        after: handoff,
      });

      return handoff;
    }),

  // 환자 항목 추가
  addItem: protectedProcedure
    .input(z.object({
      handoffId: z.string(),
      patientIdentifier: z.string(),
      roomNumber: z.string(),
      bedNumber: z.string().optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']),
      situation: z.string(),
      background: z.string(),
      assessment: z.string(),
      recommendation: z.string(),
      vitalSigns: vitalSignsSchema.optional(),
      medications: z.array(medicationSchema).optional(),
      scheduledProcedures: z.array(procedureSchema).optional(),
      alerts: z.array(alertSchema).optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Verify handoff exists and belongs to tenant
      const [handoff] = await db
        .select()
        .from(handoffs)
        .where(and(
          eq(handoffs.id, input.handoffId),
          eq(handoffs.tenantId, tenantId)
        ));

      if (!handoff) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '인수인계를 찾을 수 없습니다.',
        });
      }

      const [item] = await db
        .insert(handoffItems)
        .values({
          handoffId: input.handoffId,
          patientIdentifier: input.patientIdentifier,
          roomNumber: input.roomNumber,
          bedNumber: input.bedNumber,
          priority: input.priority,
          situation: input.situation,
          background: input.background,
          assessment: input.assessment,
          recommendation: input.recommendation,
          vitalSigns: input.vitalSigns,
          medications: input.medications,
          scheduledProcedures: input.scheduledProcedures,
          alerts: input.alerts,
          sortOrder: input.sortOrder || 0,
        })
        .returning();

      // Update metadata
      const currentMeta = handoff.metadata as any || {};
      const totalPatients = (currentMeta.totalPatients || 0) + 1;
      const criticalCount = input.priority === 'critical'
        ? (currentMeta.criticalCount || 0) + 1
        : (currentMeta.criticalCount || 0);
      const highCount = input.priority === 'high'
        ? (currentMeta.highCount || 0) + 1
        : (currentMeta.highCount || 0);

      await db
        .update(handoffs)
        .set({
          metadata: {
            ...currentMeta,
            totalPatients,
            criticalCount,
            highCount,
          },
        })
        .where(eq(handoffs.id, input.handoffId));

      return item;
    }),

  // 환자 항목 수정
  updateItem: protectedProcedure
    .input(z.object({
      id: z.string(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      situation: z.string().optional(),
      background: z.string().optional(),
      assessment: z.string().optional(),
      recommendation: z.string().optional(),
      vitalSigns: vitalSignsSchema.optional(),
      medications: z.array(medicationSchema).optional(),
      scheduledProcedures: z.array(procedureSchema).optional(),
      alerts: z.array(alertSchema).optional(),
      status: z.enum(['pending', 'reviewed', 'acknowledged']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [updated] = await db
        .update(handoffItems)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(handoffItems.id, id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '항목을 찾을 수 없습니다.',
        });
      }

      return updated;
    }),

  // 인수인계 제출 (인계자 → 인수자)
  submit: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const userId = ctx.user?.id || 'dev-user-id';

      const [handoff] = await db
        .select()
        .from(handoffs)
        .where(and(
          eq(handoffs.id, input.id),
          eq(handoffs.tenantId, tenantId)
        ));

      if (!handoff) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '인수인계를 찾을 수 없습니다.',
        });
      }

      if (handoff.handoverUserId !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '인계자만 제출할 수 있습니다.',
        });
      }

      const [updated] = await db
        .update(handoffs)
        .set({
          status: 'submitted',
          updatedAt: new Date(),
        })
        .where(eq(handoffs.id, input.id))
        .returning();

      await createAuditLog({
        tenantId,
        actorId: userId,
        action: 'handoff.submitted',
        entityType: 'handoff',
        entityId: input.id,
        before: handoff,
        after: updated,
      });

      return updated;
    }),

  // 인수인계 완료
  complete: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const userId = ctx.user?.id || 'dev-user-id';

      const [handoff] = await db
        .select()
        .from(handoffs)
        .where(and(
          eq(handoffs.id, input.id),
          eq(handoffs.tenantId, tenantId)
        ));

      if (!handoff) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '인수인계를 찾을 수 없습니다.',
        });
      }

      if (handoff.receiverUserId !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '인수자만 완료할 수 있습니다.',
        });
      }

      const completedAt = new Date();
      const duration = Math.floor((completedAt.getTime() - handoff.startedAt.getTime()) / 1000 / 60); // 분 단위

      const [updated] = await db
        .update(handoffs)
        .set({
          status: 'completed',
          completedAt,
          duration,
          updatedAt: completedAt,
        })
        .where(eq(handoffs.id, input.id))
        .returning();

      await createAuditLog({
        tenantId,
        actorId: userId,
        action: 'handoff.completed',
        entityType: 'handoff',
        entityId: input.id,
        before: handoff,
        after: updated,
      });

      return updated;
    }),

  // 질문 추가
  addQuestion: protectedProcedure
    .input(z.object({
      itemId: z.string(),
      question: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id || 'dev-user-id';

      const [item] = await db
        .select()
        .from(handoffItems)
        .where(eq(handoffItems.id, input.itemId));

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '항목을 찾을 수 없습니다.',
        });
      }

      const questions = (item.questions as any) || [];
      questions.push({
        id: crypto.randomUUID(),
        question: input.question,
        askedBy: userId,
        askedAt: new Date().toISOString(),
      });

      const [updated] = await db
        .update(handoffItems)
        .set({
          questions,
          updatedAt: new Date(),
        })
        .where(eq(handoffItems.id, input.itemId))
        .returning();

      return updated;
    }),

  // 질문 답변
  answerQuestion: protectedProcedure
    .input(z.object({
      itemId: z.string(),
      questionId: z.string(),
      answer: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id || 'dev-user-id';

      const [item] = await db
        .select()
        .from(handoffItems)
        .where(eq(handoffItems.id, input.itemId));

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '항목을 찾을 수 없습니다.',
        });
      }

      const questions = (item.questions as any) || [];
      const questionIndex = questions.findIndex((q: any) => q.id === input.questionId);

      if (questionIndex === -1) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '질문을 찾을 수 없습니다.',
        });
      }

      questions[questionIndex].answer = input.answer;
      questions[questionIndex].answeredBy = userId;
      questions[questionIndex].answeredAt = new Date().toISOString();

      const [updated] = await db
        .update(handoffItems)
        .set({
          questions,
          updatedAt: new Date(),
        })
        .where(eq(handoffItems.id, input.itemId))
        .returning();

      return updated;
    }),

  // 통계 조회
  stats: protectedProcedure
    .input(z.object({
      departmentId: z.string(),
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const results = await db
        .select()
        .from(handoffs)
        .where(and(
          eq(handoffs.tenantId, tenantId),
          eq(handoffs.departmentId, input.departmentId),
          gte(handoffs.shiftDate, input.startDate),
          lte(handoffs.shiftDate, input.endDate),
          eq(handoffs.status, 'completed')
        ));

      const totalHandoffs = results.length;
      const totalDuration = results.reduce((sum, h) => sum + (h.duration || 0), 0);
      const avgDuration = totalHandoffs > 0 ? Math.round(totalDuration / totalHandoffs) : 0;

      const totalPatients = results.reduce((sum, h) => {
        const meta = h.metadata as any;
        return sum + (meta?.totalPatients || 0);
      }, 0);

      const criticalPatients = results.reduce((sum, h) => {
        const meta = h.metadata as any;
        return sum + (meta?.criticalCount || 0);
      }, 0);

      return {
        totalHandoffs,
        avgDuration,
        totalPatients,
        avgPatientsPerHandoff: totalHandoffs > 0 ? Math.round(totalPatients / totalHandoffs) : 0,
        criticalPatients,
      };
    }),
});
