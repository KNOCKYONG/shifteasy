import { z } from 'zod';
import { eq, and, isNull, desc, asc, like, or } from 'drizzle-orm';
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  ownerProcedure,
} from '@/server/trpc-context';
import {
  tenants,
  departments,
  users,
  shiftTypes,
  type NewTenant,
  type NewDepartment,
  type NewUser,
  type NewShiftType,
} from '@/db/schema';
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
  settings: z.object({
    timezone: z.string().default('Asia/Seoul'),
    locale: z.string().default('ko'),
    maxUsers: z.number().int().positive().default(10),
    maxDepartments: z.number().int().positive().default(3),
    signupEnabled: z.boolean().default(true),
  }).optional(),
});

const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
  settings: z.object({
    minStaff: z.number().int().min(0).optional(),
    maxStaff: z.number().int().min(0).optional(),
    requiredRoles: z.array(z.string()).optional(),
  }).optional(),
});

const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['owner', 'admin', 'manager', 'member']).default('member'),
  departmentId: z.string().uuid().optional(),
  employeeId: z.string().max(50).optional(),
  position: z.string().max(100).optional(),
});

const createShiftTypeSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(50),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  breakMinutes: z.number().int().min(0).default(0),
  sortOrder: z.number().int().default(0),
});

export const tenantRouter = createTRPCRouter({
  // Public procedures
  checkSlugAvailability: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, input.slug))
        .limit(1);

      return { available: existing.length === 0 };
    }),

  // Protected procedures (authenticated users)
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No tenant associated with user',
      });
    }

    return ctx.tenant;
  }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No tenant associated with user',
      });
    }

    const [userCount] = await ctx.db
      .select({ count: users.id })
      .from(users)
      .where(and(
        eq(users.tenantId, ctx.tenantId),
        isNull(users.deletedAt)
      ));

    const [departmentCount] = await ctx.db
      .select({ count: departments.id })
      .from(departments)
      .where(and(
        eq(departments.tenantId, ctx.tenantId),
        isNull(departments.deletedAt)
      ));

    const [shiftTypeCount] = await ctx.db
      .select({ count: shiftTypes.id })
      .from(shiftTypes)
      .where(eq(shiftTypes.tenantId, ctx.tenantId));

    return {
      users: userCount?.count || 0,
      departments: departmentCount?.count || 0,
      shiftTypes: shiftTypeCount?.count || 0,
      plan: ctx.tenant?.plan || 'free',
      settings: ctx.tenant?.settings,
    };
  }),

  // Admin procedures
  update: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        settings: z.object({
          timezone: z.string().optional(),
          locale: z.string().optional(),
          maxUsers: z.number().int().positive().optional(),
          maxDepartments: z.number().int().positive().optional(),
          signupEnabled: z.boolean().optional(),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tenants)
        .set({
          ...(input.name && { name: input.name }),
          ...(input.settings && {
            settings: {
              ...ctx.tenant?.settings,
              ...input.settings,
            },
          }),
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, ctx.tenantId))
        .returning();

      return updated;
    }),

  // Department management
  departments: {
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          search: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        let query = ctx.db
          .select()
          .from(departments)
          .where(and(
            eq(departments.tenantId, ctx.tenantId),
            isNull(departments.deletedAt)
          ))
          .orderBy(asc(departments.name))
          .limit(input.limit)
          .offset(input.offset);

        if (input.search) {
          query = query.where(
            or(
              like(departments.name, `%${input.search}%`),
              like(departments.code, `%${input.search}%`)
            )
          );
        }

        const items = await query;

        const [totalResult] = await ctx.db
          .select({ count: departments.id })
          .from(departments)
          .where(and(
            eq(departments.tenantId, ctx.tenantId),
            isNull(departments.deletedAt)
          ));

        return {
          items,
          total: totalResult?.count || 0,
        };
      }),

    create: adminProcedure
      .input(createDepartmentSchema)
      .mutation(async ({ ctx, input }) => {
        // Check department limit
        const settings = ctx.tenant?.settings as any;
        const maxDepartments = settings?.maxDepartments || 3;

        const [currentCount] = await ctx.db
          .select({ count: departments.id })
          .from(departments)
          .where(and(
            eq(departments.tenantId, ctx.tenantId),
            isNull(departments.deletedAt)
          ));

        if ((currentCount?.count || 0) >= maxDepartments) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Department limit (${maxDepartments}) reached for your plan`,
          });
        }

        const [department] = await ctx.db
          .insert(departments)
          .values({
            tenantId: ctx.tenantId,
            ...input,
          } as NewDepartment)
          .returning();

        return department;
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          data: createDepartmentSchema.partial(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const [updated] = await ctx.db
          .update(departments)
          .set({
            ...input.data,
            updatedAt: new Date(),
          })
          .where(and(
            eq(departments.id, input.id),
            eq(departments.tenantId, ctx.tenantId)
          ))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Department not found',
          });
        }

        return updated;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [deleted] = await ctx.db
          .update(departments)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(
            eq(departments.id, input.id),
            eq(departments.tenantId, ctx.tenantId)
          ))
          .returning();

        if (!deleted) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Department not found',
          });
        }

        return { success: true };
      }),
  },

  // User management
  users: {
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          search: z.string().optional(),
          departmentId: z.string().uuid().optional(),
          role: z.enum(['owner', 'admin', 'manager', 'member']).optional(),
          status: z.enum(['active', 'inactive', 'on_leave']).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        let conditions = [
          eq(users.tenantId, ctx.tenantId),
          isNull(users.deletedAt),
        ];

        if (input.departmentId) {
          conditions.push(eq(users.departmentId, input.departmentId));
        }

        if (input.role) {
          conditions.push(eq(users.role, input.role));
        }

        if (input.status) {
          conditions.push(eq(users.status, input.status));
        }

        let query = ctx.db
          .select({
            user: users,
            department: departments,
          })
          .from(users)
          .leftJoin(departments, eq(users.departmentId, departments.id))
          .where(and(...conditions))
          .orderBy(asc(users.name))
          .limit(input.limit)
          .offset(input.offset);

        if (input.search) {
          query = query.where(
            or(
              like(users.name, `%${input.search}%`),
              like(users.email, `%${input.search}%`),
              like(users.employeeId, `%${input.search}%`)
            )
          );
        }

        const items = await query;

        const [totalResult] = await ctx.db
          .select({ count: users.id })
          .from(users)
          .where(and(...conditions));

        return {
          items: items.map(item => ({
            ...item.user,
            department: item.department,
          })),
          total: totalResult?.count || 0,
        };
      }),

    invite: adminProcedure
      .input(inviteUserSchema)
      .mutation(async ({ ctx, input }) => {
        // Check user limit
        const settings = ctx.tenant?.settings as any;
        const maxUsers = settings?.maxUsers || 10;

        const [currentCount] = await ctx.db
          .select({ count: users.id })
          .from(users)
          .where(and(
            eq(users.tenantId, ctx.tenantId),
            isNull(users.deletedAt)
          ));

        if ((currentCount?.count || 0) >= maxUsers) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `User limit (${maxUsers}) reached for your plan`,
          });
        }

        // Check if email already exists in tenant
        const [existing] = await ctx.db
          .select({ id: users.id })
          .from(users)
          .where(and(
            eq(users.tenantId, ctx.tenantId),
            eq(users.email, input.email),
            isNull(users.deletedAt)
          ))
          .limit(1);

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User with this email already exists',
          });
        }

        const [user] = await ctx.db
          .insert(users)
          .values({
            tenantId: ctx.tenantId,
            ...input,
          } as NewUser)
          .returning();

        // TODO: Send invitation email

        return user;
      }),

    updateRole: adminProcedure
      .input(
        z.object({
          userId: z.string().uuid(),
          role: z.enum(['admin', 'manager', 'member']),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Cannot change owner role
        const [targetUser] = await ctx.db
          .select({ role: users.role })
          .from(users)
          .where(and(
            eq(users.id, input.userId),
            eq(users.tenantId, ctx.tenantId)
          ))
          .limit(1);

        if (!targetUser) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        if (targetUser.role === 'owner') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot change owner role',
          });
        }

        const [updated] = await ctx.db
          .update(users)
          .set({
            role: input.role,
            updatedAt: new Date(),
          })
          .where(and(
            eq(users.id, input.userId),
            eq(users.tenantId, ctx.tenantId)
          ))
          .returning();

        return updated;
      }),

    deactivate: adminProcedure
      .input(z.object({ userId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [updated] = await ctx.db
          .update(users)
          .set({
            status: 'inactive',
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(
            eq(users.id, input.userId),
            eq(users.tenantId, ctx.tenantId)
          ))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        return { success: true };
      }),
  },

  // Shift type management
  shiftTypes: {
    list: protectedProcedure.query(async ({ ctx }) => {
      const items = await ctx.db
        .select()
        .from(shiftTypes)
        .where(eq(shiftTypes.tenantId, ctx.tenantId))
        .orderBy(asc(shiftTypes.sortOrder), asc(shiftTypes.name));

      return items;
    }),

    create: adminProcedure
      .input(createShiftTypeSchema)
      .mutation(async ({ ctx, input }) => {
        // Calculate duration in minutes
        const [startHour, startMin] = input.startTime.split(':').map(Number);
        const [endHour, endMin] = input.endTime.split(':').map(Number);
        let duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);

        // Handle overnight shifts
        if (duration < 0) {
          duration += 24 * 60;
        }

        const [shiftType] = await ctx.db
          .insert(shiftTypes)
          .values({
            tenantId: ctx.tenantId,
            ...input,
            duration,
          } as NewShiftType)
          .returning();

        return shiftType;
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          data: createShiftTypeSchema.partial(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        let duration: number | undefined;

        if (input.data.startTime && input.data.endTime) {
          const [startHour, startMin] = input.data.startTime.split(':').map(Number);
          const [endHour, endMin] = input.data.endTime.split(':').map(Number);
          duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);

          if (duration < 0) {
            duration += 24 * 60;
          }
        }

        const [updated] = await ctx.db
          .update(shiftTypes)
          .set({
            ...input.data,
            ...(duration !== undefined && { duration }),
            updatedAt: new Date(),
          })
          .where(and(
            eq(shiftTypes.id, input.id),
            eq(shiftTypes.tenantId, ctx.tenantId)
          ))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Shift type not found',
          });
        }

        return updated;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        // Check if shift type is in use
        // TODO: Check shift assignments

        const result = await ctx.db
          .delete(shiftTypes)
          .where(and(
            eq(shiftTypes.id, input.id),
            eq(shiftTypes.tenantId, ctx.tenantId)
          ));

        return { success: true };
      }),
  },

  // Owner procedures
  createTenant: publicProcedure
    .input(createTenantSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if slug is available
      const [existing] = await ctx.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, input.slug))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Slug already taken',
        });
      }

      // Generate secret code
      const secretCode = `${input.slug}-${nanoid(10)}`;

      const [tenant] = await ctx.db
        .insert(tenants)
        .values({
          ...input,
          secretCode,
        } as NewTenant)
        .returning();

      // Create default shift types
      const defaultShiftTypes = [
        { code: 'D', name: 'Day', startTime: '07:00', endTime: '15:00', color: '#3B82F6' },
        { code: 'E', name: 'Evening', startTime: '15:00', endTime: '23:00', color: '#10B981' },
        { code: 'N', name: 'Night', startTime: '23:00', endTime: '07:00', color: '#6366F1' },
        { code: 'O', name: 'Off', startTime: '00:00', endTime: '00:00', color: '#9CA3AF' },
      ];

      for (const [index, shift] of defaultShiftTypes.entries()) {
        const [startHour, startMin] = shift.startTime.split(':').map(Number);
        const [endHour, endMin] = shift.endTime.split(':').map(Number);
        let duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);

        if (duration < 0) {
          duration += 24 * 60;
        }

        if (shift.code === 'O') {
          duration = 0; // Off day has no duration
        }

        await ctx.db.insert(shiftTypes).values({
          tenantId: tenant.id,
          ...shift,
          duration,
          sortOrder: index,
        } as NewShiftType);
      }

      return tenant;
    }),

  deleteTenant: ownerProcedure
    .input(z.object({ confirm: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      if (!input.confirm) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Confirmation required',
        });
      }

      // Soft delete tenant (cascades to all related data)
      const [deleted] = await ctx.db
        .update(tenants)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, ctx.tenantId))
        .returning();

      return { success: true };
    }),
});