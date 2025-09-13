"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Upload, Download, Users, ChevronRight, Edit2, Mail, Phone, Calendar, Shield, Clock, Star } from "lucide-react";
import { mockTeamMembers, type MockTeamMember } from "@/lib/mock/team-members";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { AddTeamMemberModal } from "@/components/AddTeamMemberModal";

export default function TeamManagementPage() {
  const router = useRouter();
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [teamMembers, setTeamMembers] = useState<MockTeamMember[]>(mockTeamMembers);
  const [showAddForm, setShowAddForm] = useState(false);

  // 부서별 필터링
  const departments = [
    { id: 'all', name: '전체' },
    { id: 'dept-er', name: '응급실' },
    { id: 'dept-icu', name: '중환자실' },
    { id: 'dept-or', name: '수술실' },
    { id: 'dept-ward', name: '일반병동' },
    { id: 'dept-nursing', name: '간호부' },
  ];

  // 필터링된 멤버 목록
  const filteredMembers = teamMembers.filter(member => {
    const matchesDepartment = selectedDepartment === 'all' || member.departmentId === selectedDepartment;
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          member.position.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

  // 통계 계산
  const stats = {
    total: teamMembers.length,
    active: teamMembers.filter(m => m.status === 'active').length,
    onLeave: teamMembers.filter(m => m.status === 'on-leave').length,
    managers: teamMembers.filter(m => m.role === 'manager' || m.role === 'admin').length,
  };

  const handleRemoveMember = (id: string) => {
    if (confirm('정말로 이 팀원을 삭제하시겠습니까?')) {
      setTeamMembers(teamMembers.filter(m => m.id !== id));
    }
  };

  const handleAddMember = (newMember: Omit<MockTeamMember, "id">) => {
    const member: MockTeamMember = {
      ...newMember,
      id: `member-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setTeamMembers([...teamMembers, member]);
    setShowAddForm(false);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700';
      case 'manager': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'on-leave': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getContractTypeBadge = (type: string) => {
    switch (type) {
      case 'full-time': return '정규직';
      case 'part-time': return '파트타임';
      case 'contract': return '계약직';
      default: return type;
    }
  };

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
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">전체 인원</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}명</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">근무 중</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.active}명</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">휴가 중</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.onLeave}명</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">관리자</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.managers}명</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">부서</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
                <input
                  type="text"
                  placeholder="이름, 이메일, 직책으로 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2 w-64 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              팀원 추가
            </button>
          </div>
        </div>

        {/* Team Members Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <div key={member.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {member.name.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{member.name}</h3>
                    <p className="text-sm text-gray-500">{member.position}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => router.push(`/team/${member.id}`)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{member.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>입사일: {member.joinDate}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)}`}>
                  {member.role === 'admin' ? '관리자' : member.role === 'manager' ? '매니저' : '직원'}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(member.status)}`}>
                  {member.status === 'active' ? '근무중' : member.status === 'on-leave' ? '휴가' : '비활성'}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                  {getContractTypeBadge(member.contractType)}
                </span>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">주 근무시간</span>
                  <span className="font-medium text-gray-900">{member.maxHoursPerWeek}시간</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-500">선호 시프트</span>
                  <div className="flex gap-1">
                    {member.preferredShifts.map(shift => (
                      <span key={shift} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded">
                        {shift === 'day' ? '주간' : shift === 'evening' ? '저녁' : '야간'}
                      </span>
                    ))}
                  </div>
                </div>
                {member.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {member.skills.slice(0, 3).map(skill => (
                      <span key={skill} className="px-2 py-0.5 text-xs bg-gray-50 text-gray-600 rounded">
                        {skill}
                      </span>
                    ))}
                    {member.skills.length > 3 && (
                      <span className="px-2 py-0.5 text-xs bg-gray-50 text-gray-500 rounded">
                        +{member.skills.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredMembers.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">검색 결과가 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">다른 검색어나 필터를 시도해보세요</p>
            </div>
          )}
        </div>
      </main>

      {/* Add Team Member Modal */}
      <AddTeamMemberModal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        onAdd={handleAddMember}
        departments={departments}
      />
    </div>
  );
}