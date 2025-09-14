"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Upload, Download, Users, ChevronRight, Edit2, Mail, Phone, Calendar, Shield, Clock, Star, Settings, Heart, MessageSquare, AlertCircle } from "lucide-react";
import { mockTeamMembers, type MockTeamMember } from "@/lib/mock/team-members";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { AddTeamMemberModal } from "@/components/AddTeamMemberModal";
import { MyPreferencesPanel, type ComprehensivePreferences } from "@/components/team/MyPreferencesPanel";
import { SpecialRequestModal, type SpecialRequest } from "@/components/team/SpecialRequestModal";

export default function TeamManagementPage() {
  const router = useRouter();
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [teamMembers, setTeamMembers] = useState<MockTeamMember[]>(mockTeamMembers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showMyPreferences, setShowMyPreferences] = useState(false);
  const [showSpecialRequest, setShowSpecialRequest] = useState(false);
  const [currentUserId] = useState("member-1"); // 실제로는 로그인한 사용자 ID를 사용
  const [currentUserName] = useState("김간호"); // 실제로는 로그인한 사용자 이름
  const [specialRequests, setSpecialRequests] = useState<SpecialRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on-leave' | 'manager' | 'part-time'>('all');

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

    // 상태 필터링
    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = member.status === 'active';
    } else if (statusFilter === 'on-leave') {
      matchesStatus = member.status === 'on-leave';
    } else if (statusFilter === 'manager') {
      matchesStatus = member.role === 'manager' || member.role === 'admin';
    } else if (statusFilter === 'part-time') {
      matchesStatus = member.contractType === 'part-time';
    }

    return matchesDepartment && matchesSearch && matchesStatus;
  });

  // 통계 계산
  const stats = {
    total: teamMembers.length,
    active: teamMembers.filter(m => m.status === 'active').length,
    onLeave: teamMembers.filter(m => m.status === 'on-leave').length,
    managers: teamMembers.filter(m => m.role === 'manager' || m.role === 'admin').length,
    partTime: teamMembers.filter(m => m.contractType === 'part-time').length,
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

  const handleSavePreferences = async (preferences: ComprehensivePreferences) => {
    try {
      // API를 통해 저장
      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: currentUserId,
          preferences,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      const result = await response.json();
      console.log('Preferences saved:', result);

      // 성공 알림 (실제로는 토스트 사용 권장)
      alert('선호도가 성공적으로 저장되었습니다!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('선호도 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const handleSubmitSpecialRequest = (request: Omit<SpecialRequest, 'id' | 'createdAt' | 'status'>) => {
    const newRequest: SpecialRequest = {
      ...request,
      id: `req-${Date.now()}`,
      createdAt: new Date(),
      status: 'pending'
    };

    setSpecialRequests([...specialRequests, newRequest]);

    // 실제로는 API를 통해 저장
    console.log('Submitting special request:', newRequest);

    // 성공 알림
    alert('특별 요청이 성공적으로 제출되었습니다. 관리자가 곧 검토할 예정입니다.');
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400';
      case 'manager': return 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400';
      case 'on-leave': return 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                ShiftEasy
              </span>
              <nav className="flex items-center gap-6">
                <a href="/dashboard" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  대시보드
                </a>
                <a href="/schedule" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  스케줄
                </a>
                <a href="/swap" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  스왑
                </a>
                <a href="/team" className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  팀 관리
                </a>
                <a href="/config" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
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
        {/* My Preferences Section - 현재 사용자용 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-6 mb-8 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <Heart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">나의 근무 선호도</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  개인 상황과 선호도를 입력하면 AI가 최적의 스케줄을 생성합니다
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMyPreferences(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                <Settings className="w-4 h-4" />
                선호도 설정
              </button>
              <button
                onClick={() => setShowSpecialRequest(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                특별 요청
              </button>
            </div>
          </div>

          {/* 현재 설정된 선호도 요약 */}
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">선호 시프트</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">주간</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">주말 근무</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">상관없음</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">최대 연속 근무</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">5일</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">특별 요청</p>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {specialRequests.filter(r => r.employeeId === currentUserId && r.status === 'pending').length}건 대기중
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards - 클릭 가능한 필터 카드들 */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <button
            onClick={() => setStatusFilter('all')}
            className={`bg-white dark:bg-gray-900 rounded-xl p-6 border transition-all ${
              statusFilter === 'all' ? 'border-blue-500 dark:border-blue-400 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">전체 인원</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.total}명</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setStatusFilter('active')}
            className={`bg-white dark:bg-gray-900 rounded-xl p-6 border transition-all ${
              statusFilter === 'active' ? 'border-green-500 dark:border-green-400 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">근무 중</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.active}명</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setStatusFilter('on-leave')}
            className={`bg-white dark:bg-gray-900 rounded-xl p-6 border transition-all ${
              statusFilter === 'on-leave' ? 'border-yellow-500 dark:border-yellow-400 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">휴가 중</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.onLeave}명</p>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setStatusFilter('manager')}
            className={`bg-white dark:bg-gray-900 rounded-xl p-6 border transition-all ${
              statusFilter === 'manager' ? 'border-purple-500 dark:border-purple-400 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">관리자</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.managers}명</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setStatusFilter('part-time')}
            className={`bg-white dark:bg-gray-900 rounded-xl p-6 border transition-all ${
              statusFilter === 'part-time' ? 'border-orange-500 dark:border-orange-400 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">파트타임</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.partTime}명</p>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </button>
        </div>

        {/* Filters and Search */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">부서</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100"
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">검색</label>
                <input
                  type="text"
                  placeholder="이름, 이메일, 직책으로 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              <Plus className="w-4 h-4" />
              팀원 추가
            </button>
          </div>
        </div>

        {/* Team Members Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <div key={member.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                      onError={(e) => {
                        // 이미지 로드 실패시 기본 아바타로 대체
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center ${member.avatar ? 'hidden' : ''}`}>
                    <Users className="w-6 h-6 text-gray-400 dark:text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{member.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{member.position}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => router.push(`/team/${member.id}`)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span className="truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span>{member.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span>입사일: {member.joinDate}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {(member.role === 'admin' || member.role === 'manager') && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)}`}>
                    {member.role === 'admin' ? '관리자' : '매니저'}
                  </span>
                )}
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(member.status)}`}>
                  {member.status === 'active' ? '근무중' : member.status === 'on-leave' ? '휴가' : '비활성'}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {getContractTypeBadge(member.contractType)}
                </span>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">주 근무시간</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{member.maxHoursPerWeek}시간</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-500 dark:text-gray-400">선호 시프트</span>
                  <div className="flex gap-1">
                    {member.preferredShifts.map(shift => (
                      <span key={shift} className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded">
                        {shift === 'day' ? '주간' : shift === 'evening' ? '저녁' : '야간'}
                      </span>
                    ))}
                  </div>
                </div>
                {member.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {member.skills.slice(0, 3).map(skill => (
                      <span key={skill} className="px-2 py-0.5 text-xs bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                        {skill}
                      </span>
                    ))}
                    {member.skills.length > 3 && (
                      <span className="px-2 py-0.5 text-xs bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
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
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">검색 결과가 없습니다</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">다른 검색어나 필터를 시도해보세요</p>
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

      {/* My Preferences Panel */}
      <MyPreferencesPanel
        isOpen={showMyPreferences}
        onClose={() => setShowMyPreferences(false)}
        currentUserId={currentUserId}
        onSave={handleSavePreferences}
      />

      {/* Special Request Modal */}
      <SpecialRequestModal
        isOpen={showSpecialRequest}
        onClose={() => setShowSpecialRequest(false)}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onSubmit={handleSubmitSpecialRequest}
        existingRequests={specialRequests.filter(r => r.employeeId === currentUserId)}
      />
    </div>
  );
}