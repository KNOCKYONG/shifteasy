/**
 * AI Polish Module - AI로 생성된 스케줄을 보수적으로 미세 조정
 *
 * 기존 generateAiSchedule 결과를 받아 명백한 개선점만 적용한다.
 * (나이트 전담자 및 개별 요청/locked 배정은 절대 건드리지 않는다)
 */

import { performance } from 'perf_hooks';
import { format } from 'date-fns';
import type {
  ScheduleAssignment,
  ScheduleScore,
  Constraint,
  ConstraintViolation,
} from '@/lib/types/scheduler';
import type {
  AiScheduleRequest,
  AiScheduleGenerationResult,
  AiEmployee,
} from './greedy-scheduler';
import { extractFirstJsonBlock } from '@/lib/utils/ai-json';

export interface AIPolishResult {
  assignments: ScheduleAssignment[];
  score: ScheduleScore;
  improved: boolean;
  improvements: {
    type: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    confidence: number;
  }[];
  polishTime: number;
}

interface ObviousIssue {
  type: 'unfairness' | 'consecutive_nights' | 'preference_mismatch' | 'constraint_violation';
  description: string;
  fix: {
    action: 'swap' | 'adjust';
    employeeA: string;
    employeeB?: string;
    date: string;
    fromShift?: string;
    toShift: string;
  };
  impact: 'high' | 'medium' | 'low';
  confidence: number;
}

interface AnalysisAssignment {
  employeeId: string;
  date: string; // yyyy-MM-dd
  shiftId: string;
  shiftType?: string;
  isLocked: boolean;
  isSpecialRequest: boolean;
}

interface AnalysisEmployee {
  id: string;
  name?: string | null;
  preferences?: Record<string, number> | null;
  workPattern?: AiEmployee['workPatternType'];
  assignmentCount: number;
}

interface AnalysisSpecialRequest {
  employeeId: string;
  date: string; // yyyy-MM-dd
  requestType?: string;
  shiftCode?: string | null;
}

type RequiredStaffMap = Record<string, number>;

type ScheduleViolationSummary = Pick<
  ConstraintViolation,
  'constraintName' | 'severity' | 'message'
>;

interface AnalysisData {
  currentAssignments: AnalysisAssignment[];
  currentScore: ScheduleScore;
  violations: ScheduleViolationSummary[];
  employees: AnalysisEmployee[];
  constraints: Constraint[];
  requiredStaffPerShift?: RequiredStaffMap;
  specialRequests: AnalysisSpecialRequest[];
}

/**
 * AI를 사용하여 스케줄을 보수적으로 미세 조정
 */
