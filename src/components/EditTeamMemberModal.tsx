"use client";
import { useState, useEffect } from "react";
import { X, User, Briefcase, Info, Loader2 } from "lucide-react";
import { api } from "@/lib/trpc/client";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  profile?: { phone?: string } | null;
  departmentId?: string | null;
  position?: string | null;
  status?: string | null;
  hireDate?: Date | null;
  yearsOfService?: number | null;
}

interface EditTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMember | null;
  departments: Array<{ id: string; name: string }>;
  onUpdate: () => void;
}

export function EditTeamMemberModal({ isOpen, onClose, member, departments, onUpdate }: EditTeamMemberModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'career'>('basic');
  const [isYearsOfServiceFocused, setIsYearsOfServiceFocused] = useState(false);
  const [formData, setFormData] = useState({
    phone: "",
    departmentId: "",
    position: "",
    status: "active",
    hireYear: 0,
    yearsOfService: 0,
  });

  const [customPositions, setCustomPositions] = useState<{value: string; label: string; level: number}[]>([]);

  // Load custom positions from localStorage
  useEffect(() => {
    const savedPositions = localStorage.getItem('customPositions');
    if (savedPositions) {
      const parsed = JSON.parse(savedPositions);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const positionsWithLevels = parsed.map((p: any) => ({
        ...p,
        level: p.level || 1
      }));
      setCustomPositions(positionsWithLevels);
    } else {
      setCustomPositions([
        { value: 'HN', label: '수석간호사', level: 9 },
        { value: 'SN', label: '전문간호사', level: 7 },
        { value: 'CN', label: '책임간호사', level: 5 },
        { value: 'RN', label: '정규간호사', level: 3 },
        { value: 'NA', label: '간호조무사', level: 1 },
      ]);
    }
  }, [isOpen]);

  // Initialize form data when member changes
  useEffect(() => {
    if (member && isOpen) {
      const hireYear = member.hireDate ? new Date(member.hireDate).getFullYear() : 0;
      const phone = member.profile?.phone || "";
      setFormData({
        phone,
        departmentId: member.departmentId || "",
        position: member.position || "",
        status: member.status || "active",
        hireYear,
        yearsOfService: member.yearsOfService || 0,
      });
    }
  }, [member, isOpen]);

  // Mutations
  const updateUserMutation = api.tenant.users.update.useMutation({
    onSuccess: () => {
      onUpdate();
      onClose();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      alert(error.message || '정보 수정 중 오류가 발생했습니다.');
    },
  });

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Prepare hire date from hire year
      const hireDate = formData.hireYear > 0
        ? new Date(`${formData.hireYear}-01-01`)
        : undefined;

      // Update user info including career data
      await updateUserMutation.mutateAsync({
        userId: member.id,
        phone: formData.phone || undefined,
        departmentId: formData.departmentId || undefined,
        position: formData.position || undefined,
        status: formData.status as 'active' | 'inactive' | 'on_leave' | undefined,
        hireDate,
        yearsOfService: formData.yearsOfService > 0 ? formData.yearsOfService : undefined,
      });
    } catch (error) {
      console.error('Failed to update member:', error);
    }
  };

  const tabs = [
    { id: 'basic', label: '기본 정보', icon: User },
    { id: 'career', label: '경력 관리', icon: Briefcase },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">부서원 정보 수정</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <User className="w-4 h-4" />
                기본 정보
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    이름
                  </label>
                  <input
                    type="text"
                    value={member.name}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={member.email}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    전화번호
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                    placeholder="010-1234-5678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    부서
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                  >
                    <option value="">부서 선택</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    직급
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                  >
                    <option value="">직급 선택</option>
                    {customPositions.map((pos) => (
                      <option key={pos.value} value={pos.value}>
                        {pos.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    상태
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                  >
                    <option value="active">근무중</option>
                    <option value="on_leave">휴가</option>
                    <option value="inactive">비활성</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Career Tab */}
          {activeTab === 'career' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-500" />
                  경력 정보
                </h3>
                <div className="space-y-4">
                  {/* 입사연도 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      입사연도
                    </label>
                    <input
                      type="number"
                      min="1970"
                      max={new Date().getFullYear()}
                      value={formData.hireYear || ''}
                      onChange={(e) => {
                        const hireYear = parseInt(e.target.value);
                        if (hireYear && hireYear >= 1970 && hireYear <= new Date().getFullYear()) {
                          const currentYear = new Date().getFullYear();
                          const calculatedYearsOfService = currentYear - hireYear + 1;
                          setFormData({
                            ...formData,
                            hireYear,
                            yearsOfService: calculatedYearsOfService,
                          });
                        } else {
                          setFormData({ ...formData, hireYear: parseInt(e.target.value) || 0 });
                        }
                      }}
                      placeholder="예: 2025"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      입사연도를 입력하면 근속 년수를 자동으로 계산합니다
                    </p>
                  </div>

                  {/* 근속 년수 (경력) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      근속 년수 (경력)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={
                        isYearsOfServiceFocused && (!formData.yearsOfService || formData.yearsOfService === 0)
                          ? ''
                          : formData.yearsOfService || 0
                      }
                      onChange={(e) => {
                        const yearsOfService = parseInt(e.target.value) || 0;
                        if (yearsOfService >= 0 && yearsOfService <= 50) {
                          const currentYear = new Date().getFullYear();
                          const calculatedHireYear = currentYear - yearsOfService + 1;
                          setFormData({
                            ...formData,
                            yearsOfService,
                            hireYear: calculatedHireYear,
                          });
                        }
                      }}
                      onFocus={() => setIsYearsOfServiceFocused(true)}
                      onBlur={() => setIsYearsOfServiceFocused(false)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      근속 년수를 입력하면 입사연도를 자동으로 계산합니다
                    </p>
                  </div>

                  {/* 경력 정보 안내 */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                          경력 정보 활용
                        </h4>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          입력한 경력 정보는 스케줄 작성 시 자동으로 고려됩니다:
                        </p>
                        <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1 list-disc list-inside">
                          <li>각 근무조에 다양한 경력 수준의 직원이 배치되도록 조정</li>
                          <li>경력 그룹별 밸런스를 고려한 스케줄링</li>
                          <li>신규(Junior) 직원과 숙련(Senior) 직원의 균형 배분</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={updateUserMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updateUserMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {updateUserMutation.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
