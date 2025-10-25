"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Upload, Download, Users, ChevronRight, Edit2, Mail, Phone, Calendar, Shield, Clock, Star, Settings, Heart, MessageSquare, AlertCircle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { AddTeamMemberModal } from "@/components/AddTeamMemberModal";
import { MyPreferencesPanel, type ComprehensivePreferences } from "@/components/team/MyPreferencesPanel";
import { SpecialRequestModal, type SpecialRequest } from "@/components/team/SpecialRequestModal";
import { TeamPatternPanel } from "@/components/team/TeamPatternPanel";
import { api } from "@/lib/trpc/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { RoleGuard } from "@/components/auth/RoleGuard";

export default function TeamManagementPage() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const currentUserRole = currentUser.role || "member";
  const managerDepartmentId = currentUser.dbUser?.departmentId ?? null;
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on-leave' | 'manager' | 'part-time'>('all');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [statusFilterForApi, setStatusFilterForApi] = useState<'active' | 'on_leave' | undefined>();
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [editingPositionValue, setEditingPositionValue] = useState<string>("");
  const [showMyPreferences, setShowMyPreferences] = useState(false);
  const [showSpecialRequest, setShowSpecialRequest] = useState(false);
  const [specialRequests, setSpecialRequests] = useState<SpecialRequest[]>([]);

const currentUserId = currentUser.userId || "user-1";
const currentUserName = currentUser.name || "사용자";

  // Fetch users from TRPC
  const { data: usersData, isLoading: isLoadingUsers, refetch: refetchUsers } = api.tenant.users.list.useQuery({
    limit: 100,
    offset: 0,
    search: searchQuery || undefined,
    departmentId:
      currentUserRole === 'manager'
        ? managerDepartmentId ?? undefined
        : selectedDepartment !== 'all'
          ? selectedDepartment
          : undefined,
    role: roleFilter as any,
    status: statusFilterForApi,
  });

  // Fetch departments from TRPC
  const { data: departmentsData, isLoading: isLoadingDepartments } = api.tenant.departments.list.useQuery({
    limit: 50,
    offset: 0,
  });

  // Fetch tenant stats
  const { data: statsData } = api.tenant.stats.summary.useQuery();

  // Mutations
  const inviteUserMutation = api.tenant.users.invite.useMutation({
    onSuccess: () => {
      refetchUsers();
      setShowAddForm(false);
    },
  });

  const deactivateUserMutation = api.tenant.users.deactivate.useMutation({
    onSuccess: () => {
      refetchUsers();
    },
  });

  const updatePositionMutation = api.tenant.users.updatePosition.useMutation({
    onSuccess: () => {
      refetchUsers();
      setEditingPositionId(null);
      setEditingPositionValue("");
    },
    onError: (error) => {
      alert(error.message || '직급 변경 중 오류가 발생했습니다.');
    },
  });

  // Process departments for UI
const managerDepartmentName =
  (departmentsData?.items as any[] || []).find(
    (dept: any) => dept.id === managerDepartmentId
  )?.name;

