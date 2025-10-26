/**
 * 근무 패턴 검증 및 파싱 유틸리티
 */

export type ShiftToken = 'D' | 'E' | 'N' | 'O' | 'A';

// 유효한 키워드와 별칭 매핑
export const VALID_KEYWORDS: Record<string, ShiftToken> = {
  // Day shift
  'D': 'D',
  'DAY': 'D',
  'DL': 'D',  // Day Leader

  // Evening shift
  'E': 'E',
  'EVENING': 'E',
  'EL': 'E',  // Evening Leader

  // Night shift
  'N': 'N',
  'NIGHT': 'N',

  // Off
  'OFF': 'O',
  'OF': 'O',
  'O': 'O',

  // Admin
  'A': 'A',
  'ADMIN': 'A',
};

// 키워드 설명
export const KEYWORD_DESCRIPTIONS: Record<ShiftToken, string> = {
  'D': '주간 근무 (Day, DL)',
  'E': '저녁 근무 (Evening, EL)',
  'N': '야간 근무 (Night)',
  'O': '휴무 (OFF, OF, O)',
  'A': '행정 근무 (Admin, A)',
};

export interface PatternValidationResult {
  isValid: boolean;
  tokens: ShiftToken[];
  errors: string[];
  warnings: string[];
  originalInput: string;
}

/**
 * 패턴 문자열을 파싱하고 검증
 */
export function validatePattern(input: string): PatternValidationResult {
  const result: PatternValidationResult = {
    isValid: false,
    tokens: [],
    errors: [],
    warnings: [],
    originalInput: input,
  };

  // 빈 입력 체크
  if (!input || input.trim() === '') {
    result.errors.push('패턴을 입력해주세요');
    return result;
  }

  // 구분자로 분리 (하이픈, 쉼표, 공백 지원)
  const rawTokens = input
    .split(/[-,\s]+/)
    .map(token => token.trim().toUpperCase())
    .filter(token => token.length > 0);

  // 토큰이 없으면 에러
  if (rawTokens.length === 0) {
    result.errors.push('유효한 패턴이 없습니다');
    return result;
  }

  // 각 토큰 검증
  const validTokens: ShiftToken[] = [];
  const invalidTokens: string[] = [];

  rawTokens.forEach((token, index) => {
    if (token in VALID_KEYWORDS) {
      validTokens.push(VALID_KEYWORDS[token]);
    } else {
      invalidTokens.push(token);
      result.errors.push(`"${token}"는 유효하지 않은 키워드입니다 (위치: ${index + 1})`);
    }
  });

  // 유효하지 않은 토큰이 있으면 실패
  if (invalidTokens.length > 0) {
    result.errors.push(`유효한 키워드: ${Object.keys(VALID_KEYWORDS).join(', ')}`);
    return result;
  }

  // 패턴 길이 체크 (최소 1일, 최대 14일)
  if (validTokens.length < 1) {
    result.errors.push('최소 1일 이상의 패턴이 필요합니다');
    return result;
  }

  if (validTokens.length > 14) {
    result.warnings.push('패턴이 14일을 초과합니다. 긴 패턴은 스케줄 생성 시 성능에 영향을 줄 수 있습니다');
  }

  // 패턴 품질 체크
  const offCount = validTokens.filter(t => t === 'O').length;
  const workCount = validTokens.length - offCount;

  if (offCount === 0 && validTokens.length > 3) {
    result.warnings.push('휴무일이 없습니다. 직원 복지를 위해 휴무를 추가하는 것을 권장합니다');
  }

  if (workCount === 0) {
    result.warnings.push('근무일이 없습니다. 최소 1일 이상의 근무일이 필요합니다');
  }

  // 연속 근무일 체크
  let consecutiveWork = 0;
  let maxConsecutive = 0;
  validTokens.forEach(token => {
    if (token !== 'O') {
      consecutiveWork++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveWork);
    } else {
      consecutiveWork = 0;
    }
  });

  if (maxConsecutive > 6) {
    result.warnings.push(`최대 ${maxConsecutive}일 연속 근무가 포함되어 있습니다. 6일 이하를 권장합니다`);
  }

  // 성공
  result.isValid = true;
  result.tokens = validTokens;

  return result;
}

/**
 * ShiftToken 배열을 문자열로 변환
 */
export function tokensToString(tokens: ShiftToken[]): string {
  return tokens
    .map(token => {
      // OFF는 "OFF"로 표시, 나머지는 단일 문자
      return token === 'O' ? 'OFF' : token;
    })
    .join('-');
}

/**
 * 패턴 배열을 사람이 읽기 쉬운 설명으로 변환
 */
export function describePattern(tokens: ShiftToken[]): string {
  const counts: Record<ShiftToken, number> = {
    D: 0,
    E: 0,
    N: 0,
    O: 0,
    A: 0,
  };

  tokens.forEach(token => {
    counts[token]++;
  });

  const parts: string[] = [];
  if (counts.D > 0) parts.push(`주간 ${counts.D}일`);
  if (counts.E > 0) parts.push(`저녁 ${counts.E}일`);
  if (counts.N > 0) parts.push(`야간 ${counts.N}일`);
  if (counts.A > 0) parts.push(`행정 ${counts.A}일`);
  if (counts.O > 0) parts.push(`휴무 ${counts.O}일`);

  return parts.join(', ');
}

/**
 * 예시 패턴
 */
export const EXAMPLE_PATTERNS = [
  { pattern: 'D-D-D-OFF-OFF', description: '3일 주간 근무, 2일 휴무' },
  { pattern: 'E-E-E-OFF-OFF', description: '3일 저녁 근무, 2일 휴무' },
  { pattern: 'N-N-N-OFF-OFF', description: '3일 야간 근무, 2일 휴무' },
  { pattern: 'D-D-OFF-E-E-OFF', description: '2일 주간, 1일 휴무, 2일 저녁, 1일 휴무' },
  { pattern: 'E-E-OFF-N-N-OFF-OFF', description: '2일 저녁, 1일 휴무, 2일 야간, 2일 휴무' },
  { pattern: 'D-E-N-OFF', description: '주간-저녁-야간 순환, 1일 휴무' },
];
