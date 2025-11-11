/**
 * Centralized SSE Event System
 * 모든 SSE 이벤트 타입과 페이로드를 중앙에서 관리
 */

// ============================================================================
// SSE 이벤트 타입 정의
// ============================================================================

export type SSEEventType =
  // Schedule 관련
  | 'schedule.published'
  | 'schedule.updated'
  | 'schedule.generated'
  | 'schedule.archived'
  | 'schedule.deleted'
  | 'schedule.version_updated'

  // Staff/User 관련
  | 'staff.created'
  | 'staff.updated'
  | 'staff.deleted'
  | 'staff.career_updated'

  // Team 관련
  | 'team.created'
  | 'team.updated'
  | 'team.deleted'
  | 'team.member_added'
  | 'team.member_removed'

  // Config 관련
  | 'config.updated'
  | 'config.shift_types_updated'
  | 'config.constraints_updated'

  // Swap 관련 (이미 구현됨)
  | 'swap.requested'
  | 'swap.approved'
  | 'swap.rejected'

  // Handoff 관련 (이미 구현됨)
  | 'handoff.submitted'
  | 'handoff.completed'
  | 'handoff.critical_patient'

  // Notification 관련
  | 'notification'

  // System 관련
  | 'ping'
  | 'connected';

// ============================================================================
// SSE 이벤트 페이로드 정의
// ============================================================================

export interface SSEEventPayload {
  'schedule.published': {
    scheduleId: string;
    departmentId?: string;
    startDate: Date | string;
    endDate: Date | string;
    publishedBy: string;
  };

  'schedule.updated': {
    scheduleId: string;
    departmentId?: string;
    action?: 'invalidate' | 'refresh';
    queries?: string[];
  };

  'schedule.generated': {
    scheduleId: string;
    departmentId: string;
    generatedBy: string;
  };

  'schedule.archived': {
    scheduleId: string;
    departmentId?: string;
  };

  'schedule.deleted': {
    scheduleId: string;
    departmentId?: string;
    deleted: boolean;
  };

  'schedule.version_updated': {
    scheduleId: string;
    version: number;
    reason: string;
    changes?: unknown;
  };

  'staff.created': {
    userId: string;
    departmentId?: string;
    name: string;
    role: string;
  };

  'staff.updated': {
    userId: string;
    departmentId?: string;
    fields: string[];
    changes?: Record<string, unknown>;
  };

  'staff.deleted': {
    userId: string;
    departmentId?: string;
  };

  'staff.career_updated': {
    userId: string;
    departmentId?: string;
    careerInfo: {
      hireYear?: number;
      yearsOfService?: number;
    };
  };

  'team.created': {
    teamId: string;
    departmentId?: string;
    name: string;
  };

  'team.updated': {
    teamId: string;
    departmentId?: string;
    changes?: Record<string, unknown>;
  };

  'team.deleted': {
    teamId: string;
    departmentId?: string;
  };

  'team.member_added': {
    teamId: string;
    userId: string;
    departmentId?: string;
  };

  'team.member_removed': {
    teamId: string;
    userId: string;
    departmentId?: string;
  };

  'config.updated': {
    configKey: string;
    departmentId?: string;
    category?: string;
  };

  'config.shift_types_updated': {
    departmentId?: string;
    shiftTypes: unknown[];
  };

  'config.constraints_updated': {
    departmentId?: string;
    constraints: unknown[];
  };

  'swap.requested': {
    swapId: string;
    requesterId: string;
    targetId?: string;
  };

  'swap.approved': {
    swapId: string;
    approvedBy: string;
  };

  'swap.rejected': {
    swapId: string;
    rejectedBy: string;
  };

  'handoff.submitted': {
    handoffId: string;
    departmentId?: string;
  };

  'handoff.completed': {
    handoffId: string;
    departmentId?: string;
  };

  'handoff.critical_patient': {
    handoffId: string;
    patientId: string;
    severity: string;
  };

  'notification': {
    [key: string]: unknown;
  };

  'ping': Record<string, never>;
  'connected': {
    clientId: string;
    userId?: string;
    timestamp: number;
    activeConnections?: number;
  };
}

