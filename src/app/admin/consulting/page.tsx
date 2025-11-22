'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Phone,
  Mail,
  Building,
  Users,
  FileText,
  Download,
  Search
} from 'lucide-react';

type StatusType = 'pending' | 'reviewing' | 'contacted' | 'completed' | 'rejected';

const statusConfig: Record<StatusType, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: {
    label: '대기',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: Clock,
  },
  reviewing: {
    label: '검토중',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: Eye,
  },
  contacted: {
    label: '연락완료',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: Phone,
  },
  completed: {
    label: '완료',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: CheckCircle,
  },
  rejected: {
    label: '거절',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: XCircle,
  },
};

export default function ConsultingRequestsPage() {
  const [selectedStatus, setSelectedStatus] = useState<StatusType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  // Fetch consulting requests
  const { data, isLoading, refetch } = api.consulting.getAll.useQuery({
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    limit: 100,
    offset: 0,
  });

  // Fetch statistics
  const { data: stats } = api.consulting.getStatistics.useQuery();

  // Fetch selected request details
  const { data: requestDetails } = api.consulting.getById.useQuery(
    { id: selectedRequest! },
    { enabled: !!selectedRequest }
  );

  // Update status mutation
  const updateStatus = api.consulting.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const filteredRequests = data?.requests.filter(request => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      request.companyName.toLowerCase().includes(query) ||
      request.contactName.toLowerCase().includes(query) ||
      request.email.toLowerCase().includes(query) ||
      request.phone.toLowerCase().includes(query)
    );
  }) || [];

  const handleStatusChange = async (id: string, newStatus: StatusType) => {
    try {
      await updateStatus.mutateAsync({
        id,
        status: newStatus,
      });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">컨설팅 요청 관리</h1>
          <p className="text-gray-600">고객의 무료 컨설팅 요청을 확인하고 관리하세요</p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatCard
              label="전체"
              value={stats.total}
              color="bg-gray-100 text-gray-700"
            />
            <StatCard
              label="대기"
              value={stats.pending}
              color="bg-yellow-100 text-yellow-700"
            />
            <StatCard
              label="검토중"
              value={stats.reviewing}
              color="bg-blue-100 text-blue-700"
            />
            <StatCard
              label="연락완료"
              value={stats.contacted}
              color="bg-purple-100 text-purple-700"
            />
            <StatCard
              label="완료"
              value={stats.completed}
              color="bg-green-100 text-green-700"
            />
            <StatCard
              label="거절"
              value={stats.rejected}
              color="bg-red-100 text-red-700"
            />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="회사명, 담당자, 이메일, 연락처로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              <FilterButton
                label="전체"
                active={selectedStatus === 'all'}
                onClick={() => setSelectedStatus('all')}
              />
              {Object.entries(statusConfig).map(([status, config]) => (
                <FilterButton
                  key={status}
                  label={config.label}
                  active={selectedStatus === status}
                  onClick={() => setSelectedStatus(status as StatusType)}
                  color={config.bgColor}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Requests List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              로딩 중...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>요청이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      회사 / 담당자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      연락처
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      업종 / 규모
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      파일 수
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      신청일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRequests.map((request) => (
                    <RequestRow
                      key={request.id}
                      request={request}
                      onViewDetails={() => setSelectedRequest(request.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {selectedRequest && requestDetails && (
          <RequestDetailModal
            request={requestDetails}
            onClose={() => setSelectedRequest(null)}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg p-4 ${color}`}>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm font-medium">{label}</div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
  color = 'bg-gray-100'
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
        active
          ? `${color} ring-2 ring-blue-500`
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

interface RequestRowProps {
  request: {
    id: string;
    companyName: string;
    contactName: string;
    phone: string;
    email: string;
    industry: string;
    teamSize: string;
    status: string;
    files?: unknown[];
    createdAt: Date;
  };
  onViewDetails: () => void;
}

function RequestRow({
  request,
  onViewDetails
}: RequestRowProps) {
  const status = request.status as StatusType;
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm font-medium text-gray-900">{request.companyName}</div>
          <div className="text-sm text-gray-500">{request.contactName}</div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{request.phone}</div>
        <div className="text-sm text-gray-500">{request.email}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{request.industry}</div>
        <div className="text-sm text-gray-500">{request.teamSize}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {request.files?.length || 0}개
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full ${config.bgColor} ${config.color} text-xs font-medium`}>
          <Icon className="w-3 h-3" />
          {config.label}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(request.createdAt).toLocaleDateString('ko-KR')}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <button
          onClick={onViewDetails}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          상세보기
        </button>
      </td>
    </tr>
  );
}

interface RequestDetailModalProps {
  request: {
    id: string;
    companyName: string;
    contactName: string;
    phone: string;
    email: string;
    industry: string;
    teamSize: string;
    currentMethod: string;
    status: string;
    painPoints: string;
    specialRequirements: string;
    additionalNotes?: string | null;
    files?: Array<{
      name: string;
      url: string;
      size: number;
      uploadedAt: string;
    }>;
    createdAt: Date;
  };
  onClose: () => void;
  onStatusChange: (id: string, status: StatusType) => void;
}

function RequestDetailModal({
  request,
  onClose,
  onStatusChange
}: RequestDetailModalProps) {
  const status = request.status as StatusType;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">컨설팅 요청 상세</h2>
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Status Change */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-semibold text-gray-700 mb-2">상태 변경</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(statusConfig).map(([statusKey, statusCfg]) => {
                const StatusIcon = statusCfg.icon;
                return (
                  <button
                    key={statusKey}
                    onClick={() => onStatusChange(request.id, statusKey as StatusType)}
                    className={`inline-flex items-center gap-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      status === statusKey
                        ? `${statusCfg.bgColor} ${statusCfg.color} ring-2 ring-blue-500`
                        : `bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`
                    }`}
                  >
                    <StatusIcon className="w-4 h-4" />
                    {statusCfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <InfoField label="회사명" value={request.companyName} icon={Building} />
            <InfoField label="담당자" value={request.contactName} icon={Users} />
            <InfoField label="연락처" value={request.phone} icon={Phone} />
            <InfoField label="이메일" value={request.email} icon={Mail} />
            <InfoField label="업종" value={request.industry} />
            <InfoField label="팀 규모" value={request.teamSize} />
            <InfoField label="현재 방식" value={request.currentMethod} />
            <InfoField label="신청일" value={new Date(request.createdAt).toLocaleString('ko-KR')} />
          </div>

          {/* Files */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">첨부 파일 ({request.files?.length || 0}개)</h3>
            <div className="space-y-2">
              {request.files?.map((file, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.uploadedAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                  <a
                    href={file.url}
                    download={file.name}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Information */}
          <div className="space-y-4">
            <DetailField label="불편했던 점" value={request.painPoints} />
            <DetailField label="특수 요구사항" value={request.specialRequirements} />
            {request.additionalNotes && (
              <DetailField label="기타 문의사항" value={request.additionalNotes} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        <p className="text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-900 whitespace-pre-wrap">{value}</p>
      </div>
    </div>
  );
}
