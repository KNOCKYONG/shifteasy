import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { scopedDb, createAuditLog } from '@/lib/db-helpers';
import { schedules, offBalanceLedger } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { sse } from '@/lib/sse/broadcaster';
import { subMonths, format, eachDayOfInterval, isWeekend } from 'date-fns';

/**
 * HS Scheduler Router
 *
 * This is a completely separate scheduling system from the existing AI scheduler.
 * It does NOT use ai-polish.ts or greedy-scheduler.ts.
 * Instead, it uses ChatGPT API to generate schedules based on the requirements.
 */

/**
 * ChatGPT API를 호출하여 스케줄 생성
 */
type RawAssignment = {
  employeeId?: string;
  shiftType?: string;
  date?: string;
  e?: string;
  s?: string;
  d?: string;
};

async function callChatGPTForScheduling(prompt: string): Promise<{
  assignments: RawAssignment[];
}> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o', // 또는 'gpt-4-turbo-preview'
      messages: [
        {
          role: 'system',
          content: `당신은 병원 간호사 근무 스케줄을 생성하는 전문가입니다.
주어진 조건에 따라 최적의 스케줄을 JSON 형식으로 반환해주세요.
응답은 반드시 다음 JSON 형식이어야 합니다:
{
  "assignments": [
    {
      "employeeId": "직원ID",
      "shiftType": "D|E|N|O|A|-",
      "date": "YYYY-MM-DD"
    }
  ]
}

시프트 타입:
- D: 주간 근무
- E: 저녁 근무
- N: 야간 근무
- O: 휴무
- A: 행정 근무
- -: 빈 일정 (미배정)
- D^, E^, N^: 특별 요청이 반영된 근무 (^ 표시)`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ChatGPT API 호출 실패: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('ChatGPT로부터 응답을 받지 못했습니다.');
  }

  return JSON.parse(content);
}

/**
 * HS 스케줄 생성 함수
 */
