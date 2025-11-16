/**
 * AI Polish Module - 생성된 스케줄을 AI로 미세 조정
 *
 * 기존 generateAiSchedule 결과를 받아서 명백한 개선점만 자동 수정
 */

import { performance } from 'perf_hooks';
import { format } from 'date-fns';
import type { ScheduleAssignment, ScheduleScore, Constraint } from '@/lib/types/scheduler';
import type { AiScheduleRequest, AiScheduleGenerationResult, AiEmployee } from './ai-scheduler';

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

/**
 * AI를 사용하여 스케줄을 미세 조정
 */
export async function autoPolishWithAI(
  aiResult: AiScheduleGenerationResult,
  input: AiScheduleRequest
): Promise<AIPolishResult> {
  const startTime = performance.now();

  try {
    // 1. 점수가 이미 높으면 스킵 (95점 이상)
    if (aiResult.score.total >= 95) {
      return {
        assignments: aiResult.assignments,
        score: aiResult.score,
        improved: false,
        improvements: [],
        polishTime: 0,
      };
    }

    // 2. AI 분석 데이터 준비
    const analysisData = prepareAnalysisData(aiResult, input);

    // 3. OpenAI로 명백한 이슈 분석
    const analysis = await analyzeForObviousIssues(analysisData);

    // 4. 신뢰도 높은 이슈만 필터링 (0.8 이상) + 특별 요청 보호 재검증
    const highConfidenceIssues = analysis.obviousIssues.filter(
      (issue: ObviousIssue) => {
        // 신뢰도 체크
        if (issue.confidence < 0.8) {
          return false;
        }

        // 특별 요청 보호 재검증 (OpenAI가 실수로 포함시킬 경우를 대비)
        const affectedEmployees = [issue.fix.employeeA, issue.fix.employeeB].filter(Boolean);
        for (const employeeId of affectedEmployees) {
          const assignment = analysisData.currentAssignments.find(
            (a: any) => a.employeeId === employeeId && a.date === issue.fix.date
          );
          if (assignment && (assignment.isLocked || assignment.isSpecialRequest)) {
            console.log(`[AI Polish] Filtering out issue affecting protected assignment: ${employeeId} on ${issue.fix.date}`);
            return false;
          }
        }

        return true;
      }
    );

    if (highConfidenceIssues.length === 0) {
      return {
        assignments: aiResult.assignments,
        score: aiResult.score,
        improved: false,
        improvements: [],
        polishTime: performance.now() - startTime,
      };
    }

    // 5. 안전한 수정 적용
    const polishedAssignments = applyObviousFixes(
      aiResult.assignments,
      highConfidenceIssues
    );

    // 6. 점수 추정 (실제 재계산은 비용이 높으므로 추정)
    const estimatedImprovement = estimateScoreImprovement(highConfidenceIssues);
    const newScore = {
      ...aiResult.score,
      total: Math.min(100, aiResult.score.total + estimatedImprovement),
    };

    const polishTime = performance.now() - startTime;

    console.log(`[AI Polish] ${aiResult.score.total} → ${newScore.total} (+${estimatedImprovement}) in ${polishTime.toFixed(0)}ms`);

    // 특별 요청 보호 검증 로깅
    const specialRequestCount = input.specialRequests?.length || 0;
    const lockedCount = aiResult.assignments.filter(a => a.isLocked).length;
    console.log(`[AI Polish] Protected assignments: ${specialRequestCount} special requests, ${lockedCount} locked`);
    console.log(`[AI Polish] Applied ${highConfidenceIssues.length} improvements`);

    return {
      assignments: polishedAssignments,
      score: newScore,
      improved: true,
      improvements: highConfidenceIssues.map((issue: ObviousIssue) => ({
        type: issue.type,
        description: issue.description,
        impact: issue.impact,
        confidence: issue.confidence,
      })),
      polishTime,
    };
  } catch (error) {
    console.error('[AI Polish] Error:', error);
    // 에러 시 원래 스케줄 반환 (Fail-safe)
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
 * AI 분석을 위한 데이터 준비
 */
function prepareAnalysisData(
  aiResult: AiScheduleGenerationResult,
  input: AiScheduleRequest
) {
  // 직원별 배정 수 계산
  const employeeAssignmentCounts = new Map<string, number>();
  aiResult.assignments.forEach((assignment) => {
    const count = employeeAssignmentCounts.get(assignment.employeeId) || 0;
    employeeAssignmentCounts.set(assignment.employeeId, count + 1);
  });

  // 특별 요청 배정 식별 (isLocked === true 또는 specialRequests와 매칭)
  const specialRequestKeys = new Set<string>();
  input.specialRequests?.forEach((req) => {
    specialRequestKeys.add(`${req.employeeId}-${req.date}`);
  });

  // 배정에 특별 요청 및 locked 정보 추가
  const enhancedAssignments = aiResult.assignments.slice(0, 50).map((assignment) => {
    const dateStr = format(assignment.date, 'yyyy-MM-dd');
    const key = `${assignment.employeeId}-${dateStr}`;
    return {
      employeeId: assignment.employeeId,
      date: dateStr,
      shiftId: assignment.shiftId,
      shiftType: assignment.shiftType,
      isLocked: assignment.isLocked || false,
      isSpecialRequest: specialRequestKeys.has(key) || assignment.isLocked === true,
    };
  });

  return {
    currentAssignments: enhancedAssignments,
    currentScore: aiResult.score,
    violations: aiResult.violations.slice(0, 10),
    employees: input.employees.slice(0, 20).map((emp: AiEmployee) => ({
      id: emp.id,
      name: emp.name,
      preferences: emp.preferredShiftTypes,
      workPattern: emp.workPatternType,
      assignmentCount: employeeAssignmentCounts.get(emp.id) || 0,
    })),
    constraints: input.constraints?.slice(0, 10) || [],
    requiredStaffPerShift: input.requiredStaffPerShift,
    // 특별 요청 정보 추가
    specialRequests: input.specialRequests?.slice(0, 20).map(req => ({
      employeeId: req.employeeId,
      date: req.date,
      requestType: req.requestType,
      shiftCode: req.shiftTypeCode,
    })) || [],
  };
}

/**
 * OpenAI를 사용하여 명백한 이슈 분석
 */
async function analyzeForObviousIssues(data: any): Promise<{ obviousIssues: ObviousIssue[] }> {
  // OpenAI API 키 확인
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
            content: `당신은 매우 보수적인 근무 스케줄 개선 전문가입니다.

핵심 원칙:
1. 특별 요청(isSpecialRequest: true) 배정은 절대 변경 제안 금지
2. 확정된(isLocked: true) 배정은 절대 수정 제안 금지
3. 명백하고 간단하게 고칠 수 있는 문제만 찾기
4. 복잡한 재배치나 애매한 문제는 제외
5. 직원의 명시적 요청은 최우선 보호

응답은 반드시 유효한 JSON 형식이어야 합니다.
절대 isSpecialRequest나 isLocked가 true인 배정을 fix 대상으로 제안하지 마세요.`,
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2, // 낮은 temperature = 보수적
        max_tokens: 2000,
      },
      {
        timeout: 5000, // 5초 타임아웃을 옵션으로 이동
      }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { obviousIssues: [] };
    }

    const result = JSON.parse(content);
    return result;
  } catch (error) {
    console.error('[AI Polish] OpenAI API error:', error);
    return { obviousIssues: [] };
  }
}