export async function autoPolishWithAI(
  aiResult: AiScheduleGenerationResult,
  input: AiScheduleRequest
): Promise<AIPolishResult> {
  const startTime = performance.now();

  try {
    // 1. 점수가 이미 충분히 높다면 그대로 유지 (95점 이상)
    if (aiResult.score.total >= 95) {
      return {
        assignments: aiResult.assignments,
        score: aiResult.score,
        improved: false,
        improvements: [],
        polishTime: 0,
      };
    }

    // 2. AI 분석 입력 준비
    const analysisData = prepareAnalysisData(aiResult, input);

    // 3. OpenAI로 명백한 이슈 분석
    const analysis = await analyzeForObviousIssues(analysisData);

    // 4. 의뢰된 개선 중 명백한 이슈만 선별 (0.8 이상) + 개별 요청/locked 보호
    const highConfidenceIssues = (analysis.obviousIssues ?? []).filter((issue: ObviousIssue) => {
      // 신뢰도 체크
      if (issue.confidence < 0.8) {
        return false;
      }

      // 개별 요청 및 locked 배정 보호
      const affectedEmployees = [issue.fix.employeeA, issue.fix.employeeB].filter(Boolean);
      for (const employeeId of affectedEmployees) {
        const assignment = analysisData.currentAssignments.find(
          (a) => a.employeeId === employeeId && a.date === issue.fix.date
        );
        if (assignment && (assignment.isLocked || assignment.isSpecialRequest)) {
          console.log(
            `[AI Polish] Filtering out issue affecting protected assignment: ${employeeId} on ${issue.fix.date}`
          );
          return false;
        }
      }

      return true;
    });

    // 4-1. 나이트 집중 근무자(night-intensive)는 AI Polish 대상에서 제외
    const nightIntensiveEmployeeIds = new Set(
      input.employees
        .filter((emp: AiEmployee) => emp.workPatternType === 'night-intensive')
        .map((emp) => emp.id)
    );

    const filteredIssues = highConfidenceIssues.filter((issue) => {
      const { employeeA, employeeB } = issue.fix;
      const touchesNightIntensive =
        (employeeA && nightIntensiveEmployeeIds.has(employeeA)) ||
        (employeeB && nightIntensiveEmployeeIds.has(employeeB));

      if (touchesNightIntensive) {
        console.log(
          `[AI Polish] Skipping issue affecting night-intensive staff: ` +
            `${employeeA ?? ''}${employeeB ? ` / ${employeeB}` : ''} on ${issue.fix.date}`
        );
        return false;
      }

      return true;
    });

    if (filteredIssues.length === 0) {
      return {
        assignments: aiResult.assignments,
        score: aiResult.score,
        improved: false,
        improvements: [],
        polishTime: performance.now() - startTime,
      };
    }

    // 5. 교전 규칙 적용 (보호 규칙을 만족하는 이슈만 반영)
    const polishedAssignments = applyObviousFixes(
      aiResult.assignments,
      filteredIssues,
      nightIntensiveEmployeeIds
    );

    // 6. 점수 추정 (실제 재계산은 비용이 크므로 추정)
    const estimatedImprovement = estimateScoreImprovement(filteredIssues);
    const newScore: ScheduleScore = {
      ...aiResult.score,
      total: Math.min(100, aiResult.score.total + estimatedImprovement),
    };

    const polishTime = performance.now() - startTime;

    console.log(
      `[AI Polish] ${aiResult.score.total} → ${newScore.total} (+${estimatedImprovement}) in ${polishTime.toFixed(
        0
      )}ms`
    );

    // 보호 대상 통계 로깅
    const specialRequestCount = input.specialRequests?.length || 0;
    const lockedCount = aiResult.assignments.filter((a) => a.isLocked).length;
    console.log(
      `[AI Polish] Protected assignments: ${specialRequestCount} special requests, ${lockedCount} locked`
    );
    console.log(
      `[AI Polish] Applied ${filteredIssues.length} improvements (after night-intensive filtering)`
    );

    return {
      assignments: polishedAssignments,
      score: newScore,
      improved: true,
      improvements: filteredIssues.map((issue: ObviousIssue) => ({
        type: issue.type,
        description: issue.description,
        impact: issue.impact,
        confidence: issue.confidence,
      })),
      polishTime,
    };
  } catch (error) {
    console.error('[AI Polish] Error:', error);
    // 에러 시 원본 스케줄 반환 (Fail-safe)
    return {
      assignments: aiResult.assignments,
      score: aiResult.score,
      improved: false,
      improvements: [],
      polishTime: performance.now() - startTime,
    };
  }
}

/**
 * AI 분석에 사용할 요약 데이터 준비
 */
function prepareAnalysisData(
  aiResult: AiScheduleGenerationResult,
  input: AiScheduleRequest
): AnalysisData {
  // 직원별 배정 건수 계산
  const employeeAssignmentCounts = new Map<string, number>();
  aiResult.assignments.forEach((assignment) => {
    const count = employeeAssignmentCounts.get(assignment.employeeId) ?? 0;
    employeeAssignmentCounts.set(assignment.employeeId, count + 1);
  });

  // 개별 요청 키 (employeeId-date)
  const specialRequestKeys = new Set<string>();
  input.specialRequests?.forEach((req) => {
    specialRequestKeys.add(`${req.employeeId}-${req.date}`);
  });

  // 배정 + 보호 여부 플래그
  const enhancedAssignments: AnalysisAssignment[] = aiResult.assignments.slice(0, 50).map((assignment) => {
    const dateStr = format(assignment.date, 'yyyy-MM-dd');
    const key = `${assignment.employeeId}-${dateStr}`;
    return {
      employeeId: assignment.employeeId,
      date: dateStr,
      shiftId: assignment.shiftId,
      shiftType: assignment.shiftType,
      isLocked: assignment.isLocked ?? false,
      isSpecialRequest: specialRequestKeys.has(key) || assignment.isLocked === true,
    };
  });

  return {
    currentAssignments: enhancedAssignments,
    currentScore: aiResult.score,
    violations: aiResult.violations.slice(0, 10).map((violation) => ({
      constraintName: violation.constraintName,
      severity: violation.severity,
      message: violation.message,
    })),
    employees: input.employees.slice(0, 20).map((emp: AiEmployee) => ({
      id: emp.id,
      name: emp.name,
      preferences: emp.preferredShiftTypes,
      workPattern: emp.workPatternType,
      assignmentCount: employeeAssignmentCounts.get(emp.id) ?? 0,
    })),
    constraints: input.constraints?.slice(0, 10) ?? [],
    requiredStaffPerShift: input.requiredStaffPerShift ?? undefined,
    specialRequests:
      input.specialRequests?.slice(0, 20).map((req) => ({
        employeeId: req.employeeId,
        date: req.date,
        requestType: req.requestType,
        shiftCode: req.shiftTypeCode,
      })) ?? [],
  };
}

