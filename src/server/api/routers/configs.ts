/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, longCachedProcedure } from '../trpc';
import { db } from '@/db';
import { configs } from '@/db/schema/configs';
import { eq, and, isNull } from 'drizzle-orm';
import { sse } from '@/lib/sse/broadcaster';

// Default configurations
const DEFAULT_SHIFT_TYPES = [
  { code: 'D', name: '주간 근무', startTime: '07:00', endTime: '15:00', color: 'blue', allowOvertime: false },
  { code: 'E', name: '저녁 근무', startTime: '15:00', endTime: '23:00', color: 'amber', allowOvertime: false },
  { code: 'N', name: '야간 근무', startTime: '23:00', endTime: '07:00', color: 'indigo', allowOvertime: true },
  { code: 'A', name: '행정 근무', startTime: '09:00', endTime: '18:00', color: 'green', allowOvertime: false },
  { code: 'O', name: '휴무', startTime: '00:00', endTime: '00:00', color: 'gray', allowOvertime: false },
  { code: 'V', name: '휴가', startTime: '00:00', endTime: '00:00', color: 'purple', allowOvertime: false },
];

const ensureDefaultShiftTypes = (shiftTypes?: typeof DEFAULT_SHIFT_TYPES) => {
  if (!shiftTypes || shiftTypes.length === 0) {
    return [...DEFAULT_SHIFT_TYPES];
  }

  const existingCodes = new Set(shiftTypes.map((st) => st.code));
  const missingDefaults = DEFAULT_SHIFT_TYPES.filter((defaultType) => !existingCodes.has(defaultType.code));

  return missingDefaults.length > 0 ? [...shiftTypes, ...missingDefaults] : shiftTypes;
};

const DEFAULT_CONTRACT_TYPES = [
  { code: 'FT', name: '정규직', description: '정규 고용 계약', isPrimary: true },
  { code: 'PT', name: '파트타임', description: '시간제 계약', isPrimary: false, maxHoursPerWeek: 30 },
  { code: 'CT', name: '계약직', description: '기간 계약직', isPrimary: false },
  { code: 'IN', name: '인턴', description: '인턴십 프로그램', isPrimary: false, maxHoursPerWeek: 40 },
];

const DEFAULT_EMPLOYEE_STATUSES = [
  { code: 'ACTIVE', name: '재직 중', color: 'green', description: '현재 재직 중인 직원' },
  { code: 'LEAVE', name: '휴직', color: 'amber', description: '휴직 상태' },
  { code: 'RESIGNED', name: '퇴사', color: 'gray', description: '퇴사한 직원' },
];

const DEFAULT_POSITIONS = [
  { value: 'RN', label: '정규간호사', level: 3 },
  { value: 'CN', label: '책임간호사', level: 4 },
  { value: 'HN', label: '수간호사', level: 5 },
  { value: 'NA', label: '간호조무사', level: 2 },
];

const DEFAULT_POSITION_GROUPS = [
  { id: 'nursing', name: '간호팀', positions: ['RN', 'CN', 'HN', 'NA'], color: 'blue' },
  { id: 'admin', name: '행정팀', positions: [], color: 'green' },
];

const DEFAULT_PREFERENCES = {
  nightIntensivePaidLeaveDays: 0,
};