/**
 * AI 분석 프롬프트 생성
 */
function buildAnalysisPrompt(data: any): string {
  return `
다음 근무 스케줄에서 **명백하고 간단하게 고칠 수 있는** 문제만 찾으세요.

## 🚨🚨 절대 규칙 (반드시 준수) 🚨🚨
1. **특별 요청 배정은 절대 변경 금지**
   - isSpecialRequest: true인 배정은 swap/adjust 대상에서 절대 제외
   - isLocked: true인 배정은 어떤 이유로도 수정 불가
   - 직원이 명시적으로 요청한 시프트는 최우선 보호
2. **아래 배정은 절대 수정 제안 금지:**
${data.currentAssignments
  .filter((a: any) => a.isSpecialRequest || a.isLocked)
  .slice(0, 15)
  .map((a: any) => `   - ${a.employeeId}: ${a.date} → ${a.shiftId} (🔒 보호됨)`)
  .join('\n')}

## 현재 스케줄 상태
- 총점: ${data.currentScore.total}/100
  - 공정성: ${data.currentScore.fairness}
  - 커버리지: ${data.currentScore.coverage}
  - 선호도: ${data.currentScore.preference}
- 제약 위반: ${data.violations.length}건

## 특별 요청 목록 (변경 절대 금지)
${data.specialRequests?.slice(0, 10).map((req: any) => `
- ${req.employeeId}: ${req.date} → ${req.shiftCode || req.requestType} 요청 (🔒 보호됨)
`).join('\n') || '(없음)'}

## 직원 정보
${data.employees.slice(0, 10).map((emp: any) => `
- ${emp.name} (ID: ${emp.id})
  - 근무 패턴: ${emp.workPattern || '지정 안됨'}
  - 배정 수: ${emp.assignmentCount}회
  - 선호 시프트: ${emp.preferences ? Object.keys(emp.preferences).join(', ') : '없음'}
`).join('\n')}

## 제약 위반
${data.violations.slice(0, 5).map((v: any) => `
- [${v.severity}] ${v.constraintName}: ${v.message}
`).join('\n')}

## 찾을 문제 (특별 요청 및 locked 배정은 절대 제외)
1. **불공정한 근무 분배** - 직원 간 배정 수 차이가 50% 이상
   - 단, 특별 요청으로 인한 불공정은 허용
2. **불필요한 연속 야간** - 3일 이상 연속 야간을 줄일 수 있는 경우
   - 단, 특별 요청 야간은 변경 불가
3. **선호도 무시** - 선호 시프트와 정반대로 배정된 경우
   - 단, 특별 요청이 아닌 경우만
4. **간단한 스왑으로 해결 가능한 위반**
   - 단, isSpecialRequest 또는 isLocked인 배정은 절대 swap 대상 제외

## 응답 형식 (JSON)
{
  "obviousIssues": [
    {
      "type": "unfairness | consecutive_nights | preference_mismatch | constraint_violation",
      "description": "구체적 문제 설명",
      "fix": {
        "action": "swap | adjust",
        "employeeA": "직원ID",
        "employeeB": "직원ID (swap인 경우, 없으면 생략)",
        "date": "YYYY-MM-DD",
        "fromShift": "현재 시프트 (adjust인 경우)",
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
 * 안전한 수정 적용
 */
function applyObviousFixes(
  assignments: ScheduleAssignment[],
  issues: ObviousIssue[]
): ScheduleAssignment[] {
  const clonedAssignments = [...assignments];

  issues.forEach((issue) => {
    try {
      const { fix } = issue;

      if (fix.action === 'swap' && fix.employeeB) {
        // 두 직원의 시프트 교환
        const indexA = clonedAssignments.findIndex(
          (a) => a.employeeId === fix.employeeA && a.date.toISOString().startsWith(fix.date)
        );
        const indexB = clonedAssignments.findIndex(
          (a) => a.employeeId === fix.employeeB && a.date.toISOString().startsWith(fix.date)
        );

        if (indexA !== -1 && indexB !== -1) {
          const assignmentA = clonedAssignments[indexA]!;
          const assignmentB = clonedAssignments[indexB]!;

          // 🔒 특별 요청이나 확정된 배정은 변경하지 않음
          if (assignmentA.isLocked || assignmentB.isLocked) {
            console.log(`[AI Polish] Skipping swap - locked assignment detected (${fix.employeeA} <-> ${fix.employeeB} on ${fix.date})`);
            return;
          }

          // Swap 진행
          const tempShift = assignmentA.shiftId;
          assignmentA.shiftId = assignmentB.shiftId;
          assignmentB.shiftId = tempShift;

          // shiftType도 함께 교환
          const tempShiftType = assignmentA.shiftType;
          assignmentA.shiftType = assignmentB.shiftType;
          assignmentB.shiftType = tempShiftType;
        }
      } else if (fix.action === 'adjust') {
        // 단일 직원의 시프트 변경
        const index = clonedAssignments.findIndex(
          (a) => a.employeeId === fix.employeeA && a.date.toISOString().startsWith(fix.date)
        );

        if (index !== -1) {
          const assignment = clonedAssignments[index]!;

          // 🔒 특별 요청이나 확정된 배정은 변경하지 않음
          if (assignment.isLocked) {
            console.log(`[AI Polish] Skipping adjust - locked assignment detected (${fix.employeeA} on ${fix.date})`);
            return;
          }

          assignment.shiftId = fix.toShift;
          assignment.shiftType = fix.toShift;
        }
      }
    } catch (error) {
      console.error('[AI Polish] Fix application error:', error);
      // 개별 수정 실패해도 계속 진행
    }
  });

  return clonedAssignments;
}

/**
 * 점수 개선 추정
 */
function estimateScoreImprovement(issues: ObviousIssue[]): number {
  return issues.reduce((sum, issue) => {
    const baseImprovement = {
      high: 3,
      medium: 2,
      low: 1,
    }[issue.impact];

    // 신뢰도에 따라 가중치 적용
    return sum + baseImprovement * issue.confidence;
  }, 0);
}
