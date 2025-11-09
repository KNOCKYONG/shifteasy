"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, Save, Upload, Download, Users, ChevronRight, Edit2, Mail, Phone, Calendar, Shield, Clock, Star, AlertCircle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { AddTeamMemberModal } from "@/components/AddTeamMemberModal";
import { EditTeamMemberModal } from "@/components/EditTeamMemberModal";
import { TeamPatternTab } from "@/components/department/TeamPatternTab";
import { DepartmentSelectModal } from "@/components/department/DepartmentSelectModal";
import { TeamsTab } from "@/app/config/TeamsTab";
import { api } from "@/lib/trpc/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { RoleGuard } from "@/components/auth/RoleGuard";

function TeamManagementPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useCurrentUser();
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const currentUserRole = currentUser.role || "member";
  const managerDepartmentId = currentUser.dbUser?.departmentId ?? null;
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on-leave' | 'manager' | 'part-time'>('all');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [statusFilterForApi, setStatusFilterForApi] = useState<'active' | 'on_leave' | undefined>();
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [editingPositionValue, setEditingPositionValue] = useState<string>("");

  // URL 쿼리 파라미터에서 tab 읽기
  const tabFromUrl = searchParams.get('tab') as 'pattern' | 'management' | 'assignment' | null;
  const [activeTab, setActiveTab] = useState<'pattern' | 'management' | 'assignment'>(tabFromUrl || 'pattern');

  // URL 변경 시 activeTab 업데이트
  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

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

  // Fetch shift types from configs table (department-specific with fallback)
  const { data: shiftTypesData } = api.shiftTypes.getAll.useQuery(
    {
      departmentId: selectedDepartment !== 'all' ? selectedDepartment : undefined,
    },
    {
      staleTime: 10 * 60 * 1000, // 10분 동안 fresh 유지
      refetchOnWindowFocus: false,
    }
  );

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

  const activateUserMutation = api.tenant.users.activate.useMutation({
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

  // 실제 부서 개수 계산 ('all' 제외)
  const actualDepartmentCount = departments.filter(d => d.id !== 'all').length;
  const shouldUseModal = actualDepartmentCount > 5;

  // 선택된 부서 이름 가져오기 - departmentsData에서 직접 찾기
  const selectedDepartmentName = selectedDepartment === 'all'
    ? '전체'
    : (departmentsData?.items as any[] || []).find((dept: any) => dept.id === selectedDepartment)?.name || '선택된 부서';

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
    // Show ALL users including inactive in department management
    // (Inactive users will be filtered out only from schedule views)
    if (currentUserRole === 'admin') {
      // Admins can see all users in the tenant
      return rawTeamMembers;
    } else if (currentUserRole === 'manager') {
      // Managers can only see themselves and members in their department
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

  // 통계 계산 (비활성 인원 제외)
  const activeMembers = teamMembers.filter((m: any) => m.status !== 'inactive');
  const stats = {
    total: activeMembers.length,
    active: activeMembers.filter((m: any) => m.status === 'active').length,
    onLeave: activeMembers.filter((m: any) => m.status === 'on_leave').length,
    managers: activeMembers.filter((m: any) => ['manager', 'admin'].includes(m.role)).length,
    partTime: 0, // TODO: Add contract type to schema
  };

  // Department Pattern용 필터링된 전체 인원 (비활성 및 근무 패턴이 '행정 근무'인 사람 제외)
  const filteredTotalMembers = teamMembers.filter((m: any) => {
    // 비활성 인원 제외
    if (m.status === 'inactive') {
      return false;
    }
    // 근무 패턴이 'weekday-only' (행정 근무)인 경우만 제외
    if (m.workPatternType === 'weekday-only') {
      return false;
    }
    return true;
  }).length;

  const handleToggleActivation = async (id: string, currentStatus: string) => {
    if (currentStatus === 'inactive') {
      if (confirm('이 부서원을 활성화하시겠습니까?')) {
        await activateUserMutation.mutateAsync({ userId: id });
      }
    } else {
      if (confirm('이 부서원을 비활성화하시겠습니까? 비활성화된 직원은 모든 목록과 스케줄에서 숨겨집니다.')) {
        await deactivateUserMutation.mutateAsync({ userId: id });
      }
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

  const handleMemberClick = (member: any) => {
    console.log('Member clicked:', member.name, 'Current role:', currentUserRole);
    // Only allow managers and admins to edit member info
    if (currentUserRole === 'manager' || currentUserRole === 'admin' || currentUserRole === 'owner') {
      console.log('Opening edit modal for:', member.name);
      setSelectedMember(member);
      setShowEditForm(true);
    } else {
      console.log('User does not have permission to edit. Role:', currentUserRole);
    }
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

        {/* Tab Content */}
        {activeTab === 'pattern' ? (
          <TeamPatternTab
            departmentId={selectedDepartment !== 'all' ? selectedDepartment : ''}
            departmentName={selectedDepartmentName}
            totalMembers={filteredTotalMembers}
            canEdit={currentUserRole === 'admin' || currentUserRole === 'manager'}
            shiftTypes={shiftTypesData || []}
          />
        ) : activeTab === 'assignment' ? (
          <TeamsTab />
        ) : (
          <>
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
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1">
              <div className="flex-1 sm:flex-none">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">부서</label>
                {shouldUseModal ? (
                  <button
                    onClick={() => setShowDepartmentModal(true)}
                    disabled={currentUserRole === 'manager'}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed disabled:dark:bg-gray-800 disabled:dark:text-gray-500 text-left flex items-center justify-between"
                  >
                    <span>{selectedDepartmentName}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
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
                )}
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
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">부서원 추가</span>
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
            <div
              key={member.id}
              onClick={() => handleMemberClick(member)}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow cursor-pointer"
            >
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
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{member.position || '부서원'}</p>
                        {canEditPosition() && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditPosition(member.id, member.position || '');
                            }}
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleActivation(member.id, member.status);
                    }}
                    className={`p-1.5 rounded-lg transition-colors ${
                      member.status === 'inactive'
                        ? 'hover:bg-green-50 dark:hover:bg-green-950/30'
                        : 'hover:bg-red-50 dark:hover:bg-red-950/30'
                    }`}
                    title={member.status === 'inactive' ? '활성화' : '비활성화'}
                  >
                    {member.status === 'inactive' ? (
                      <svg className="w-4 h-4 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                    )}
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
          </>
        )}

        {/* Add Team Member Modal */}
      <AddTeamMemberModal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        onAdd={handleAddMember}
        departments={departments}
        currentUserRole={currentUserRole}
        managerDepartmentId={currentUserRole === 'manager' ? managerDepartmentId : undefined}
        isLoading={inviteUserMutation.isPending}
      />

      {/* Edit Team Member Modal */}
      <EditTeamMemberModal
        isOpen={showEditForm}
        onClose={() => {
          setShowEditForm(false);
          setSelectedMember(null);
        }}
        member={selectedMember}
        departments={departments}
        onUpdate={() => {
          refetchUsers();
        }}
      />

      {/* Department Select Modal */}
      <DepartmentSelectModal
        isOpen={showDepartmentModal}
        onClose={() => setShowDepartmentModal(false)}
        departments={departments}
        selectedDepartmentId={selectedDepartment}
        onSelect={setSelectedDepartment}
      />

    </MainLayout>
    </RoleGuard>
  );
}

export default function TeamManagementPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TeamManagementPageContent />
    </Suspense>
  );
}