export const configsRouter = createTRPCRouter({
  // ===== Config Preset Management =====

  // List all config presets
  listPresets: protectedProcedure
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Get all configs with key starting with 'config_preset_'
      const result = await db.select()
        .from(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          isNull(configs.departmentId)
        ));

      // Filter and transform presets
      const presets = result
        .filter(config => config.configKey.startsWith('config_preset_'))
        .map(config => ({
          id: config.configKey.replace('config_preset_', ''),
          name: (config.configValue as any).name || 'Unnamed Preset',
          data: (config.configValue as any).data || {},
          createdAt: (config.configValue as any).createdAt || config.createdAt,
          updatedAt: config.updatedAt,
        }));

      return presets;
    }),

  // Save config preset
  savePreset: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      data: z.any(), // Full config data object
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Generate unique ID
      const presetId = crypto.randomUUID();
      const configKey = `config_preset_${presetId}`;

      const presetValue = {
        name: input.name,
        data: input.data,
        createdAt: new Date().toISOString(),
      };

      const result = await db.insert(configs)
        .values({
          tenantId,
          departmentId: null,
          configKey,
          configValue: presetValue,
        })
        .returning();

      return {
        id: presetId,
        name: input.name,
        data: input.data,
        createdAt: presetValue.createdAt,
        updatedAt: result[0]!.updatedAt,
      };
    }),

  // Delete config preset
  deletePreset: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const configKey = `config_preset_${input.id}`;

      await db.delete(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          isNull(configs.departmentId),
          eq(configs.configKey, configKey)
        ));

      return { success: true };
    }),

  // Load config preset (returns the data to be applied)
  loadPreset: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const configKey = `config_preset_${input.id}`;

      const result = await db.select()
        .from(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          isNull(configs.departmentId),
          eq(configs.configKey, configKey)
        ))
        .limit(1);

      if (result.length === 0) {
        throw new Error('Preset not found');
      }

      // Update last used timestamp
      const userId = ctx.user?.id;
      if (userId) {
        const recentPresetKey = `user_recent_config_preset_${userId}`;
        const recentPresetValue = {
          presetId: input.id,
          lastUsedAt: new Date().toISOString(),
        };

        // Check if recent preset record exists
        const existingRecent = await db.select()
          .from(configs)
          .where(and(
            eq(configs.tenantId, tenantId),
            isNull(configs.departmentId),
            eq(configs.configKey, recentPresetKey)
          ))
          .limit(1);

        if (existingRecent.length > 0) {
          // Update
          await db.update(configs)
            .set({
              configValue: recentPresetValue,
              updatedAt: new Date(),
            })
            .where(and(
              eq(configs.tenantId, tenantId),
              isNull(configs.departmentId),
              eq(configs.configKey, recentPresetKey)
            ));
        } else {
          // Create
          await db.insert(configs)
            .values({
              tenantId,
              departmentId: null,
              configKey: recentPresetKey,
              configValue: recentPresetValue,
            });
        }
      }

      return (result[0]!.configValue as any).data || {};
    }),

  // Get recently used config preset for current user
  getRecentConfigPreset: protectedProcedure
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const userId = ctx.user?.id;

      if (!userId) {
        return null;
      }

      const recentPresetKey = `user_recent_config_preset_${userId}`;

      const result = await db.select()
        .from(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          isNull(configs.departmentId),
          eq(configs.configKey, recentPresetKey)
        ))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const recentData = result[0]!.configValue as any;
      return {
        presetId: recentData.presetId,
        lastUsedAt: recentData.lastUsedAt,
      };
    }),

  // ===== Original Config Methods =====

  // Get config by key (supports department-level override)
  getByKey: longCachedProcedure // 30 min cache for configs
    .input(z.object({
      configKey: z.string(),
      departmentId: z.string().optional(), // Optional department filter
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // If departmentId provided, try to get department-specific config first
      if (input.departmentId) {
        const deptResult = await db.select()
          .from(configs)
          .where(and(
            eq(configs.tenantId, tenantId),
            eq(configs.departmentId, input.departmentId),
            eq(configs.configKey, input.configKey)
          ))
          .limit(1);

        // Return department config if exists
        if (deptResult.length > 0) {
          return deptResult[0];
        }
      }

      // Fallback to tenant-level config (department_id = NULL)
      const result = await db.select()
        .from(configs)
        .where(and(
          eq(configs.tenantId, tenantId),
          isNull(configs.departmentId),
          eq(configs.configKey, input.configKey)
        ))
        .limit(1);

      return result[0] || null;
    }),

  // Get all configs for tenant (optionally filtered by department)
  getAll: longCachedProcedure // 30 min cache for configs
    .input(z.object({
      departmentId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const departmentId = input?.departmentId ?? ctx.user?.departmentId ?? null;

      if (departmentId) {
        // Get both tenant-level and department-specific configs
        const tenantConfigs = await db.select()
          .from(configs)
          .where(and(
            eq(configs.tenantId, tenantId),
            isNull(configs.departmentId)
          ));

        const deptConfigs = await db.select()
          .from(configs)
          .where(and(
            eq(configs.tenantId, tenantId),
            eq(configs.departmentId, departmentId)
          ));

        // Merge configs: department configs override tenant configs
        const configMap: Record<string, any> = {};

        // Add tenant configs first
        tenantConfigs.forEach(config => {
          configMap[config.configKey] = config.configValue;
        });

        // Override with department configs
        deptConfigs.forEach(config => {
          configMap[config.configKey] = config.configValue;
        });

        if (configMap.shift_types) {
          configMap.shift_types = ensureDefaultShiftTypes(configMap.shift_types);
        }

        // If no department configs exist, create defaults
        if (deptConfigs.length === 0) {
          console.log(`Creating default configs for department ${departmentId}`);

          await db.insert(configs).values([
            { tenantId, departmentId, configKey: 'shift_types', configValue: DEFAULT_SHIFT_TYPES },
            { tenantId, departmentId, configKey: 'contract_types', configValue: DEFAULT_CONTRACT_TYPES },
            { tenantId, departmentId, configKey: 'employee_statuses', configValue: DEFAULT_EMPLOYEE_STATUSES },
            { tenantId, departmentId, configKey: 'positions', configValue: DEFAULT_POSITIONS },
            { tenantId, departmentId, configKey: 'position_groups', configValue: DEFAULT_POSITION_GROUPS },
            { tenantId, departmentId, configKey: 'preferences', configValue: DEFAULT_PREFERENCES },
          ]);

          return {
            shift_types: DEFAULT_SHIFT_TYPES,
            contract_types: DEFAULT_CONTRACT_TYPES,
            employee_statuses: DEFAULT_EMPLOYEE_STATUSES,
            positions: DEFAULT_POSITIONS,
            position_groups: DEFAULT_POSITION_GROUPS,
            preferences: DEFAULT_PREFERENCES,
          };
        }

        return configMap;
      } else {
        // Get only tenant-level configs (department_id = NULL)
        const result = await db.select()
          .from(configs)
          .where(and(
            eq(configs.tenantId, tenantId),
            isNull(configs.departmentId)
          ));

        // Convert to key-value map
        const configMap: Record<string, any> = {};
        result.forEach(config => {
          configMap[config.configKey] = config.configValue;
        });

        if (configMap.shift_types) {
          configMap.shift_types = ensureDefaultShiftTypes(configMap.shift_types);
        }

        // If no tenant-level configs exist, create defaults (for backward compatibility)
        if (result.length === 0) {
          console.log(`Creating default tenant-level configs for tenant ${tenantId}`);

          await db.insert(configs).values([
            { tenantId, departmentId: null, configKey: 'shift_types', configValue: DEFAULT_SHIFT_TYPES },
            { tenantId, departmentId: null, configKey: 'contract_types', configValue: DEFAULT_CONTRACT_TYPES },
            { tenantId, departmentId: null, configKey: 'employee_statuses', configValue: DEFAULT_EMPLOYEE_STATUSES },
            { tenantId, departmentId: null, configKey: 'positions', configValue: DEFAULT_POSITIONS },
            { tenantId, departmentId: null, configKey: 'position_groups', configValue: DEFAULT_POSITION_GROUPS },
            { tenantId, departmentId: null, configKey: 'preferences', configValue: DEFAULT_PREFERENCES },
          ]);

          return {
            shift_types: DEFAULT_SHIFT_TYPES,
            contract_types: DEFAULT_CONTRACT_TYPES,
            employee_statuses: DEFAULT_EMPLOYEE_STATUSES,
            positions: DEFAULT_POSITIONS,
            position_groups: DEFAULT_POSITION_GROUPS,
            preferences: DEFAULT_PREFERENCES,
          };
        }

        return configMap;
      }
    }),

  // Set config (create or update)
  set: protectedProcedure
    .input(z.object({
      configKey: z.string(),
      configValue: z.any(), // JSON value
      departmentId: z.string().optional(), // Optional department ID
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      // Use user's departmentId if not provided explicitly
      const departmentId = input.departmentId ?? ctx.user?.departmentId ?? null;

      // Build where conditions
      const whereConditions = [
        eq(configs.tenantId, tenantId),
        eq(configs.configKey, input.configKey),
      ];

      if (departmentId) {
        whereConditions.push(eq(configs.departmentId, departmentId));
      } else {
        whereConditions.push(isNull(configs.departmentId));
      }

      // Check if config exists
      const existing = await db.select()
        .from(configs)
        .where(and(...whereConditions))
        .limit(1);

      if (existing.length > 0) {
        // Update
        const result = await db.update(configs)
          .set({
            configValue: input.configValue,
            updatedAt: new Date(),
          })
          .where(and(...whereConditions))
          .returning();

        // ✅ SSE: 설정 업데이트 이벤트 브로드캐스트
        const category = input.configKey.includes('shift') ? 'shift_types' :
                        input.configKey.includes('contract') ? 'contract_types' :
                        input.configKey.includes('position') ? 'positions' : 'general';

        sse.config.updated(input.configKey, {
          departmentId: departmentId || undefined,
          category,
          tenantId,
        });

        // ✅ 시프트 타입 업데이트인 경우 별도 이벤트 전송
        if (input.configKey === 'shift_types') {
          sse.config.shiftTypesUpdated({
            departmentId: departmentId || undefined,
            shiftTypes: input.configValue,
            tenantId,
          });
        }

        return result[0];
      } else {
        // Create
        const result = await db.insert(configs)
          .values({
            tenantId,
            departmentId: departmentId,
            configKey: input.configKey,
            configValue: input.configValue,
          })
          .returning();

        // ✅ SSE: 설정 생성 이벤트 브로드캐스트
        const category = input.configKey.includes('shift') ? 'shift_types' :
                        input.configKey.includes('contract') ? 'contract_types' :
                        input.configKey.includes('position') ? 'positions' : 'general';

        sse.config.updated(input.configKey, {
          departmentId: departmentId || undefined,
          category,
          tenantId,
        });

        // ✅ 시프트 타입 생성인 경우 별도 이벤트 전송
        if (input.configKey === 'shift_types') {
          sse.config.shiftTypesUpdated({
            departmentId: departmentId || undefined,
            shiftTypes: input.configValue,
            tenantId,
          });
        }

        return result[0];
      }
    }),

  // Delete config
  delete: protectedProcedure
    .input(z.object({
      configKey: z.string(),
      departmentId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

      const whereConditions = [
        eq(configs.tenantId, tenantId),
        eq(configs.configKey, input.configKey),
      ];

      if (input.departmentId) {
        whereConditions.push(eq(configs.departmentId, input.departmentId));
      } else {
        whereConditions.push(isNull(configs.departmentId));
      }

      await db.delete(configs)
        .where(and(...whereConditions));

      // ✅ SSE: 설정 삭제 이벤트 브로드캐스트
      const category = input.configKey.includes('shift') ? 'shift_types' :
                      input.configKey.includes('contract') ? 'contract_types' :
                      input.configKey.includes('position') ? 'positions' : 'general';

      sse.config.updated(input.configKey, {
        departmentId: input.departmentId,
        category,
        tenantId,
      });

      return { success: true };
    }),
});
