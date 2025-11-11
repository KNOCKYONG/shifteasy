/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { createAuditLog } from '@/lib/db-helpers';
import { handoffs, handoffItems, handoffTemplates, users } from '@/db/schema';
import { eq, and, desc, gte, lte, or, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { notificationService } from '@/lib/notifications/notification-service';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// Shift type labels for notifications
const SHIFT_TYPE_LABELS: Record<string, string> = {
  D: '주간',
  E: '저녁',
  N: '야간',
};

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

      // Send urgent notification for critical patients
      if (input.priority === 'critical' && handoff.receiverUserId) {
        await notificationService.sendToUser(
          tenantId,
          handoff.receiverUserId,
          {
            type: 'handoff_critical_patient',
            priority: 'urgent',
            title: '🚨 긴급 환자가 추가되었습니다',
            message: `${input.roomNumber}호 환자 - ${input.situation}. 즉시 확인이 필요합니다.`,
            actionUrl: `/handoff/${input.handoffId}?highlight=${item.id}`,
            departmentId: handoff.departmentId,
            data: {
              handoffId: input.handoffId,
              itemId: item.id,
              roomNumber: input.roomNumber,
              bedNumber: input.bedNumber,
              priority: input.priority,
              situation: input.situation,
            },
            actions: [
              {
                id: 'view',
                label: '긴급 확인',
                url: `/handoff/${input.handoffId}?highlight=${item.id}`,
                style: 'danger',
              },
            ],
          }
        );
      }

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

      // Send notification to receiver
      if (updated.receiverUserId) {
        const metadata = updated.metadata as any;
        const hasCritical = (metadata?.criticalCount || 0) > 0;
        const shiftDateStr = format(new Date(updated.shiftDate), 'yyyy년 M월 d일 (E)', { locale: ko });
        const shiftTypeLabel = SHIFT_TYPE_LABELS[updated.shiftType] || updated.shiftType;

        await notificationService.sendToUser(
          tenantId,
          updated.receiverUserId,
          {
            type: 'handoff_submitted',
            priority: hasCritical ? 'urgent' : 'high',
            title: '새로운 인수인계가 도착했습니다',
            message: `${shiftDateStr} ${shiftTypeLabel}근무 인수인계를 확인해주세요. 총 ${metadata?.totalPatients || 0}명${hasCritical ? ` (긴급 ${metadata.criticalCount}명)` : ''}`,
            actionUrl: `/handoff/${updated.id}`,
            departmentId: updated.departmentId,
            data: {
              handoffId: updated.id,
              shiftDate: updated.shiftDate,
              shiftType: updated.shiftType,
              totalPatients: metadata?.totalPatients,
              criticalCount: metadata?.criticalCount,
            },
            actions: [
              {
                id: 'view',
                label: '지금 확인하기',
                url: `/handoff/${updated.id}`,
                style: 'primary',
              },
            ],
          }
        );
      }

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

      // Send notification to handover user
      if (updated.handoverUserId) {
        const shiftDateStr = format(new Date(updated.shiftDate), 'yyyy년 M월 d일 (E)', { locale: ko });
        const shiftTypeLabel = SHIFT_TYPE_LABELS[updated.shiftType] || updated.shiftType;

        await notificationService.sendToUser(
          tenantId,
          updated.handoverUserId,
          {
            type: 'handoff_completed',
            priority: 'high',
            title: '인수인계가 완료되었습니다',
            message: `${shiftDateStr} ${shiftTypeLabel}근무 인수인계가 완료되었습니다. 소요 시간: ${duration}분`,
            actionUrl: `/handoff/${updated.id}`,
            departmentId: updated.departmentId,
            data: {
              handoffId: updated.id,
              duration,
              completedAt,
              shiftDate: updated.shiftDate,
              shiftType: updated.shiftType,
            },
            actions: [
              {
                id: 'view',
                label: '결과 보기',
                url: `/handoff/${updated.id}`,
                style: 'primary',
              },
            ],
          }
        );
      }

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

  // 인수인계 템플릿 목록 조회
  listTemplates: protectedProcedure
    .input(z.object({
      departmentId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const conditions = [eq(handoffTemplates.tenantId, tenantId)];

      if (input.departmentId) {
        conditions.push(
          or(
            eq(handoffTemplates.departmentId, input.departmentId),
            isNull(handoffTemplates.departmentId)
          ) as any
        );
      }

      const results = await db
        .select()
        .from(handoffTemplates)
        .where(and(...conditions))
        .orderBy(desc(handoffTemplates.isDefault), desc(handoffTemplates.createdAt));

      return results;
    }),

  // 템플릿 상세 조회
  getTemplate: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const [template] = await db
        .select()
        .from(handoffTemplates)
        .where(and(
          eq(handoffTemplates.id, input.id),
          eq(handoffTemplates.tenantId, tenantId)
        ));

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '템플릿을 찾을 수 없습니다.',
        });
      }

      return template;
    }),

  // 템플릿 생성
  createTemplate: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      departmentId: z.string().optional(),
      isDefault: z.boolean().default(false),
      category: z.string().optional(),
      config: z.object({
        fields: z.object({
          sbar: z.object({
            situation: z.object({ required: z.boolean(), enabled: z.boolean() }),
            background: z.object({ required: z.boolean(), enabled: z.boolean() }),
            assessment: z.object({ required: z.boolean(), enabled: z.boolean() }),
            recommendation: z.object({ required: z.boolean(), enabled: z.boolean() }),
          }),
          vitalSigns: z.object({
            enabled: z.boolean(),
            required: z.boolean(),
            fields: z.object({
              bloodPressure: z.object({ enabled: z.boolean() }).optional(),
              heartRate: z.object({ enabled: z.boolean() }).optional(),
              temperature: z.object({ enabled: z.boolean() }).optional(),
              respiratoryRate: z.object({ enabled: z.boolean() }).optional(),
              oxygenSaturation: z.object({ enabled: z.boolean() }).optional(),
              consciousness: z.object({ enabled: z.boolean() }).optional(),
              painScore: z.object({ enabled: z.boolean() }).optional(),
            }).optional(),
          }),
          medications: z.object({ enabled: z.boolean(), required: z.boolean() }),
          scheduledProcedures: z.object({ enabled: z.boolean(), required: z.boolean() }),
          alerts: z.object({ enabled: z.boolean(), required: z.boolean() }),
        }),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const userId = ctx.user?.id || 'dev-user-id';

      // If setting as default, unset other defaults for this department/tenant
      if (input.isDefault) {
        await db
          .update(handoffTemplates)
          .set({ isDefault: 'false' })
          .where(and(
            eq(handoffTemplates.tenantId, tenantId),
            input.departmentId
              ? eq(handoffTemplates.departmentId, input.departmentId)
              : isNull(handoffTemplates.departmentId)
          ));
      }

      const [template] = await db
        .insert(handoffTemplates)
        .values({
          tenantId,
          departmentId: input.departmentId,
          name: input.name,
          description: input.description,
          isDefault: input.isDefault ? 'true' : 'false',
          category: input.category,
          config: input.config as any,
        })
        .returning();

      await createAuditLog({
        tenantId,
        actorId: userId,
        action: 'handoff_template.created',
        entityType: 'handoff_template',
        entityId: template.id,
        after: template,
      });

      return template;
    }),

  // 템플릿 수정
  updateTemplate: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      isDefault: z.boolean().optional(),
      category: z.string().optional(),
      config: z.object({
        fields: z.object({
          sbar: z.object({
            situation: z.object({ required: z.boolean(), enabled: z.boolean() }),
            background: z.object({ required: z.boolean(), enabled: z.boolean() }),
            assessment: z.object({ required: z.boolean(), enabled: z.boolean() }),
            recommendation: z.object({ required: z.boolean(), enabled: z.boolean() }),
          }),
          vitalSigns: z.object({
            enabled: z.boolean(),
            required: z.boolean(),
            fields: z.object({
              bloodPressure: z.object({ enabled: z.boolean() }).optional(),
              heartRate: z.object({ enabled: z.boolean() }).optional(),
              temperature: z.object({ enabled: z.boolean() }).optional(),
              respiratoryRate: z.object({ enabled: z.boolean() }).optional(),
              oxygenSaturation: z.object({ enabled: z.boolean() }).optional(),
              consciousness: z.object({ enabled: z.boolean() }).optional(),
              painScore: z.object({ enabled: z.boolean() }).optional(),
            }).optional(),
          }),
          medications: z.object({ enabled: z.boolean(), required: z.boolean() }),
          scheduledProcedures: z.object({ enabled: z.boolean(), required: z.boolean() }),
          alerts: z.object({ enabled: z.boolean(), required: z.boolean() }),
        }),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const userId = ctx.user?.id || 'dev-user-id';

      const [existing] = await db
        .select()
        .from(handoffTemplates)
        .where(and(
          eq(handoffTemplates.id, input.id),
          eq(handoffTemplates.tenantId, tenantId)
        ));

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '템플릿을 찾을 수 없습니다.',
        });
      }

      // If setting as default, unset other defaults
      if (input.isDefault) {
        await db
          .update(handoffTemplates)
          .set({ isDefault: 'false' })
          .where(and(
            eq(handoffTemplates.tenantId, tenantId),
            existing.departmentId
              ? eq(handoffTemplates.departmentId, existing.departmentId)
              : isNull(handoffTemplates.departmentId)
          ));
      }

      const [updated] = await db
        .update(handoffTemplates)
        .set({
          name: input.name,
          description: input.description,
          isDefault: input.isDefault !== undefined ? (input.isDefault ? 'true' : 'false') : undefined,
          category: input.category,
          config: input.config as any,
          updatedAt: new Date(),
        })
        .where(eq(handoffTemplates.id, input.id))
        .returning();

      await createAuditLog({
        tenantId,
        actorId: userId,
        action: 'handoff_template.updated',
        entityType: 'handoff_template',
        entityId: input.id,
        before: existing,
        after: updated,
      });

      return updated;
    }),

  // 템플릿 삭제
  deleteTemplate: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const userId = ctx.user?.id || 'dev-user-id';

      const [existing] = await db
        .select()
        .from(handoffTemplates)
        .where(and(
          eq(handoffTemplates.id, input.id),
          eq(handoffTemplates.tenantId, tenantId)
        ));

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '템플릿을 찾을 수 없습니다.',
        });
      }

      await db
        .delete(handoffTemplates)
        .where(eq(handoffTemplates.id, input.id));

      await createAuditLog({
        tenantId,
        actorId: userId,
        action: 'handoff_template.deleted',
        entityType: 'handoff_template',
        entityId: input.id,
        before: existing,
      });

      return { success: true };
    }),
});
