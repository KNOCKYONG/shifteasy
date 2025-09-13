"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Upload, Download, Users, ChevronRight, Edit2 } from "lucide-react";
import { StaffCard } from "@/components/schedule/StaffCard";
import { type Staff, type Role } from "@/lib/types";
import { listTeamPresets, loadTeamPreset, saveTeamPreset, saveCurrentTeam, loadCurrentTeam } from "@/lib/teamStorage";
import { ProfileDropdown } from "@/components/ProfileDropdown";

const roles: Role[] = ["RN", "CN", "SN", "NA"];

const ROLE_LABELS = {
  RN: "간호사",
  CN: "수간호사",
  SN: "전문간호사",
  NA: "간호조무사",
};

export default function TeamManagementPage() {
  const router = useRouter();
  const [wardId, setWardId] = useState("ward-1A");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [presets, setPresets] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStaff, setNewStaff] = useState<Partial<Staff>>({
    name: "",
    role: "RN",
    experienceLevel: "JUNIOR",
    maxWeeklyHours: 40,
    skills: [],
    technicalSkill: 3,
    leadership: 3,
    communication: 3,
    adaptability: 3,
    reliability: 3,
    active: true,
  });

  useEffect(() => {
    try {
      const current = loadCurrentTeam();
      if (current && current.wardId) {
        setWardId(current.wardId);
        if (Array.isArray(current.staff)) {
          setStaff(current.staff);
        }
      }
      setPresets(listTeamPresets());
    } catch (error) {
      console.error("Failed to load team:", error);
      setStaff([]);
      setWardId("ward-1A");
      setPresets([]);
    }
  }, []);

  const handleAddStaff = () => {
    if (!newStaff.name) {
      alert("직원 이름을 입력해주세요.");
      return;
    }

    const staffMember: Staff = {
      id: crypto.randomUUID().slice(0, 8),
      name: newStaff.name || "",
      role: newStaff.role as Role || "RN",
      maxWeeklyHours: newStaff.maxWeeklyHours || 40,
      skills: newStaff.skills || [],
      technicalSkill: newStaff.technicalSkill || 3,
      leadership: newStaff.leadership || 3,
      communication: newStaff.communication || 3,
      adaptability: newStaff.adaptability || 3,
      reliability: newStaff.reliability || 3,
      experienceLevel: newStaff.experienceLevel as Staff["experienceLevel"] || "JUNIOR",
      active: true,
      wardId: wardId,
    };

    setStaff([...staff, staffMember]);
    setShowAddForm(false);
    setNewStaff({
      name: "",
      role: "RN",
      experienceLevel: "JUNIOR",
      maxWeeklyHours: 40,
      skills: [],
      technicalSkill: 3,
      leadership: 3,
      communication: 3,
      adaptability: 3,
      reliability: 3,
      active: true,
    });
  };

  const handleRemoveStaff = (id: string) => {
    setStaff(staff.filter(s => s.id !== id));
  };

  const handleSaveTeam = () => {
    try {
      saveCurrentTeam(wardId, staff);
      router.push("/config");
    } catch (error) {
      console.error("Save failed:", error);
      alert("팀 정보 저장 중 오류가 발생했습니다.");
    }
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      alert("프리셋 이름을 입력해주세요.");
      return;
    }
    saveTeamPreset(presetName.trim(), wardId, staff);
    setPresets(listTeamPresets());
    setPresetName("");
    alert(`"${presetName.trim()}" 프리셋이 저장되었습니다.`);
  };

  const handleLoadPreset = () => {
    if (!selectedPreset) {
      alert("불러올 프리셋을 선택해주세요.");
      return;
    }
    const preset = loadTeamPreset(selectedPreset);
    if (preset && preset.wardId) {
      setWardId(preset.wardId);
      if (Array.isArray(preset.staff)) {
        setStaff(preset.staff);
      }
      alert(`"${selectedPreset}" 프리셋을 불러왔습니다.`);
    }
  };

  const roleStats = roles.map(role => ({
    role,
    count: staff.filter(s => s.role === role).length,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <a href="/dashboard" className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                ShiftEasy
              </a>
              <nav className="flex items-center gap-6">
                <a href="/schedule" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  스케줄
                </a>
                <a href="/team" className="text-sm font-medium text-blue-600">
                  팀 관리
                </a>
                <a href="/config" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  설정
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveTeam}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                저장하고 다음
                <ChevronRight className="w-4 h-4" />
              </button>
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Ward Info & Stats */}
        <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">병동 ID</label>
                <input
                  type="text"
                  value={wardId}
                  onChange={(e) => setWardId(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              {roleStats.map(stat => (
                <div key={stat.role} className="text-center">
                  <p className="text-sm text-gray-500 mb-1">{ROLE_LABELS[stat.role]}</p>
                  <p className="text-2xl font-semibold text-gray-900">{stat.count}</p>
                </div>
              ))}
              <div className="h-12 w-px bg-gray-200" />
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">총 인원</p>
                <p className="text-2xl font-semibold text-blue-600">{staff.length}</p>
              </div>
            </div>
          </div>

          {/* Preset Management */}
          <div className="flex items-center gap-3 pt-6 border-t border-gray-100">
            <input
              type="text"
              placeholder="프리셋 이름"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSavePreset}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              프리셋 저장
            </button>
            <div className="flex items-center gap-2">
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">프리셋 선택</option>
                {presets.map(preset => (
                  <option key={preset} value={preset}>{preset}</option>
                ))}
              </select>
              <button
                onClick={handleLoadPreset}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Upload className="w-4 h-4" />
                불러오기
              </button>
            </div>
          </div>
        </div>

        {/* Staff List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              팀 구성원
            </h2>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
            >
              <Plus className="w-4 h-4" />
              직원 추가
            </button>
          </div>

          {/* Add Staff Form */}
          {showAddForm && (
            <div className="px-6 py-4 bg-blue-50/50 border-b border-blue-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                  <input
                    type="text"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="예: 김간호"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
                  <select
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as Role })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {roles.map(role => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">경력</label>
                  <select
                    value={newStaff.experienceLevel}
                    onChange={(e) => setNewStaff({ ...newStaff, experienceLevel: e.target.value as Staff["experienceLevel"] })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="JUNIOR">신입</option>
                    <option value="INTERMEDIATE">경력</option>
                    <option value="SENIOR">시니어</option>
                    <option value="EXPERT">전문가</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  취소
                </button>
                <button
                  onClick={handleAddStaff}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  추가
                </button>
              </div>
            </div>
          )}

          {/* Staff Grid */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((member) => (
              <div key={member.id} className="relative group">
                <StaffCard staff={member} />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={() => router.push(`/team/staff/${member.id}?name=${encodeURIComponent(member.name)}`)}
                    className="p-1.5 bg-white rounded-lg shadow-md hover:bg-gray-50"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleRemoveStaff(member.id)}
                    className="p-1.5 bg-white rounded-lg shadow-md hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            ))}

            {staff.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">아직 팀 구성원이 없습니다.</p>
                <p className="text-sm text-gray-400 mt-1">위의 "직원 추가" 버튼을 클릭하여 시작하세요.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}