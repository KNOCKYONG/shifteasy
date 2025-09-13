"use client";
import { type Staff } from "@/lib/types";

interface StaffCardProps {
  staff: Staff;
  compact?: boolean;
}

const ROLE_COLORS = {
  RN: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  CN: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  SN: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  NA: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

const EXPERIENCE_LABELS = {
  JUNIOR: "신입",
  INTERMEDIATE: "경력",
  SENIOR: "시니어",
  EXPERT: "전문가",
};

export function StaffCard({ staff, compact = false }: StaffCardProps) {
  const roleColor = ROLE_COLORS[staff.role] || ROLE_COLORS.RN;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-600">
              {staff.name?.charAt(0) || "?"}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {staff.name || "미배정"}
          </p>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded-md ${
              roleColor.bg
            } ${roleColor.text} ${roleColor.border} border`}>
              {staff.role}
            </span>
            {staff.experienceLevel && (
              <span className="text-xs text-gray-500">
                {EXPERIENCE_LABELS[staff.experienceLevel]}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <span className="text-lg font-medium text-gray-600">
              {staff.name?.charAt(0) || "?"}
            </span>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{staff.name || "미배정"}</h3>
            <p className="text-sm text-gray-500">{staff.wardId}</p>
          </div>
        </div>
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-lg ${
          roleColor.bg
        } ${roleColor.text} ${roleColor.border} border`}>
          {staff.role}
        </span>
      </div>

      {/* Skills */}
      {staff.skills && staff.skills.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">전문 분야</p>
          <div className="flex flex-wrap gap-1">
            {staff.skills.map((skill, index) => (
              <span
                key={index}
                className="inline-flex px-2 py-0.5 text-xs bg-gray-50 text-gray-600 rounded-md"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-50">
        <div>
          <p className="text-xs text-gray-500">경력</p>
          <p className="text-sm font-medium text-gray-900">
            {staff.experienceLevel ? EXPERIENCE_LABELS[staff.experienceLevel] : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">주간 최대</p>
          <p className="text-sm font-medium text-gray-900">
            {staff.maxWeeklyHours || 40}시간
          </p>
        </div>
      </div>

      {/* Skill Meters */}
      <div className="mt-3 space-y-2">
        {[
          { label: "기술", value: staff.technicalSkill },
          { label: "리더십", value: staff.leadership },
          { label: "소통", value: staff.communication },
        ].map((skill) => (
          <div key={skill.label} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12">{skill.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(skill.value / 5) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 w-3">{skill.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}