/**
 * OpenAI를 사용하여 명백한 이슈 분석
 */
async function analyzeForObviousIssues(
  data: AnalysisData
): Promise<{ obviousIssues: ObviousIssue[] }> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[AI Polish] OPENAI_API_KEY not configured, skipping AI analysis');
    return { obviousIssues: [] };
  }

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = buildAnalysisPrompt(data);

    const response = await client.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              '당신은 매우 보수적인 근무 스케줄 개선 전문가입니다.\n\n' +
              '핵심 규칙:\n' +
              '1. isSpecialRequest: true 배정은 어떤 이유로도 변경하지 않습니다.\n' +
              '2. isLocked: true 배정은 어떤 이유로도 변경하지 않습니다.\n' +
              '3. workPatternType === "night-intensive" 직원의 배정은 변경하지 않습니다 (N, OFF, 유급휴가 패턴 유지).\n' +
              '4. 명백하고 단순하게 고칠 수 있는 문제만 제안합니다.\n\n' +
              '반드시 유효한 JSON 형식으로만 응답하세요.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 2000,
      },
      {
        timeout: 5000,
      }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { obviousIssues: [] };
    }

    const jsonText = extractFirstJsonBlock(content);
    if (!jsonText) {
      console.warn('[AI Polish] No JSON block found in AI response');
      return { obviousIssues: [] };
    }

    const parsed = JSON.parse(jsonText) as { obviousIssues?: ObviousIssue[] };
    if (!parsed || !Array.isArray(parsed.obviousIssues)) {
      console.warn('[AI Polish] Parsed AI response missing obviousIssues array');
      return { obviousIssues: [] };
    }

    return { obviousIssues: parsed.obviousIssues };
  } catch (error) {
    console.error('[AI Polish] OpenAI API error:', error);
    return { obviousIssues: [] };
  }
}

/**
 * AI 분석 프롬프트 생성
 */
function buildAnalysisPrompt(data: AnalysisData): string {
  const protectedLines = data.currentAssignments
    .filter((a) => a.isSpecialRequest || a.isLocked)
    .slice(0, 15)
    .map(
      (a) =>
        `- ${a.employeeId}: ${a.date} ${a.shiftId} (protected: ${
          a.isSpecialRequest ? 'special-request' : 'locked'
        })`
    )
    .join('\n');

  const specialRequestSection =
    data.specialRequests
      .slice(0, 10)
      .map(
        (req) =>
          `- ${req.employeeId}: ${req.date} ${req.shiftCode ?? req.requestType ?? ''} 요청 (protected)`
      )
      .join('\n') || '(없음)';

  const employeeSection = data.employees
    .slice(0, 10)
    .map((e) => {
      const prefs = e.preferences ? Object.keys(e.preferences).join(', ') : '없음';
      return `- ${e.name ?? '이름 미등록'} (ID: ${e.id})
  - 근무 패턴: ${e.workPattern ?? '지정되지 않음'}
  - 배정 건수: ${e.assignmentCount}
  - 선호 시프트: ${prefs}`;
    })
    .join('\n');

  const violationsSection = data.violations
    .slice(0, 5)
    .map((v) => `- [${v.severity}] ${v.constraintName}: ${v.message}`)
    .join('\n');

  return `
다음 근무 스케줄에서 **명백하고 간단하게 고칠 수 있는 문제**만 찾아주세요.

## 현재 점수
- 총점: ${data.currentScore.total}/100
  - 공정성: ${data.currentScore.fairness}
  - 커버리지: ${data.currentScore.coverage}
  - 선호도: ${data.currentScore.preference}
- 위반 요약: ${data.violations.length}건

## 보호 대상 배정 (절대 변경 금지)
${protectedLines || '(없음)'}

## 개별 요청 목록 (절대 변경 금지)
${specialRequestSection}

## 직원 정보
${employeeSection}

## 주요 위반 요약
${violationsSection}

## 찾을 문제 (보호 배정/나이트 전담 제외)
1. 불공정한 근무 분배 - 특정 직원의 배정 건수가 다른 직원보다 50% 이상 많은 경우
2. 불필요한 연속 야간 - 3일 이상 연속 야간 근무가 있는 경우 (개별 요청이 아닌 경우)
3. 명백한 선호 무시 - 선호 시프트가 있는데 전혀 배정되지 않은 경우
4. 간단한 스왑/조정만으로 해결 가능한 케이스

## 응답 형식 (JSON)
{
  "obviousIssues": [
    {
      "type": "unfairness | consecutive_nights | preference_mismatch | constraint_violation",
      "description": "구체적인 문제 설명",
      "fix": {
        "action": "swap | adjust",
        "employeeA": "직원ID",
        "employeeB": "직원ID (swap인 경우, 아니면 생략 가능)",
        "date": "YYYY-MM-DD",
        "fromShift": "현재 시프트(조정인 경우)",
        "toShift": "변경할 시프트"
      },
      "impact": "high | medium | low",
      "confidence": 0.9
    }
  ]
}

최대 3개의 이슈만 반환하세요.
`;
}