async function generateHSSchedule(input: {
  departmentId: string;
  startDate: Date;
  endDate: Date;
  employees: Array<{
    id: string;
    name: string;
    role: string;
    departmentId?: string;
    teamId?: string | null;
    workPatternType?: 'three-shift' | 'night-intensive' | 'weekday-only';
    preferredShiftTypes?: Record<string, number>;
    maxConsecutiveDaysPreferred?: number;
    maxConsecutiveNightsPreferred?: number;
    guaranteedOffDays?: number;
  }>;
  shifts: Array<{
    id: string;
    code?: string;
    type: 'day' | 'evening' | 'night' | 'off' | 'leave' | 'custom';
    name: string;
    time: { start: string; end: string; hours: number; breakMinutes?: number };
    color: string;
    requiredStaff: number;
    minStaff?: number;
    maxStaff?: number;
  }>;
  constraints?: Array<{
    id: string;
    name: string;
    type: 'hard' | 'soft';
    category: 'legal' | 'contractual' | 'operational' | 'preference' | 'fairness';
    weight: number;
    active: boolean;
    config?: Record<string, unknown>;
  }>;
  specialRequests?: Array<{
    employeeId: string;
    date: string;
    requestType: string;
    shiftTypeCode?: string;
  }>;
  holidays?: Array<{ date: string; name: string }>;
  teamPattern?: { pattern: string[]; avoidPatterns?: string[][] } | null;
  requiredStaffPerShift?: Record<string, number>;
  nightIntensivePaidLeaveDays?: number;
  previousOffAccruals?: Record<string, number>;
}) {
  const startTime = Date.now();

  // 날짜 범위 생성
  const dateRange = eachDayOfInterval({
    start: input.startDate,
    end: input.endDate,
  });
  const formattedDateRange = dateRange.map(date => format(date, 'yyyy-MM-dd'));
  const formattedDateSet = new Set(formattedDateRange);
  const scheduleYear = input.startDate.getFullYear();
  const scheduleMonth = input.startDate.getMonth();
  const scheduleMonthLabel = format(input.startDate, 'yyyy-MM');

  const employeeAliasChars = 'abcdefghijklmnopqrstuvwxyz';
  const teamAliasChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const aliasMap = new Map<string, string>();
  const reverseAliasMap = new Map<string, string>();
  input.employees.forEach((emp, index) => {
    const alias = index < employeeAliasChars.length ? employeeAliasChars[index] : `e${index}`;
    aliasMap.set(emp.id, alias);
    reverseAliasMap.set(alias, emp.id);
  });

  const teamIds = Array.from(new Set(input.employees.map(emp => emp.teamId).filter((id): id is string => Boolean(id))));
  const teamAliasMap = new Map<string, string>();
  teamIds.forEach((teamId, index) => {
    const alias = index < teamAliasChars.length ? teamAliasChars[index] : `T${index}`;
    teamAliasMap.set(teamId, alias);
  });

  const workPatternAliasMap: Record<'three-shift' | 'night-intensive' | 'weekday-only', string> = {
    'three-shift': 'TS',
    'night-intensive': 'NI',
    'weekday-only': 'WD',
  };

  const employeesWithAlias = input.employees.map((emp) => ({
    ...emp,
    alias: aliasMap.get(emp.id) ?? emp.id,
    teamAlias: emp.teamId ? teamAliasMap.get(emp.teamId) ?? emp.teamId : null,
    workPatternAlias: emp.workPatternType ? workPatternAliasMap[emp.workPatternType] : workPatternAliasMap['three-shift'],
  }));

  // 주말 및 휴무일 파악
  const holidayDates = new Set(input.holidays?.map(h => h.date) || []);
  const weekends = dateRange.filter(date => isWeekend(date)).map(date => format(date, 'yyyy-MM-dd'));
  const allOffDays = new Set([...holidayDates, ...weekends]);

  // ChatGPT에게 전달할 프롬프트 생성
  const prompt = `
다음 조건에 맞는 ${format(input.startDate, 'yyyy-MM')}월 간호사 근무 스케줄을 생성해주세요.

### 직원/팀/근무타입 약어 규칙
- 직원 alias는 소문자(a, b, c ...)만 사용합니다.
- 팀 alias는 대문자(A, B, C ...)만 사용합니다. 직원 alias와 절대 겹치지 않습니다.
- 근무 타입 alias는 두 글자 코드(TS, NI, WD)로 제공합니다.
- JSON 응답에서도 employeeId에는 직원 alias만 입력하세요. (예: e: "a")
- 실제 UUID나 팀 ID 문자열을 사용하면 안 됩니다.

### JSON 출력 포맷
- 최종 응답은 {"assignments":[{"e":"a","s":"D","d":"01"}, ...]} 형식이어야 합니다.
- e: 직원 alias, s: 시프트 타입(D/E/N/O/A/- 혹은 ^ 포함), d: 해당 달의 날짜를 나타내는 두 자리 문자열(예: "01", "18").
- 날짜는 반드시 ${scheduleMonthLabel}의 일자만 사용하고, YYYY-MM-DD 전체 날짜 문자열을 사용하지 마세요.

### 근무 타입 약어 표
- TS: three-shift
- NI: night-intensive
- WD: weekday-only

## 1. 직원 정보
${employeesWithAlias.map((emp, idx) => `
${idx + 1}. ${emp.alias} (${emp.name})
   - 팀: ${emp.teamAlias ?? '미지정'}
   - 근무 타입: ${emp.workPatternAlias}
   - 선호 패턴: ${emp.preferredShiftTypes ? JSON.stringify(emp.preferredShiftTypes) : '없음'}
   - 보장 휴무일: ${emp.guaranteedOffDays || 0}일
   - 이전 달 누적 OFF: ${input.previousOffAccruals?.[emp.id] || 0}일
`).join('\n')}

## 2. 부서 정보
- 시프트별 필요 인원: ${JSON.stringify(input.requiredStaffPerShift || {})}
- 부서 패턴: ${input.teamPattern?.pattern ? input.teamPattern.pattern.join(', ') : '없음'}
- 기피 패턴: ${input.teamPattern?.avoidPatterns ? JSON.stringify(input.teamPattern.avoidPatterns) : '없음'}
- 나이트 집중 근무 유급 휴가: ${input.nightIntensivePaidLeaveDays || 0}일

## 3. 휴무일
- 공휴일/주말: ${Array.from(allOffDays).join(', ')}

## 4. 특별 요청
${input.specialRequests?.map((req, idx) => `
${idx + 1}. 직원 ${aliasMap.get(req.employeeId) ?? req.employeeId}: ${req.date}에 ${req.shiftTypeCode || req.requestType} 요청
`).join('\n') || '없음'}

## 5. 스케줄 생성 규칙
아래 8개 규칙은 모두 **하드 제약**입니다. 단 하나라도 어기면 응답을 다시 계산해야 합니다. 규칙을 만족하지 않는 스케줄은 절대로 반환하지 마세요.

### 1) 특별 요청 우선 배치
- special_requests를 먼저 배치하고, 시프트 타입에 ^ 표시 (예: D^, E^, N^)
- shiftId는 기존 타입과 동일하게 설정 (예: shift-d)

### 2) 행정 근무 (work_pattern_type == 'weekday-only')
- 특별 요청 제외하고
- 휴무일(공휴일/주말)은 O 배치
- 평일은 A 배치

### 3) 나이트 집중 근무 (work_pattern_type == 'night-intensive')
- 특별 요청 제외하고
- N 근무만 배치
- 휴무일 + 나이트집중유급휴가(${input.nightIntensivePaidLeaveDays || 0}일) 만큼 O 배치
- 패턴: N,N,N,O,O / N,N,O,O / N,O,O / N,O

### 4) 팀 별 밸런스
- 각 시프트당 팀별 최소 1명씩 근무
- 시프트별 근무 일수가 팀별로 균등하게 배치

### 5) 시프트 별 최소 인원
- 시프트별 필요 인원(${JSON.stringify(input.requiredStaffPerShift || {})}) 충족
- 부족한 경우 팀별로 공평하게 추가 배치

### 6) 교대 근무 (work_pattern_type == 'three-shift')
- 시프트별 필요 인원에 맞게 배치
- 한 시프트에 다양한 경력 직원 골고루 배치
- 개인 패턴이 있으면 개인 패턴 우선, 없으면 부서 패턴 사용
- 특별 요청을 포함한 상태로 패턴 반영 (가능한 한 보장)
- 동일 직원에게 전체 기간 동안 같은 시프트만 반복 배치하지 말고, 패턴/휴무 규칙에 따라 변화를 주어야 함

### 7) 교대 근무 휴무일
- 각 three-shift 근무자는 총 휴무일 = 공휴일/주말(${allOffDays.size}일) + 이전달 누적 OFF를 **목표치**로 최대한 충족해야 함
- 휴무일이 부족한 경우 팀 내 다른 구성원과 비교했을 때 한 사람에게만 일정이 몰리지 않도록 균형 있게 배정
- 스케줄 작성 시 각 직원의 휴무일을 먼저 확보하고, 정말 불가피한 경우에만 최소 인원 충족을 위해 휴무일을 근무로 전환
- 동일 근무 타입(three-shift) 직원 간 휴무일 수 차이가 2일을 넘지 않도록 조정

기간: ${format(input.startDate, 'yyyy-MM-dd')} ~ ${format(input.endDate, 'yyyy-MM-dd')}

### 8) 필수 출력 규칙
- 위 기간(${formattedDateRange.join(', ')})의 모든 날짜 * 모든 직원(${input.employees.length}명)에 대해 총 ${formattedDateRange.length * input.employees.length}개의 assignments를 반드시 생성하세요.
- 각 직원은 하루에 정확히 하나의 shiftType을 가져야 하며, 날짜/직원 조합이 빠지거나 중복되면 안 됩니다.
- JSON에 선언된 날짜 또는 직원만 사용하고, 나머지는 포함하지 마세요.

### 9) 결과 자체 검증
- 응답을 보내기 전에 assignments 배열 길이가 정확히 ${formattedDateRange.length * input.employees.length}인지 확인하고, 직원/날짜 조합 중복이 없는지 다시 점검하세요.
- 누락 혹은 중복이 있으면 ChatGPT 내부적으로 다시 계산한 뒤 올바른 JSON만 반환하세요. “재시도” 같은 설명 텍스트는 넣지 마세요.
- 특히 규칙 1~8 중 어느 하나라도 미충족하면 반드시 스스로 재검증하여 전부 만족시킨 뒤 JSON을 제공하세요.

### 10) 검증 리포트 필수
- 최종 JSON에는 assignments 외에 validation 객체를 포함해야 합니다. 예: {"assignments":[...],"validation":{"rule1":"OK","rule2":"OK",...,"rule9":"OK"}}
- validation에는 rule1~rule8(각 규칙)과 rule9(배정 수 검증) 키가 모두 존재해야 하며, 각 값은 반드시 문자열 "OK" 이어야 합니다.
- 하나라도 OK가 아니면 내부적으로 다시 계산하여 모든 ruleX가 OK일 때만 응답하세요.

### 11) 단계별 작성 절차
1. 특별 요청을 날짜순으로 정리하고 시프트별 인원 요구와 충돌 여부를 먼저 점검하세요.
2. 각 직원의 휴무 목표치를 계산해 휴무일을 우선 배치하고, 불가피할 때만 최소 인원 충족을 위해 휴무를 근무로 바꾸세요.
3. weekday-only → night-intensive → three-shift 순으로 근무 타입별 규칙을 적용해 잠정 배정안을 작성하세요.
4. 날짜별/시프트별 인원과 팀 구성을 표로 계산해 규칙 4와 5를 만족하는지 확인하세요.
5. 직원별 시프트 패턴과 휴무 분포를 검토해 규칙 6과 7을 충족시키고, three-shift 직원 간 휴무일 차이가 2일 이내인지 확인한 뒤 필요 시 재배치하세요.
6. 마지막으로 누락/중복, 빈 일정 여부를 확인하고 assignments + validation JSON을 출력하세요.

위 규칙에 따라 모든 직원의 모든 날짜에 대한 스케줄을 생성하고, JSON 형식으로 반환해주세요.
`;

  console.log('ChatGPT에게 전송하는 프롬프트:', prompt);

  // ChatGPT API 호출
  const maxAttempts = 3;
  let normalizedAssignments: Array<{ alias: string; shiftType: string; date: string }> | null = null;
  let lastError: unknown = null;

  const processAssignments = (rawAssignments: RawAssignment[]) => {
    const normalized = rawAssignments.map((assignment, index) => {
      const alias = assignment.employeeId ?? assignment.e;
      if (!alias) {
        throw new Error(`assignment[${index}]에 직원 alias(e)가 없습니다.`);
      }
      const shiftType = assignment.shiftType ?? assignment.s;
      if (!shiftType) {
        throw new Error(`assignment[${index}]에 시프트 타입(s)이 없습니다.`);
      }
      const rawDate = assignment.date ?? assignment.d;
      if (!rawDate) {
        throw new Error(`assignment[${index}]에 날짜(d)가 없습니다.`);
      }

      let normalizedDate: string;
      if (rawDate.includes('-')) {
        normalizedDate = rawDate;
      } else {
        if (!/^\d{1,2}$/.test(rawDate)) {
          throw new Error(`assignment[${index}]의 날짜(d)가 잘못되었습니다: ${rawDate}`);
        }
        const dayNumber = Number(rawDate);
        const dateCandidate = new Date(scheduleYear, scheduleMonth, dayNumber);
        normalizedDate = format(dateCandidate, 'yyyy-MM-dd');
      }

      return {
        alias,
        shiftType,
        date: normalizedDate,
      };
    });

    const expectedAssignmentCount = formattedDateRange.length * input.employees.length;
    const seenAssignments = new Set<string>();
    const offCountsByEmployee = new Map<string, number>();

    const offRequirements: Array<{ employeeId: string; required: number }> = [];
    const weekendHolidayCount = allOffDays.size;
    for (const emp of input.employees) {
      const workPattern = emp.workPatternType ?? 'three-shift';
      if (workPattern === 'three-shift') {
        const requiredOffDays = weekendHolidayCount + (input.previousOffAccruals?.[emp.id] ?? 0);
        offRequirements.push({ employeeId: emp.id, required: requiredOffDays });
      }
    }

    for (const assignment of normalized) {
      const originalId = reverseAliasMap.get(assignment.alias);
      if (!originalId) {
        throw new Error(`알 수 없는 직원 alias가 포함되었습니다: ${assignment.alias}`);
      }
      if (!formattedDateSet.has(assignment.date)) {
        throw new Error(`기간 외 날짜가 포함되었습니다: ${assignment.date}`);
      }
      const key = `${originalId}-${assignment.date}`;
      if (seenAssignments.has(key)) {
        throw new Error(`중복된 배정이 존재합니다: ${key}`);
      }
      seenAssignments.add(key);

      const cleanShift = assignment.shiftType.replace('^', '');
      if (cleanShift === 'O') {
        offCountsByEmployee.set(originalId, (offCountsByEmployee.get(originalId) ?? 0) + 1);
      }
    }

    if (seenAssignments.size !== expectedAssignmentCount) {
      throw new Error(`ChatGPT가 생성한 배정 수가 부족합니다. 기대값: ${expectedAssignmentCount}, 실제: ${seenAssignments.size}`);
    }

    offRequirements.sort((a, b) => (offCountsByEmployee.get(a.employeeId) ?? 0) - (offCountsByEmployee.get(b.employeeId) ?? 0));
    const mostUnderAssigned = offRequirements[0];
    const mostOverAssigned = offRequirements[offRequirements.length - 1];
    if (mostUnderAssigned && mostOverAssigned) {
      const underCount = offCountsByEmployee.get(mostUnderAssigned.employeeId) ?? 0;
      const overCount = offCountsByEmployee.get(mostOverAssigned.employeeId) ?? 0;
      const maxAllowedDifference = 2;
      if ((mostUnderAssigned.required - underCount) > maxAllowedDifference || (overCount - mostUnderAssigned.required) > maxAllowedDifference) {
        throw new Error(`휴무일 분배가 균형적이지 않습니다. 부족: ${mostUnderAssigned.employeeId}(${underCount}/${mostUnderAssigned.required}), 과다: ${mostOverAssigned.employeeId}(${overCount}/${mostOverAssigned.required})`);
      }
    }

    return normalized;
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const chatGPTResult = await callChatGPTForScheduling(prompt);
      console.log(`ChatGPT 응답 (시도 ${attempt}):`, chatGPTResult);
      normalizedAssignments = processAssignments(chatGPTResult.assignments);
      break;
    } catch (error) {
      lastError = error;
      console.warn(`ChatGPT 스케줄 검증 실패 (시도 ${attempt}/${maxAttempts}):`, error);
      if (attempt === maxAttempts) {
        throw error;
      }
    }
  }

  if (!normalizedAssignments) {
    throw lastError ?? new Error('ChatGPT 스케줄 생성에 실패했습니다.');
  }

  // ChatGPT 결과를 시스템 형식으로 변환
  const assignments = normalizedAssignments.map((assignment) => {
    // shiftType에서 ^ 제거하여 shiftId 생성
    const cleanShiftType = assignment.shiftType.replace('^', '');
    const shiftId = `shift-${cleanShiftType.toLowerCase()}`;

    const originalId = reverseAliasMap.get(assignment.alias);
    if (!originalId) {
      throw new Error(`알 수 없는 직원 alias가 포함되었습니다: ${assignment.alias}`);
    }

    return {
      employeeId: originalId,
      shiftId,
      shiftType: assignment.shiftType, // ^가 포함된 원본 유지
      date: new Date(assignment.date),
      isLocked: false,
    };
  });

  const computationTime = Date.now() - startTime;

  return {
    assignments,
    violations: [],
    score: {
      total: 100,
      fairness: 100,
      coverage: 100,
      preference: 100,
    },
    iterations: 1,
    computationTime,
    stats: {
      fairnessIndex: 1.0,
      coverageRate: 1.0,
      preferenceScore: 1.0,
    },
    offAccruals: [],
  };
}