// ============================================================================
// SSE 이벤트 구조
// ============================================================================

export interface SSEEvent<T extends SSEEventType = SSEEventType> {
  type: T;
  data: SSEEventPayload[T];
  userId?: string;
  tenantId?: string;
  timestamp: number;
}

// ============================================================================
// 쿼리 무효화 매핑
// ============================================================================

/**
 * SSE 이벤트 → 무효화할 tRPC 쿼리 매핑
 */
export const EVENT_TO_QUERIES_MAP: Record<SSEEventType, string[]> = {
  // Schedule 이벤트
  'schedule.published': [
    'schedule.list',
    'schedule.getPageData',
    'schedule.get',
    'schedule.getDashboardData',
    'schedule.getTodayAssignments',
  ],
  'schedule.updated': [
    'schedule.list',
    'schedule.getPageData',
    'schedule.get',
    'schedule.getDashboardData',
  ],
  'schedule.generated': [
    'schedule.list',
    'schedule.get',
  ],
  'schedule.archived': [
    'schedule.list',
  ],
  'schedule.deleted': [
    'schedule.list',
    'schedule.getPageData',
  ],
  'schedule.version_updated': [
    'schedule.get',
  ],

  // Staff 이벤트
  'staff.created': [
    'staff.list',
    'schedule.getPageData',
    'tenant.users.list',
  ],
  'staff.updated': [
    'staff.list',
    'staff.get',
    'schedule.getPageData',
    'tenant.users.list',
    'tenant.users.get',
    'tenant.users.current',
  ],
  'staff.deleted': [
    'staff.list',
    'schedule.getPageData',
    'tenant.users.list',
  ],
  'staff.career_updated': [
    'staff.list',
    'staff.get',
    'tenant.users.list',
    'tenant.users.get',
    'tenant.users.current',
  ],

  // Team 이벤트
  'team.created': [
    'teams.getAll',
    'schedule.getPageData',
  ],
  'team.updated': [
    'teams.getAll',
  ],
  'team.deleted': [
    'teams.getAll',
    'schedule.getPageData',
  ],
  'team.member_added': [
    'teams.getAll',
    'staff.list',
    'schedule.getPageData',
  ],
  'team.member_removed': [
    'teams.getAll',
    'staff.list',
    'schedule.getPageData',
  ],

  // Config 이벤트
  'config.updated': [
    'configs.getAll',
    'configs.getByKey',
  ],
  'config.shift_types_updated': [
    'configs.getAll',
    'configs.getByKey',
    'schedule.list',
    'schedule.getPageData',
  ],
  'config.constraints_updated': [
    'configs.getAll',
    'configs.getByKey',
  ],

  // Swap 이벤트 (이미 구현됨)
  'swap.requested': [
    'swap.list',
    'swap.getById',
  ],
  'swap.approved': [
    'swap.list',
    'swap.getById',
    'schedule.getPageData',
  ],
  'swap.rejected': [
    'swap.list',
    'swap.getById',
  ],

  // Handoff 이벤트 (이미 구현됨)
  'handoff.submitted': [
    'handoff.list',
  ],
  'handoff.completed': [
    'handoff.list',
  ],
  'handoff.critical_patient': [
    'handoff.getById',
  ],

  // Notification
  'notification': [
    'notifications.getUserInbox',
  ],

  // System
  'ping': [],
  'connected': [],
};

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * SSE 이벤트 생성 헬퍼
 */
export function createSSEEvent<T extends SSEEventType>(
  type: T,
  data: SSEEventPayload[T],
  options?: {
    userId?: string;
    tenantId?: string;
  }
): SSEEvent<T> {
  return {
    type,
    data,
    userId: options?.userId,
    tenantId: options?.tenantId,
    timestamp: Date.now(),
  };
}

/**
 * 특정 이벤트 타입에 대한 무효화 쿼리 목록 반환
 */
export function getQueriesToInvalidate(eventType: SSEEventType): string[] {
  return EVENT_TO_QUERIES_MAP[eventType] || [];
}