const departments =
  currentUserRole === 'manager'
    ? managerDepartmentId
      ? [
          {
            id: managerDepartmentId,
            name: managerDepartmentName || '내 병동',
          },
        ]
      : []
    : [
        { id: 'all', name: '전체' },
        ...((departmentsData?.items as any[] || []).map((dept: any) => ({
          id: dept.id,
          name: dept.name,
        })) || []),
      ];

  // Update status filter effect
  useEffect(() => {
    if (currentUserRole === 'manager' && managerDepartmentId) {
      setSelectedDepartment(managerDepartmentId);
    }
  }, [currentUserRole, managerDepartmentId]);

  useEffect(() => {
    if (statusFilter === 'active') {
      setStatusFilterForApi('active');
      setRoleFilter(undefined);
    } else if (statusFilter === 'on-leave') {
      setStatusFilterForApi('on_leave');
      setRoleFilter(undefined);
    } else if (statusFilter === 'manager') {
      setStatusFilterForApi(undefined);
      setRoleFilter('manager');
    } else {
      setStatusFilterForApi(undefined);
      setRoleFilter(undefined);
    }
  }, [statusFilter]);

  // Process users data
  const rawTeamMembers = (usersData?.items || []) as any[];

  const teamMembers = useMemo(() => {
    if (currentUserRole === 'manager') {
      const myUserId = currentUser.dbUser?.id;
      return rawTeamMembers.filter((member: any) => {
        if (member.id === myUserId) {
          return true;
        }
        return member.role === 'member';
      });
    }
    return rawTeamMembers;
  }, [rawTeamMembers, currentUserRole, currentUser.dbUser?.id]);

  // 통계 계산
  const stats = {
    total: teamMembers.length,
    active: teamMembers.filter((m: any) => m.status === 'active').length,
    onLeave: teamMembers.filter((m: any) => m.status === 'on_leave').length,
    managers: teamMembers.filter((m: any) => ['manager', 'admin'].includes(m.role)).length,
    partTime: 0, // TODO: Add contract type to schema
  };

  const handleRemoveMember = async (id: string) => {
    if (confirm('정말로 이 팀원을 비활성화하시겠습니까?')) {
      await deactivateUserMutation.mutateAsync({ userId: id });
    }
  };

  const handleEditPosition = (memberId: string, currentPosition: string) => {
    setEditingPositionId(memberId);
    setEditingPositionValue(currentPosition || '');
  };

  const handleSavePosition = async (memberId: string) => {
    if (!editingPositionValue.trim()) {
      alert('직급을 입력해주세요.');
      return;
    }

    await updatePositionMutation.mutateAsync({
      userId: memberId,
      position: editingPositionValue.trim(),
    });
  };

  const handleCancelEditPosition = () => {
    setEditingPositionId(null);
    setEditingPositionValue("");
  };

  const canEditPosition = () => {
    return ['owner', 'admin', 'manager'].includes(currentUserRole);
  };

  const handleAddMember = async (newMember: any) => {
    await inviteUserMutation.mutateAsync({
      email: newMember.email,
      name: newMember.name,
      role: newMember.role || 'member',
      departmentId: newMember.departmentId !== 'all' ? newMember.departmentId : undefined,
      employeeId: newMember.employeeId,
      position: newMember.position,
    });
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
    <RoleGuard>
      <MainLayout>
        {/* Team Pattern Section - 팀 패턴 설정 */}
        {(currentUserRole === 'admin' || currentUserRole === 'manager') &&
         (currentUserRole === 'manager' ? managerDepartmentId : selectedDepartment !== 'all') && (
          <div className="mb-6 sm:mb-8">
            <TeamPatternPanel
              departmentId={
                currentUserRole === 'manager'
                  ? managerDepartmentId || ''
                  : selectedDepartment !== 'all' ? selectedDepartment : ''
              }
              totalMembers={stats.total}
              canEdit={currentUserRole === 'admin' || currentUserRole === 'manager'}
            />
          </div>
        )}

        {/* My Preferences Section - 현재 사용자용 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 border border-blue-200 dark:border-blue-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">나의 근무 선호도</h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">
                  개인 상황과 선호도를 입력하면 AI가 최적의 스케줄을 생성합니다
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setShowMyPreferences(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">선호도 설정</span>
                <span className="sm:hidden">설정</span>
              </button>
              <button
                onClick={() => setShowSpecialRequest(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">특별 요청</span>
                <span className="sm:hidden">요청</span>
              </button>
            </div>
          </div>

          {/* 현재 설정된 선호도 요약 - 모바일에서는 2열 그리드 */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">선호 시프트</p>
              <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">주간</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">주말 근무</p>
              <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">상관없음</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">최대 연속</p>
              <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">5일</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">특별 요청</p>
              <p className="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400">
                {specialRequests.filter(r => r.employeeId === currentUserId && r.status === 'pending').length}건
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards - 모바일 스크롤 가능한 필터 카드들 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={() => setStatusFilter('all')}
            className={`bg-white dark:bg-gray-900 rounded-xl p-3 sm:p-4 lg:p-6 border transition-all ${
              statusFilter === 'all' ? 'border-blue-500 dark:border-blue-400 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-left">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">전체 인원</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-1">{stats.total}명</p>
              </div>
              <div className="hidden sm:block p-2 lg:p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <Users className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setStatusFilter('active')}
            className={`bg-white dark:bg-gray-900 rounded-xl p-3 sm:p-4 lg:p-6 border transition-all ${
              statusFilter === 'active' ? 'border-green-500 dark:border-green-400 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-left">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">근무 중</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-1">{stats.active}명</p>
              </div>
              <div className="hidden sm:block p-2 lg:p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setStatusFilter('on-leave')}
            className={`bg-white dark:bg-gray-900 rounded-xl p-3 sm:p-4 lg:p-6 border transition-all ${
              statusFilter === 'on-leave' ? 'border-yellow-500 dark:border-yellow-400 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-left">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">휴직 중</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-1">{stats.onLeave}명</p>
              </div>
              <div className="hidden sm:block p-2 lg:p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                <Calendar className="w-5 h-5 lg:w-6 lg:h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setStatusFilter('manager')}
            className={`bg-white dark:bg-gray-900 rounded-xl p-3 sm:p-4 lg:p-6 border transition-all ${
              statusFilter === 'manager' ? 'border-purple-500 dark:border-purple-400 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-left">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">관리자</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-1">{stats.managers}명</p>
              </div>
              <div className="hidden sm:block p-2 lg:p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                <Shield className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setStatusFilter('part-time')}
            className={`bg-white dark:bg-gray-900 rounded-xl p-3 sm:p-4 lg:p-6 border transition-all col-span-2 sm:col-span-1 ${
              statusFilter === 'part-time' ? 'border-orange-500 dark:border-orange-400 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-left">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">파트타임</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-1">{stats.partTime}명</p>
              </div>
              <div className="hidden sm:block p-2 lg:p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </button>
        </div>

        {/* Filters and Search - 모바일 최적화 */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 mb-4 sm:mb-6">
          {currentUserRole === 'manager' && managerDepartmentId && (
            <div className="mb-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs sm:text-sm text-blue-800 dark:text-blue-300">
              담당 병동에 속한 팀원만 조회 및 관리할 수 있습니다.
            </div>
          )}
          {currentUserRole === 'manager' && managerDepartmentId && (
            <div className="mb-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs sm:text-sm text-blue-800 dark:text-blue-300">
              담당 병동에 속한 팀원만 조회 및 관리할 수 있습니다.
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1">
              <div className="flex-1 sm:flex-none">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">부서</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  disabled={currentUserRole === 'manager'}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed disabled:dark:bg-gray-800 disabled:dark:text-gray-500"
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">검색</label>
                <input
                  type="text"
                  placeholder="이름, 이메일, 직책"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              disabled={currentUserRole === 'manager'}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                currentUserRole === 'manager'
                  ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                  : 'text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">팀원 추가</span>
              <span className="sm:hidden">추가</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoadingUsers && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Team Members Grid - 모바일 최적화 */}
        {!isLoadingUsers && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {teamMembers.map((member) => (
            <div key={member.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  {(member.profile as any)?.avatar ? (
                    <img
                      src={(member.profile as any)?.avatar}
                      alt={member.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                      onError={(e) => {
                        // 이미지 로드 실패시 기본 아바타로 대체
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center ${(member.profile as any)?.avatar ? 'hidden' : ''}`}>
                    <Users className="w-6 h-6 text-gray-400 dark:text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">{member.name}</h3>
                    {editingPositionId === member.id ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="text"
                          value={editingPositionValue}
                          onChange={(e) => setEditingPositionValue(e.target.value)}
                          className="px-2 py-1 text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="직급 입력"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSavePosition(member.id);
                            } else if (e.key === 'Escape') {
                              handleCancelEditPosition();
                            }
                          }}
                        />
                        <button
                          onClick={() => handleSavePosition(member.id)}
                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                          title="저장"
                        >
                          <Save className="w-3 h-3 text-green-600 dark:text-green-400" />
                        </button>
                        <button
                          onClick={handleCancelEditPosition}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                          title="취소"
                        >
                          <span className="text-xs">✕</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{member.position || '팀원'}</p>
                        {canEditPosition() && (
                          <button
                            onClick={() => handleEditPosition(member.id, member.position || '')}
                            className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-opacity"
                            title="직급 수정"
                          >
                            <Edit2 className="w-3 h-3 text-gray-400" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  {/* 상세 페이지는 아직 구현되지 않음
                  <button
                    onClick={() => router.push(`/team/${member.id}`)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  */}
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                  </button>
                </div>
              </div>

              {/* 모바일에서는 연락처 정보 숨기기 */}
              <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 hidden sm:block">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <Mail className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-gray-400 dark:text-gray-500" />
                  <span className="truncate">{member.email}</span>
                </div>
                {(member.profile as any)?.phone && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    <Phone className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-gray-400 dark:text-gray-500" />
                    <span>{(member.profile as any).phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-gray-400 dark:text-gray-500" />
                  <span>가입일: {new Date(member.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                {(member.role === 'admin' || member.role === 'manager') && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)}`}>
                    {member.role === 'admin' ? '관리자' : '매니저'}
                  </span>
                )}
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(member.status === 'on_leave' ? 'on-leave' : member.status)}`}>
                  {member.status === 'active' ? '근무중' : member.status === 'on_leave' ? '휴직' : '비활성'}
                </span>
              </div>

              <div className="pt-3 sm:pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500 dark:text-gray-400">부서</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {member.department?.name || '미지정'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm mt-1">
                  <span className="text-gray-500 dark:text-gray-400">사원번호</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {member.employeeId || '-'}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {teamMembers.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">검색 결과가 없습니다</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">다른 검색어나 필터를 시도해보세요</p>
            </div>
          )}
        </div>
        )}

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

    </MainLayout>
    </RoleGuard>
  );
}