/**
 * 교전 규칙 적용
 */
function applyObviousFixes(
  assignments: ScheduleAssignment[],
  issues: ObviousIssue[],
  nightIntensiveEmployeeIds: Set<string>
): ScheduleAssignment[] {
  const clonedAssignments = [...assignments];

  issues.forEach((issue) => {
    try {
      const { fix } = issue;

      if (fix.action === 'swap' && fix.employeeB) {
        const indexA = clonedAssignments.findIndex(
          (a) => a.employeeId === fix.employeeA && a.date.toISOString().startsWith(fix.date)
        );
        const indexB = clonedAssignments.findIndex(
          (a) => a.employeeId === fix.employeeB && a.date.toISOString().startsWith(fix.date)
        );

        if (indexA === -1 || indexB === -1) {
          return;
        }

        const assignmentA = clonedAssignments[indexA]!;
        const assignmentB = clonedAssignments[indexB]!;

        // 보호 규칙: locked, specialRequest, night-intensive는 변경 금지
        if (
          assignmentA.isLocked ||
          assignmentB.isLocked ||
          assignmentA.isSpecialRequest ||
          assignmentB.isSpecialRequest ||
          nightIntensiveEmployeeIds.has(assignmentA.employeeId) ||
          nightIntensiveEmployeeIds.has(assignmentB.employeeId)
        ) {
          console.log(
            `[AI Polish] Skipping swap affecting protected/night-intensive assignment on ${fix.date}`
          );
          return;
        }

        const tempShiftId = assignmentA.shiftId;
        const tempShiftType = assignmentA.shiftType;

        assignmentA.shiftId = assignmentB.shiftId;
        assignmentA.shiftType = assignmentB.shiftType;

        assignmentB.shiftId = tempShiftId;
        assignmentB.shiftType = tempShiftType;
      } else if (fix.action === 'adjust') {
        const index = clonedAssignments.findIndex(
          (a) => a.employeeId === fix.employeeA && a.date.toISOString().startsWith(fix.date)
        );

        if (index === -1) {
          return;
        }

        const assignment = clonedAssignments[index]!;

        // 보호 규칙: locked, specialRequest, night-intensive는 변경 금지
        if (
          assignment.isLocked ||
          assignment.isSpecialRequest ||
          nightIntensiveEmployeeIds.has(assignment.employeeId)
        ) {
          console.log(
            `[AI Polish] Skipping adjust affecting protected/night-intensive assignment on ${fix.date}`
          );
          return;
        }

        assignment.shiftId = fix.toShift;
        assignment.shiftType = fix.toShift;
      }
    } catch (error) {
      console.error('[AI Polish] Fix application error:', error);
      // 개별 수정 실패시에도 전체 폴리시 흐름은 유지
    }
  });

  return clonedAssignments;
}

/**
 * 점수 개선 추정
 */
function estimateScoreImprovement(issues: ObviousIssue[]): number {
  return issues.reduce((sum, issue) => {
    const baseImprovement =
      {
        high: 3,
        medium: 2,
        low: 1,
      }[issue.impact] ?? 1;

    // 신뢰도에 따라 가중치 적용
    return sum + baseImprovement * issue.confidence;
  }, 0);
}
