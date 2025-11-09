"use client";
import { type Staff } from "@/lib/types";
import { useTranslation } from "react-i18next";
import { STAFF_ROLES } from "@/lib/constants/staff";
import type { WorkPatternType } from "./EmployeePreferencesModal";

interface StaffCardProps {
  staff: Staff;
  compact?: boolean;
  onClick?: () => void;
  workPatternType?: WorkPatternType; // 근무 패턴 타입
  preferredShifts?: string[]; // 선호하는 근무 시간
}

const ROLE_COLORS = {
  RN: { bg: "bg-blue-50 dark:bg-blue-900/10", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-900/30" },
  CN: { bg: "bg-purple-50 dark:bg-purple-900/10", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-900/30" },
  SN: { bg: "bg-green-50 dark:bg-green-900/10", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-900/30" },
  NA: { bg: "bg-amber-50 dark:bg-amber-900/10", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-900/30" },
};

// Experience labels are now translated via i18n

const WORK_PATTERN_LABELS: Record<WorkPatternType, string> = {
  'three-shift': '3교대 근무',
  'night-intensive': '나이트 집중',
  'weekday-only': '행정 근무',
};

export function StaffCard({ staff, compact = false, onClick, workPatternType, preferredShifts }: StaffCardProps) {
  const { t } = useTranslation(['components', 'team']);
  const roleColor = ROLE_COLORS[staff.role] || ROLE_COLORS.RN;
  const roleName = STAFF_ROLES[staff.role]?.label || staff.role;

  // 선호도 요약
  const getPreferenceSummary = () => {
    const summary: string[] = [];

    if (workPatternType) {
      summary.push(WORK_PATTERN_LABELS[workPatternType]);
    }

    if (preferredShifts && preferredShifts.length > 0) {
      const shiftLabels = preferredShifts.map(s => {
        if (s === 'day' || s === 'D') return '주간';
        if (s === 'evening' || s === 'E') return '저녁';
        if (s === 'night' || s === 'N') return '야간';
        return s;
      });
      summary.push(`선호: ${shiftLabels.join(', ')}`);
    }

    return summary;
  };

  const preferenceSummary = getPreferenceSummary();

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg p-2 -m-2 transition-colors' : ''}`}
        onClick={onClick}
      >
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {staff.name?.charAt(0) || "?"}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {staff.name || t('staffCard.unassigned', { ns: 'components' })}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded-md ${
              roleColor.bg
            } ${roleColor.text} ${roleColor.border} border`}>
              {roleName}
            </span>
            {preferenceSummary.length > 0 && (
              <span className="inline-flex px-1.5 py-0.5 text-xs font-medium rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/30">
                {preferenceSummary[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 hover:shadow-md dark:hover:shadow-lg transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
            <span className="text-lg font-medium text-gray-600 dark:text-gray-300">
              {staff.name?.charAt(0) || "?"}
            </span>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{staff.name || "미배정"}</h3>
            {preferenceSummary.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {preferenceSummary.map((pref, idx) => (
                  <span key={idx} className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/30">
                    {pref}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-lg ${
          roleColor.bg
        } ${roleColor.text} ${roleColor.border} border`}>
          {roleName}
        </span>
      </div>

      {/* Skills */}
      {staff.skills && staff.skills.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('staffCard.skills', { ns: 'components' })}</p>
          <div className="flex flex-wrap gap-1">
            {staff.skills.map((skill, index) => (
              <span
                key={index}
                className="inline-flex px-2 py-0.5 text-xs bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-md"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}


      {/* Skill Meters */}
      <div className="mt-3 space-y-2">
        {[
          { label: t('staffCard.technical', { ns: 'components' }), value: staff.technicalSkill },
          { label: t('staffCard.leadership', { ns: 'components' }), value: staff.leadership },
          { label: t('staffCard.communication', { ns: 'components' }), value: staff.communication },
        ].map((skill) => (
          <div key={skill.label} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-12">{skill.label}</span>
            <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-1.5">
              <div
                className="bg-blue-500 dark:bg-blue-400 h-1.5 rounded-full transition-all"
                style={{ width: `${(skill.value / 5) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400 w-3">{skill.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}