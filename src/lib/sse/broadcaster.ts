/**
 * Centralized SSE Broadcasting Utility
 * 모든 서버 측 SSE 이벤트 전송을 중앙에서 관리
 */

import { sseManager } from './sseManager';
import {
  type SSEEventType,
  type SSEEventPayload,
  createSSEEvent,
} from './events';

// ============================================================================
// SSE 브로드캐스터 클래스
// ============================================================================

class SSEBroadcaster {
  /**
   * SSE 이벤트 브로드캐스트 (모든 연결된 클라이언트에게)
   */
  broadcast<T extends SSEEventType>(
    eventType: T,
    payload: SSEEventPayload[T],
    options?: {
      userId?: string;
      tenantId?: string;
      filterFn?: (clientId: string) => boolean;
    }
  ): void {
    const event = createSSEEvent(eventType, payload, {
      userId: options?.userId,
      tenantId: options?.tenantId,
    });

    console.log(`[SSE Broadcaster] Broadcasting ${eventType}`, {
      userId: options?.userId,
      tenantId: options?.tenantId,
      payload,
    });

    sseManager.broadcast(event, options?.filterFn);
  }

  /**
   * 특정 사용자에게만 SSE 이벤트 전송
   */
  sendToUser<T extends SSEEventType>(
    userId: string,
    eventType: T,
    payload: SSEEventPayload[T],
    options?: {
      tenantId?: string;
    }
  ): void {
    const event = createSSEEvent(eventType, payload, {
      userId,
      tenantId: options?.tenantId,
    });

    console.log(`[SSE Broadcaster] Sending ${eventType} to user ${userId}`, payload);

    const clientIds = sseManager.getClientIdsByUserId(userId);
    clientIds.forEach(clientId => {
      sseManager.sendToClient(clientId, event);
    });
  }

  /**
   * 특정 부서의 모든 사용자에게 SSE 이벤트 전송
   */
  sendToDepartment<T extends SSEEventType>(
    tenantId: string,
    departmentId: string,
    eventType: T,
    payload: SSEEventPayload[T]
  ): void {
    const event = createSSEEvent(eventType, payload, { tenantId });

    console.log(`[SSE Broadcaster] Broadcasting ${eventType} to department ${departmentId}`, payload);

    // 모든 클라이언트에게 전송 (클라이언트 측에서 departmentId 필터링)
    sseManager.broadcast(event);
  }
}

// ============================================================================
// 싱글톤 인스턴스
// ============================================================================

export const sseBroadcaster = new SSEBroadcaster();

// ============================================================================
// 도메인별 헬퍼 함수
// ============================================================================

/**
 * Schedule 관련 SSE 이벤트
 */
