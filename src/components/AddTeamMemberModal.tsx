"use client";
import { useState, useEffect } from "react";
import { X, User, Mail, Phone, Building, Briefcase, Loader2 } from "lucide-react";

// Type definition for team member - 간소화된 버전
interface ModalTeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  departmentId: string;
  position: string;
  role: "admin" | "manager" | "employee" | "staff";
  joinDate: string;
  avatar?: string;
}

export type AddTeamMemberInput = Omit<ModalTeamMember, "id">;

interface AddTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (member: AddTeamMemberInput) => void;
  departments: Array<{ id: string; name: string }>;
  currentUserRole?: string;
  managerDepartmentId?: string | null;
  isLoading?: boolean;
}

export function AddTeamMemberModal({ isOpen, onClose, onAdd, departments, currentUserRole, managerDepartmentId, isLoading = false }: AddTeamMemberModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    departmentId: "",
    position: "",
    experienceYears: 0,
    joinDate: new Date().toISOString().split("T")[0],
  });
  const [customPositions, setCustomPositions] = useState<{value: string; label: string; level: number}[]>([]);

  // Load custom positions from localStorage
  useEffect(() => {
    const savedPositions = localStorage.getItem('customPositions');
    if (savedPositions) {
      const parsed = JSON.parse(savedPositions);
      // Ensure all positions have levels
      const positionsWithLevels = parsed.map((p: any) => ({
        ...p,
        level: p.level || 1
      }));
      setCustomPositions(positionsWithLevels);
    } else {
      // Default positions if none saved
      setCustomPositions([
        { value: 'HN', label: '수석간호사', level: 9 },
        { value: 'SN', label: '전문간호사', level: 7 },
        { value: 'CN', label: '책임간호사', level: 5 },
        { value: 'RN', label: '정규간호사', level: 3 },
        { value: 'NA', label: '간호조무사', level: 1 },
      ]);
    }
  }, [isOpen]); // Re-load when modal opens to get latest positions

  // Set defaults for managers
  useEffect(() => {
    if (isOpen && currentUserRole === 'manager' && managerDepartmentId) {
      setFormData(prev => ({
        ...prev,
        departmentId: managerDepartmentId,
      }));
    }
  }, [isOpen, currentUserRole, managerDepartmentId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!formData.name || !formData.email || !formData.departmentId || !formData.position) {
      alert("Please fill in all required fields");
      return;
    }

    const selectedPosition = customPositions.find(p => p.value === formData.position);

    // Create new member object
    const newMember: AddTeamMemberInput = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      departmentId: formData.departmentId,
      position: formData.position as any,
      role: 'staff', // Always set as staff (member)
      joinDate: formData.joinDate,
    };

    onAdd(newMember);

    // Reset form
    setFormData({
      name: "",
      email: "",
      phone: "",
      departmentId: "",
      position: "",
      experienceYears: 0,
      joinDate: new Date().toISOString().split("T")[0],
    });
    onClose();
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">새 팀원 추가</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <User className="w-4 h-4" />
              기본 정보
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="홍길동"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="example@hospital.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  전화번호
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="010-1234-5678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  입사일
                </label>
                <input
                  type="date"
                  value={formData.joinDate}
                  onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Work Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              업무 정보
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  부서 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={currentUserRole === 'manager'}
                  required
                >
                  <option value="">부서 선택</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  직책 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">직책 선택</option>
                  {customPositions
                    .sort((a, b) => b.level - a.level) // Sort by level, highest first
                    .map((position) => (
                    <option key={position.value} value={position.value}>
                      {position.label} (Level {position.level})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  경력 (년)
                </label>
                <input
                  type="number"
                  value={formData.experienceYears}
                  onChange={(e) => setFormData({ ...formData, experienceYears: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="50"
                  placeholder="예: 5"
                />
              </div>

            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? '추가 중...' : '팀원 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
