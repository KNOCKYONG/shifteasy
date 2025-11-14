import OpenAI from 'openai';

// OpenAI 클라이언트 초기화
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  return new OpenAI({
    apiKey,
  });
};

export interface ScheduleReviewRequest {
  schedule: {
    employees: Array<{
      id: string;
      name: string;
      role?: string;
      yearsOfService?: number;
      preferences?: {
        workPatternType?: string;
        avoidPatterns?: string[][];
      };
    }>;
    assignments: Array<{
      date: string;
      employeeId: string;
      shiftId?: string;
      shiftType?: string;
    }>;
    constraints?: {
      minStaff?: number;
      maxConsecutiveDays?: number;
      minRestDays?: number;
    };
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface ScheduleReviewResponse {
  analysis: {
    qualityScore: number; // 0-100
    issues: Array<{
      severity: 'critical' | 'warning' | 'info';
      category: 'workload' | 'fairness' | 'preferences' | 'constraints';
      description: string;
      affectedEmployees?: string[];
    }>;
    strengths: string[];
  };
  suggestions: Array<{
    type: 'swap' | 'adjustment' | 'addition';
    description: string;
    priority: 'high' | 'medium' | 'low';
    changes?: Array<{
      employeeId: string;
      date: string;
      from?: string;
      to?: string;
    }>;
  }>;
  improvedSchedule?: {
    assignments: Array<{
      date: string;
      employeeId: string;
      shiftId?: string;
      shiftType?: string;
    }>;
  };
}

/**
 * AI를 사용하여 생성된 스케줄을 검토하고 개선 제안을 제공합니다.
 */
export async function reviewScheduleWithAI(
  request: ScheduleReviewRequest
): Promise<ScheduleReviewResponse> {
  const client = getOpenAIClient();

  // 스케줄 데이터를 AI가 이해하기 쉬운 형식으로 변환
  const prompt = buildScheduleReviewPrompt(request);

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // 비용 효율적인 모델 사용
      messages: [
        {
          role: 'system',
          content: `당신은 근무 스케줄 최적화 전문가입니다.
주어진 스케줄을 분석하여 공정성, 효율성, 직원 선호도 등을 고려한 개선 제안을 제공합니다.
응답은 반드시 유효한 JSON 형식으로 제공해야 합니다.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content) as ScheduleReviewResponse;
    return result;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('AI 스케줄 검토 중 오류가 발생했습니다.');
  }
}

function buildScheduleReviewPrompt(request: ScheduleReviewRequest): string {
  const { schedule, period } = request;

  // 직원별 근무 일수 계산
  const employeeWorkDays = new Map<string, number>();
  schedule.assignments.forEach((assignment) => {
    const count = employeeWorkDays.get(assignment.employeeId) || 0;
    employeeWorkDays.set(assignment.employeeId, count + 1);
  });

  return `
다음 근무 스케줄을 분석하고 개선 제안을 제공해주세요.

**기간**: ${period.startDate} ~ ${period.endDate}

**직원 정보**:
${schedule.employees.map((emp) => `
- ${emp.name} (ID: ${emp.id})
  - 역할: ${emp.role || '일반'}
  - 경력: ${emp.yearsOfService || 0}년
  - 선호 패턴: ${emp.preferences?.workPatternType || '없음'}
  - 기피 패턴: ${emp.preferences?.avoidPatterns?.length || 0}개
  - 배정된 근무일: ${employeeWorkDays.get(emp.id) || 0}일
`).join('\n')}

**제약 조건**:
- 최소 근무 인원: ${schedule.constraints?.minStaff || '없음'}
- 최대 연속 근무일: ${schedule.constraints?.maxConsecutiveDays || '없음'}
- 최소 휴무일: ${schedule.constraints?.minRestDays || '없음'}

**현재 스케줄** (총 ${schedule.assignments.length}건):
${schedule.assignments.slice(0, 20).map((a) =>
  `${a.date}: ${schedule.employees.find(e => e.id === a.employeeId)?.name} - ${a.shiftId || a.shiftType || 'OFF'}`
).join('\n')}
${schedule.assignments.length > 20 ? `\n... 외 ${schedule.assignments.length - 20}건` : ''}

다음 JSON 형식으로 응답해주세요:
{
  "analysis": {
    "qualityScore": 0-100 사이의 점수,
    "issues": [
      {
        "severity": "critical | warning | info",
        "category": "workload | fairness | preferences | constraints",
        "description": "문제 설명",
        "affectedEmployees": ["직원 이름들"]
      }
    ],
    "strengths": ["스케줄의 강점들"]
  },
  "suggestions": [
    {
      "type": "swap | adjustment | addition",
      "description": "제안 설명",
      "priority": "high | medium | low",
      "changes": [
        {
          "employeeId": "직원 ID",
          "date": "날짜",
          "from": "현재 시프트",
          "to": "변경할 시프트"
        }
      ]
    }
  ]
}`;
}

/**
 * OpenAI API가 사용 가능한지 확인합니다.
 */
export function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