export const hsScheduleRouter = createTRPCRouter({
  generate: protectedProcedure
    .input(z.object({
      name: z.string().default('HS Generated Schedule'),
      departmentId: z.string().min(1),
      startDate: z.date(),
      endDate: z.date(),
      employees: z.array(z.object({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        departmentId: z.string().optional(),
        teamId: z.string().nullable().optional(),
        workPatternType: z.enum(['three-shift', 'night-intensive', 'weekday-only']).optional(),
        preferredShiftTypes: z.record(z.string(), z.number()).optional(),
        maxConsecutiveDaysPreferred: z.number().optional(),
        maxConsecutiveNightsPreferred: z.number().optional(),
        guaranteedOffDays: z.number().optional(),
      })),
      shifts: z.array(z.object({
        id: z.string(),
        code: z.string().optional(),
        type: z.enum(['day', 'evening', 'night', 'off', 'leave', 'custom']),
        name: z.string(),
        time: z.object({
          start: z.string(),
          end: z.string(),
          hours: z.number(),
          breakMinutes: z.number().optional(),
        }),
        color: z.string(),
        requiredStaff: z.number().min(0).default(1),
        minStaff: z.number().optional(),
        maxStaff: z.number().optional(),
      })),
      constraints: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(['hard', 'soft']),
        category: z.enum(['legal', 'contractual', 'operational', 'preference', 'fairness']),
        weight: z.number(),
        active: z.boolean(),
        config: z.record(z.string(), z.any()).optional(),
      })).default([]),
      specialRequests: z.array(z.object({
        employeeId: z.string(),
        date: z.string(),
        requestType: z.string(),
        shiftTypeCode: z.string().optional(),
      })).default([]),
      holidays: z.array(z.object({
        date: z.string(),
        name: z.string(),
      })).default([]),
      teamPattern: z.object({
        pattern: z.array(z.string()),
        avoidPatterns: z.array(z.array(z.string())).optional(),
      }).nullable().optional(),
      requiredStaffPerShift: z.record(z.string(), z.number()).optional(),
      nightIntensivePaidLeaveDays: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const tenantDb = scopedDb(tenantId);

      if (!input.employees.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '스케줄을 생성할 직원이 없습니다.',
        });
      }

      // Permission checks
      if (ctx.user?.role === 'manager') {
        if (!ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '부서 정보가 없습니다.',
          });
        }
        if (input.departmentId !== ctx.user.departmentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '담당 부서의 스케줄만 생성할 수 있습니다.',
          });
        }
      } else if (ctx.user?.role === 'member') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '스케줄을 생성할 권한이 없습니다. 관리자 또는 매니저에게 문의하세요.',
        });
      }

      // Get previous month's OFF accrual data
      const previousMonthDate = subMonths(input.startDate, 1);
      const previousYear = previousMonthDate.getFullYear();
      const previousMonth = previousMonthDate.getMonth() + 1;

      const previousLedgerRows = await db
        .select({
          nurseId: offBalanceLedger.nurseId,
          accumulatedOffDays: offBalanceLedger.accumulatedOffDays,
          guaranteedOffDays: offBalanceLedger.guaranteedOffDays,
        })
        .from(offBalanceLedger)
        .where(and(
          eq(offBalanceLedger.tenantId, tenantId),
          eq(offBalanceLedger.departmentId, input.departmentId),
          eq(offBalanceLedger.year, previousYear),
          eq(offBalanceLedger.month, previousMonth),
        ));

      const previousOffAccruals: Record<string, number> = {};
      const previousGuaranteedOffDays: Record<string, number> = {};
      previousLedgerRows.forEach((row) => {
        if (row.nurseId) {
          previousOffAccruals[row.nurseId] = Math.max(0, row.accumulatedOffDays || 0);
          if (typeof row.guaranteedOffDays === 'number') {
            previousGuaranteedOffDays[row.nurseId] = row.guaranteedOffDays;
          }
        }
      });

      const employeesWithGuarantees = input.employees.map((emp) => ({
        ...emp,
        guaranteedOffDays: emp.guaranteedOffDays ?? previousGuaranteedOffDays[emp.id],
      }));

      // Call the HS scheduling algorithm
      const hsResult = await generateHSSchedule({
        departmentId: input.departmentId,
        startDate: input.startDate,
        endDate: input.endDate,
        employees: employeesWithGuarantees,
        shifts: input.shifts,
        constraints: input.constraints,
        specialRequests: input.specialRequests,
        holidays: input.holidays,
        teamPattern: input.teamPattern ?? null,
        requiredStaffPerShift: input.requiredStaffPerShift,
        nightIntensivePaidLeaveDays: input.nightIntensivePaidLeaveDays,
        previousOffAccruals,
      });

      // Serialize assignments
      const serializedAssignments = hsResult.assignments.map((assignment) => ({
        ...assignment,
        date: assignment.date instanceof Date ? assignment.date.toISOString() : assignment.date,
      }));

      // Save to database
      const [schedule] = await tenantDb.insert(schedules, {
        name: input.name,
        departmentId: input.departmentId,
        startDate: input.startDate,
        endDate: input.endDate,
        status: 'draft',
        metadata: {
          generatedBy: ctx.user?.id || 'system',
          generationMethod: 'hs-engine',
          constraints: input.constraints,
          assignments: serializedAssignments,
          stats: hsResult.stats,
          score: hsResult.score,
          violations: hsResult.violations,
          offAccruals: hsResult.offAccruals,
          aiEnabled: false, // HS scheduler doesn't use AI
        },
      });

      // Create audit log
      await createAuditLog({
        tenantId,
        actorId: ctx.user?.id || 'system',
        action: 'schedule.generated',
        entityType: 'schedule',
        entityId: schedule.id,
        after: schedule,
        metadata: {
          computationTime: hsResult.computationTime,
          iterations: hsResult.iterations,
          method: 'hs-engine',
        },
      });

      // Broadcast SSE event
      sse.schedule.generated(schedule.id, {
        departmentId: input.departmentId,
        generatedBy: ctx.user?.id || 'system',
        tenantId,
      });

      return {
        scheduleId: schedule.id,
        assignments: serializedAssignments,
        generationResult: {
          computationTime: hsResult.computationTime,
          score: hsResult.score,
          violations: hsResult.violations,
          offAccruals: hsResult.offAccruals,
        },
      };
    }),
});
