import type { Database } from '@/db';

const COLOR_PALETTE = [
  '#2563EB', // blue-600
  '#16A34A', // green-600
  '#F97316', // orange-500
  '#EC4899', // pink-500
  '#8B5CF6', // violet-500
  '#0EA5E9', // sky-500
];

/**
 * 간단한 익명 별칭 생성기
 * 실제 커뮤니티 정식 론칭 전까지는
 * 대략적인 형태만 유지하면 되므로,
 * DB를 사용하지 않고 난수 기반으로 생성합니다.
 */
export async function generateAlias(_db?: Database): Promise<string> {
  const random = Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, '0');
  return `Anonymous Nurse #${random}`;
}

export function generateAvatarColor(): string {
  const index = Math.floor(Math.random() * COLOR_PALETTE.length);
  return COLOR_PALETTE[index] ?? COLOR_PALETTE[0];
}

