import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import type { Database } from '@/db';

export function scopedDb(tenantId: string) {
  const hasDeletedAtColumn = (table: Record<string, unknown>) =>
    typeof table?.deletedAt !== 'undefined';

  return {
    async query<T extends Record<string, any>>(
      table: any,
      where?: any
    ) {
      const maybeDeletedCondition = hasDeletedAtColumn(table)
        ? [isNull(table.deletedAt)]
        : [];
      const conditions = [
        eq(table.tenantId, tenantId),
        ...maybeDeletedCondition,
        ...(where ? [where] : [])
      ];

      return db
        .select()
        .from(table)
        .where(and(...conditions));
    },

    async insert<T extends Record<string, any>>(
      table: any,
      values: T | T[]
    ) {
      const valuesArray = Array.isArray(values) ? values : [values];
      const valuesWithTenant = valuesArray.map(v => ({
        ...v,
        tenantId,
      }));

      return db.insert(table).values(valuesWithTenant).returning();
    },

    async update<T extends Record<string, any>>(
      table: any,
      values: T,
      where?: any
    ) {
      const maybeDeletedCondition = hasDeletedAtColumn(table)
        ? [isNull(table.deletedAt)]
        : [];
      const conditions = [
        eq(table.tenantId, tenantId),
        ...maybeDeletedCondition,
        ...(where ? [where] : [])
      ];

      return db
        .update(table)
        .set(values)
        .where(and(...conditions))
        .returning();
    },

    async softDelete(table: any, where?: any) {
      if (!hasDeletedAtColumn(table)) {
        throw new Error('softDelete requires a table with deletedAt column');
      }

      const conditions = [
        eq(table.tenantId, tenantId),
        isNull(table.deletedAt),
        ...(where ? [where] : [])
      ];

      return db
        .update(table)
        .set({ deletedAt: sql`now()` })
        .where(and(...conditions))
        .returning();
    },

    async hardDelete(table: any, where?: any) {
      const conditions = [
        eq(table.tenantId, tenantId),
        ...(where ? [where] : [])
      ];

      return db
        .delete(table)
        .where(and(...conditions))
        .returning();
    },
  };
}

export async function createAuditLog({
  tenantId,
  actorId,
  action,
  entityType,
  entityId,
  before,
  after,
  metadata,
}: {
  tenantId: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: any;
  after?: any;
  metadata?: any;
}) {
  const { auditLogs } = await import('@/db/schema');

  return db.insert(auditLogs).values({
    tenantId,
    actorId: actorId ?? null,
    action,
    entityType,
    entityId: entityId ?? '',
    before,
    after,
    metadata,
  }).returning();
}
