"use client";
import { Users, TrendingUp, Award, AlertTriangle } from "lucide-react";
import { type Staff, type Role } from "@/lib/types";
import { Tooltip } from "@/components/ui/Tooltip";

interface StaffBalanceIndicatorProps {
  staff: Staff[];
  currentShift?: string;
}

export function StaffBalanceIndicator({ staff, currentShift }: StaffBalanceIndicatorProps) {
  // 경력별 분포 계산
  const experienceDistribution = {
    JUNIOR: staff.filter(s => s.experienceLevel === "JUNIOR").length,
    INTERMEDIATE: staff.filter(s => s.experienceLevel === "INTERMEDIATE").length,
    SENIOR: staff.filter(s => s.experienceLevel === "SENIOR").length,
    EXPERT: staff.filter(s => s.experienceLevel === "EXPERT").length,
  };

  // 역할별 분포 계산
  const roleDistribution: Record<Role, number> = {
    RN: staff.filter(s => s.role === "RN").length,
    CN: staff.filter(s => s.role === "CN").length,
    SN: staff.filter(s => s.role === "SN").length,
    NA: staff.filter(s => s.role === "NA").length,
  };

  // 팀 밸런스 점수 계산 (0-100)
  const calculateBalance = () => {
    let score = 100;

    // 경력 밸런스 체크
    const hasJunior = experienceDistribution.JUNIOR > 0;
    const hasSenior = experienceDistribution.SENIOR + experienceDistribution.EXPERT > 0;

    if (hasJunior && !hasSenior) score -= 30; // 신입만 있고 시니어 없음
    if (!hasJunior && hasSenior && staff.length > 3) score -= 20; // 교육 기회 부족

    // 역할 밸런스 체크
    const hasRN = roleDistribution.RN > 0;
    const hasCN = roleDistribution.CN > 0;

    if (!hasRN && staff.length > 2) score -= 25; // RN 부재
    if (!hasCN && staff.length > 3) score -= 15; // CN 부재

    return Math.max(0, score);
  };

  const balanceScore = calculateBalance();
  const getBalanceLevel = () => {
    if (balanceScore >= 80) return { label: "최적", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" };
    if (balanceScore >= 60) return { label: "양호", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" };
    if (balanceScore >= 40) return { label: "주의", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" };
    return { label: "개선필요", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" };
  };

  const balance = getBalanceLevel();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-4 h-4" />
          팀 밸런스 분석
        </h3>
        <Tooltip
          content={
            <div className="space-y-2">
              <p className="font-semibold">팀 밸런스 평가 기준:</p>
              <ul className="space-y-1">
                <li>• 신입-시니어 균형 배치</li>
                <li>• 필수 역할(RN, CN) 포함 여부</li>
                <li>• 경력별 멘토링 가능성</li>
                <li>• 업무 부하 분산 정도</li>
              </ul>
            </div>
          }
        />
      </div>

      {/* 밸런스 점수 표시 */}
      <div className={`${balance.bg} rounded-lg p-3 mb-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {balanceScore >= 80 ? (
              <Award className={`w-5 h-5 ${balance.color}`} />
            ) : balanceScore >= 40 ? (
              <TrendingUp className={`w-5 h-5 ${balance.color}`} />
            ) : (
              <AlertTriangle className={`w-5 h-5 ${balance.color}`} />
            )}
            <span className={`font-medium ${balance.color}`}>{balance.label}</span>
          </div>
          <span className={`text-2xl font-bold ${balance.color}`}>{balanceScore}점</span>
        </div>
      </div>

      {/* 경력 분포 */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">경력 분포</span>
          <Tooltip
            content="적절한 경력 분포는 멘토링과 업무 효율성을 높입니다"
            icon="info"
          />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {Object.entries(experienceDistribution).map(([level, count]) => (
            <div key={level} className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {level === "JUNIOR" ? "신입" :
                 level === "INTERMEDIATE" ? "중급" :
                 level === "SENIOR" ? "시니어" : "전문가"}
              </div>
              <div className={`text-sm font-medium ${
                count > 0 ? "text-gray-900 dark:text-white" : "text-gray-300 dark:text-gray-600"
              }`}>
                {count}명
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 역할 분포 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">역할 분포</span>
          <Tooltip
            content="각 역할별 적정 인원이 배치되어야 효율적인 운영이 가능합니다"
            icon="info"
          />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {Object.entries(roleDistribution).map(([role, count]) => (
            <div key={role} className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">{role}</div>
              <div className={`text-sm font-medium ${
                count > 0 ? "text-gray-900 dark:text-white" : "text-gray-300 dark:text-gray-600"
              }`}>
                {count}명
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 개선 제안 */}
      {balanceScore < 80 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <strong>개선 제안:</strong>
            {!roleDistribution.RN && <div>• RN(정규간호사) 배치 필요</div>}
            {experienceDistribution.JUNIOR > 0 && experienceDistribution.SENIOR === 0 && experienceDistribution.EXPERT === 0 &&
              <div>• 시니어 직원 배치로 멘토링 가능</div>
            }
            {experienceDistribution.JUNIOR === 0 && staff.length > 3 &&
              <div>• 신입 직원 배치로 팀 활력 증진</div>
            }
          </div>
        </div>
      )}
    </div>
  );
}