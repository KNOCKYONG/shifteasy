import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { db } from '@/db/supabase';
import { eq, and, isNull } from 'drizzle-orm';
import { users, tenants } from '@/db/schema';
import { hasPermission, type Permission } from '@/lib/permissions';
import { rateLimitMiddleware } from '@/lib/rate-limit';
import { auditApiOperation } from '@/lib/audit-log';
import type { NextRequest } from 'next/server';

// Context type definition
export type Context = {
  db: typeof db;
  user: typeof users.$inferSelect | null;
  tenant: typeof tenants.$inferSelect | null;
  tenantId: string | null;
  req: {
    url: string;
    method: string;
    headers: Headers;
    ip?: string;
  };
};

/**
 * Create tRPC context with multi-tenant support
 * Handles authentication and tenant resolution
 */
export const createTRPCContext = async (opts: {
  req: NextRequest;
  headers?: Headers;
}) => {
  const { req } = opts;

  // Extract tenant information from headers or subdomain
  const tenantId = extractTenantId(req);

  // Extract user authentication (can be from JWT, session, etc.)
  const userId = await extractUserId(req);

  let user = null;
  let tenant = null;

  // Load tenant information
  if (tenantId) {
    const [tenantData] = await db
      .select()
      .from(tenants)
      .where(and(
        eq(tenants.id, tenantId),
        isNull(tenants.deletedAt)
      ))
      .limit(1);

    tenant = tenantData || null;

    if (!tenant) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Tenant not found'
      });
    }
  }

  // Load user information
  if (userId && tenantId) {
    const [userData] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        isNull(users.deletedAt)
      ))
      .limit(1);

    user = userData || null;
  }

  return {
    db,
    user,
    tenant,
    tenantId,
    req: {
      url: req.url,
      method: req.method,
      headers: req.headers,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
    },
  };
};

/**
 * Extract tenant ID from request
 * Can be from subdomain, header, or JWT claim
 */
function extractTenantId(req: NextRequest): string | null {
  // Method 1: From header (e.g., X-Tenant-Id)
  const headerTenantId = req.headers.get('x-tenant-id');
  if (headerTenantId) return headerTenantId;

  // Method 2: From subdomain
  const host = req.headers.get('host');
  if (host) {
    const subdomain = host.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
      return subdomain; // You might want to look this up in the database
    }
  }

  // Method 3: From cookie
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const tenantCookie = cookieHeader
      .split(';')
      .find(c => c.trim().startsWith('tenant_id='));

    if (tenantCookie) {
      return tenantCookie.split('=')[1];
    }
  }

  // Development fallback
  if (process.env.NODE_ENV === 'development') {
    return process.env.DEV_TENANT_ID || null;
  }

  return null;
}

/**
 * Extract user ID from request
 * Can be from JWT, session, or API key
 */
async function extractUserId(req: NextRequest): Promise<string | null> {
  // Method 1: From Authorization header (JWT)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // TODO: Verify JWT and extract user ID
    // const payload = await verifyJWT(token);
    // return payload.userId;
  }

  // Method 2: From session cookie
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const sessionCookie = cookieHeader
      .split(';')
      .find(c => c.trim().startsWith('session='));

    if (sessionCookie) {
      const sessionId = sessionCookie.split('=')[1];
      // TODO: Look up session in database or cache
      // const session = await getSession(sessionId);
      // return session?.userId;
    }
  }

  // Development fallback
  if (process.env.NODE_ENV === 'development') {
    return process.env.DEV_USER_ID || null;
  }

  return null;
}

// Initialize tRPC
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

// Export router and procedure helpers
export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

// Middleware: Public procedure (no auth required)
export const publicProcedure = t.procedure;

// Middleware: Authenticated user required
const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.tenant) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenant: ctx.tenant,
      tenantId: ctx.tenant.id,
    },
  });
});

// Middleware: Check user role
const hasRole = (allowedRoles: string[]) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!allowedRoles.includes(ctx.user.role)) {
      // Audit unauthorized access attempt
      await auditApiOperation(
        {
          user: ctx.user || undefined,
          tenantId: ctx.tenantId || undefined,
          req: ctx.req,
        },
        'security.unauthorized_role',
        'api_role_check',
        undefined,
        {
          metadata: {
            requiredRoles: allowedRoles,
            userRole: ctx.user.role,
          },
        }
      );

      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions'
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        tenant: ctx.tenant!,
        tenantId: ctx.tenantId!,
      },
    });
  });

// Middleware: Permission-based access control
const requirePermission = (permission: Permission) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!hasPermission(ctx.user.role as any, permission)) {
      // Audit unauthorized access attempt
      await auditApiOperation(
        {
          user: ctx.user || undefined,
          tenantId: ctx.tenantId || undefined,
          req: ctx.req,
        },
        'security.unauthorized_access',
        'api_permission',
        undefined,
        {
          metadata: {
            requiredPermission: permission,
            userRole: ctx.user.role,
          },
        }
      );

      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Missing required permission: ${permission}`,
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        tenant: ctx.tenant!,
        tenantId: ctx.tenantId!,
      },
    });
  });

// Middleware: Rate limiting
const withRateLimit = (
  type: 'api' | 'auth' | 'schedule' | 'swap' | 'report' | 'notification' | 'upload' = 'api'
) =>
  t.middleware(async ({ ctx, next }) => {
    if (ctx.user && ctx.tenantId) {
      await rateLimitMiddleware(type, {
        user: ctx.user || undefined,
        tenantId: ctx.tenantId || undefined,
        req: ctx.req,
      });
    }

    return next();
  });

// Export pre-configured procedures
export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(hasRole(['admin', 'owner']));
export const ownerProcedure = t.procedure.use(hasRole(['owner']));
export const managerProcedure = t.procedure.use(hasRole(['manager', 'admin', 'owner']));

// Permission-based procedures with rate limiting
export const createScheduleProcedure = t.procedure
  .use(isAuthed)
  .use(requirePermission('schedule.create'))
  .use(withRateLimit('schedule'));

export const manageStaffProcedure = t.procedure
  .use(isAuthed)
  .use(requirePermission('staff.edit'))
  .use(withRateLimit('api'));

export const approveSwapProcedure = t.procedure
  .use(isAuthed)
  .use(requirePermission('swap.approve'))
  .use(withRateLimit('swap'));

export const viewReportProcedure = t.procedure
  .use(isAuthed)
  .use(requirePermission('report.view'))
  .use(withRateLimit('report'));

export const sendNotificationProcedure = t.procedure
  .use(isAuthed)
  .use(requirePermission('notification.send'))
  .use(withRateLimit('notification'));