export const scheduleSSE = {
  published: (
    scheduleId: string,
    data: {
      departmentId?: string;
      startDate: Date | string;
      endDate: Date | string;
      publishedBy: string;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('schedule.published', {
      scheduleId,
      departmentId: data.departmentId,
      startDate: data.startDate,
      endDate: data.endDate,
      publishedBy: data.publishedBy,
    }, { tenantId: data.tenantId });
  },

  updated: (
    scheduleId: string,
    data: {
      departmentId?: string;
      action?: 'invalidate' | 'refresh';
      queries?: string[];
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('schedule.updated', {
      scheduleId,
      departmentId: data.departmentId,
      action: data.action,
      queries: data.queries,
    }, { tenantId: data.tenantId });
  },

  generated: (
    scheduleId: string,
    data: {
      departmentId: string;
      generatedBy: string;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('schedule.generated', {
      scheduleId,
      departmentId: data.departmentId,
      generatedBy: data.generatedBy,
    }, { tenantId: data.tenantId });
  },

  archived: (
    scheduleId: string,
    data: {
      departmentId?: string;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('schedule.archived', {
      scheduleId,
      departmentId: data.departmentId,
    }, { tenantId: data.tenantId });
  },

  deleted: (
    scheduleId: string,
    data: {
      departmentId?: string;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('schedule.deleted', {
      scheduleId,
      departmentId: data.departmentId,
      deleted: true,
    }, { tenantId: data.tenantId });
  },

  versionUpdated: (
    scheduleId: string,
    data: {
      version: number;
      reason: string;
      changes?: unknown;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('schedule.version_updated', {
      scheduleId,
      version: data.version,
      reason: data.reason,
      changes: data.changes,
    }, { tenantId: data.tenantId });
  },
};

/**
 * Staff 관련 SSE 이벤트
 */
export const staffSSE = {
  created: (
    userId: string,
    data: {
      departmentId?: string;
      name: string;
      role: string;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('staff.created', {
      userId,
      departmentId: data.departmentId,
      name: data.name,
      role: data.role,
    }, { tenantId: data.tenantId });
  },

  updated: (
    userId: string,
    data: {
      departmentId?: string;
      fields: string[];
      changes?: Record<string, unknown>;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('staff.updated', {
      userId,
      departmentId: data.departmentId,
      fields: data.fields,
      changes: data.changes,
    }, { tenantId: data.tenantId });
  },

  deleted: (
    userId: string,
    data: {
      departmentId?: string;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('staff.deleted', {
      userId,
      departmentId: data.departmentId,
    }, { tenantId: data.tenantId });
  },

  careerUpdated: (
    userId: string,
    data: {
      departmentId?: string;
      careerInfo: {
        hireYear?: number;
        yearsOfService?: number;
      };
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('staff.career_updated', {
      userId,
      departmentId: data.departmentId,
      careerInfo: data.careerInfo,
    }, { tenantId: data.tenantId });
  },
};

/**
 * Team 관련 SSE 이벤트
 */
export const teamSSE = {
  created: (
    teamId: string,
    data: {
      departmentId?: string;
      name: string;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('team.created', {
      teamId,
      departmentId: data.departmentId,
      name: data.name,
    }, { tenantId: data.tenantId });
  },

  updated: (
    teamId: string,
    data: {
      departmentId?: string;
      changes?: Record<string, unknown>;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('team.updated', {
      teamId,
      departmentId: data.departmentId,
      changes: data.changes,
    }, { tenantId: data.tenantId });
  },

  deleted: (
    teamId: string,
    data: {
      departmentId?: string;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('team.deleted', {
      teamId,
      departmentId: data.departmentId,
    }, { tenantId: data.tenantId });
  },

  memberAdded: (
    teamId: string,
    userId: string,
    data: {
      departmentId?: string;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('team.member_added', {
      teamId,
      userId,
      departmentId: data.departmentId,
    }, { tenantId: data.tenantId });
  },

  memberRemoved: (
    teamId: string,
    userId: string,
    data: {
      departmentId?: string;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('team.member_removed', {
      teamId,
      userId,
      departmentId: data.departmentId,
    }, { tenantId: data.tenantId });
  },
};

/**
 * Config 관련 SSE 이벤트
 */
export const configSSE = {
  updated: (
    configKey: string,
    data: {
      departmentId?: string;
      category?: string;
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('config.updated', {
      configKey,
      departmentId: data.departmentId,
      category: data.category,
    }, { tenantId: data.tenantId });
  },

  shiftTypesUpdated: (
    data: {
      departmentId?: string;
      shiftTypes: unknown[];
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('config.shift_types_updated', {
      departmentId: data.departmentId,
      shiftTypes: data.shiftTypes,
    }, { tenantId: data.tenantId });
  },

  constraintsUpdated: (
    data: {
      departmentId?: string;
      constraints: unknown[];
      tenantId?: string;
    }
  ) => {
    sseBroadcaster.broadcast('config.constraints_updated', {
      departmentId: data.departmentId,
      constraints: data.constraints,
    }, { tenantId: data.tenantId });
  },
};

// ============================================================================
// Combined Export
// ============================================================================

export const sse = {
  broadcaster: sseBroadcaster,
  schedule: scheduleSSE,
  staff: staffSSE,
  team: teamSSE,
  config: configSSE,
};
