"use client";

import { useState } from "react";
import {
  X, Calendar, Clock, AlertCircle, MessageSquare,
  Heart, Plane, Home,
  Users, AlertTriangle, CheckCircle, Info
} from "lucide-react";

export interface SpecialRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'temporary' | 'urgent' | 'permanent';
  category: 'personal' | 'health' | 'family' | 'education' | 'other';
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected' | 'in-review';
  attachments?: string[];
  managerNotes?: string;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

interface SpecialRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserName: string;
  onSubmit: (request: Omit<SpecialRequest, 'id' | 'createdAt' | 'status'>) => void;
  existingRequests?: SpecialRequest[];
}

export function SpecialRequestModal({
  isOpen,
  onClose,
  currentUserId,
  currentUserName,
  onSubmit,
  existingRequests = []
}: SpecialRequestModalProps) {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [requestType, setRequestType] = useState<'temporary' | 'urgent' | 'permanent'>('temporary');
  const [category, setCategory] = useState<SpecialRequest['category']>('personal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState<SpecialRequest['priority']>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // 빠른 템플릿
  const quickTemplates = [
    {
      icon: Heart,
      label: '육아 관련',
      category: 'family' as const,
      title: '육아로 인한 근무 조정 요청',
      description: '어린 자녀 육아로 인해 특정 시간대 근무가 어렵습니다.'
    },
    {
      icon: Users,
      label: '학업 병행',
      category: 'education' as const,
      title: '학업 일정에 따른 스케줄 조정',
      description: '대학원 수업 참석을 위해 특정 요일 근무 조정이 필요합니다.'
    },
    {
      icon: Heart,
      label: '가족 간병',
      category: 'family' as const,
      title: '가족 간병으로 인한 근무 제한',
      description: '가족 간병이 필요하여 야간 근무가 어렵습니다.'
    },
    {
      icon: Heart,
      label: '건강 사유',
      category: 'health' as const,
      title: '건강상 이유로 근무 조정 필요',
      description: '건강상의 이유로 특정 업무나 시간대 근무가 제한됩니다.'
    },
    {
      icon: Plane,
      label: '개인 휴가',
      category: 'personal' as const,
      title: '개인 사유로 인한 휴가 요청',
      description: '개인적인 사유로 특정 기간 휴가가 필요합니다.'
    },
    {
      icon: Home,
      label: '이사/이전',
      category: 'personal' as const,
      title: '거주지 이전으로 인한 일시적 조정',
      description: '이사로 인해 일시적으로 근무 시간 조정이 필요합니다.'
    }
  ];

  const handleTemplateSelect = (template: typeof quickTemplates[0]) => {
    setCategory(template.category);
    setTitle(template.title);
    setDescription(template.description);
  };

  const handleSubmit = () => {
    if (!title || !description || !startDate) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    const request: Omit<SpecialRequest, 'id' | 'createdAt' | 'status'> = {
      employeeId: currentUserId,
      employeeName: currentUserName,
      type: requestType,
      category,
      title,
      description,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      priority,
    };

    // 제출 시뮬레이션
    setTimeout(() => {
      onSubmit(request);
      setIsSubmitting(false);

      // 폼 초기화
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setPriority('medium');

      // 성공 메시지 후 닫기
      setTimeout(() => {
        onClose();
      }, 1500);
    }, 1000);
  };

  const getPriorityColor = (priority: SpecialRequest['priority']) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
    }
  };

  const getStatusColor = (status: SpecialRequest['status']) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      case 'in-review': return 'text-blue-600 bg-blue-50';
      case 'pending': return 'text-gray-600 bg-gray-50';
    }
  };

  const renderNewRequest = () => (
    <div className="space-y-6">
      {/* 요청 유형 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">요청 유형</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'temporary' as const, label: '일시적', description: '특정 기간 동안만' },
            { value: 'urgent' as const, label: '긴급', description: '즉시 처리 필요' },
            { value: 'permanent' as const, label: '영구적', description: '계속 유지' }
          ].map(type => (
            <button
              key={type.value}
              onClick={() => setRequestType(type.value)}
              className={`p-3 rounded-lg border-2 transition-all ${
                requestType === type.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-sm">{type.label}</p>
              <p className="text-xs text-gray-500 mt-1">{type.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 빠른 템플릿 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">빠른 템플릿 선택</label>
        <div className="grid grid-cols-3 gap-2">
          {quickTemplates.map((template, idx) => (
            <button
              key={idx}
              onClick={() => handleTemplateSelect(template)}
              className="flex items-center gap-2 p-2 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <template.icon className="w-4 h-4 text-gray-500" />
              <span className="text-sm">{template.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 요청 내용 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          요청 제목 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="요청 사항을 간단히 요약해주세요"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          상세 설명 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="구체적인 상황과 필요한 조치를 설명해주세요"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
        />
      </div>

      {/* 기간 설정 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            시작일 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            종료일 {requestType === 'permanent' && '(선택)'}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={requestType === 'permanent'}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
        </div>
      </div>

      {/* 우선순위 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">우선순위</label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: 'low' as const, label: '낮음', color: 'green' },
            { value: 'medium' as const, label: '보통', color: 'yellow' },
            { value: 'high' as const, label: '높음', color: 'orange' },
            { value: 'critical' as const, label: '긴급', color: 'red' }
          ].map(p => (
            <button
              key={p.value}
              onClick={() => setPriority(p.value)}
              className={`py-2 px-3 rounded-lg border-2 transition-all text-sm font-medium ${
                priority === p.value
                  ? `border-${p.color}-500 bg-${p.color}-50 text-${p.color}-700`
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-1">요청 처리 안내</p>
            <ul className="space-y-1 text-xs">
              <li>• 긴급 요청은 24시간 내 검토됩니다</li>
              <li>• 일반 요청은 3-5일 내 처리됩니다</li>
              <li>• 승인 시 다음 스케줄부터 반영됩니다</li>
              <li>• 추가 서류가 필요할 수 있습니다</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-4">
      {existingRequests.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">제출한 요청이 없습니다</p>
        </div>
      ) : (
        existingRequests.map(request => (
          <div key={request.id} className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-medium text-gray-900">{request.title}</h4>
                <p className="text-sm text-gray-500 mt-1">{request.description}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                {request.status === 'approved' && '승인됨'}
                {request.status === 'rejected' && '거절됨'}
                {request.status === 'pending' && '대기중'}
                {request.status === 'in-review' && '검토중'}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(request.startDate).toLocaleDateString()}
                {request.endDate && ` - ${new Date(request.endDate).toLocaleDateString()}`}
              </span>
              <span className={`px-2 py-0.5 rounded ${getPriorityColor(request.priority)}`}>
                {request.priority === 'critical' && '긴급'}
                {request.priority === 'high' && '높음'}
                {request.priority === 'medium' && '보통'}
                {request.priority === 'low' && '낮음'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(request.createdAt).toLocaleDateString()} 제출
              </span>
            </div>

            {request.managerNotes && (
              <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
                <span className="font-medium">관리자 메모:</span> {request.managerNotes}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">특별 요청 제출</h2>
              <p className="text-sm text-gray-500 mt-1">
                일시적이거나 특별한 근무 조정이 필요한 경우 요청하세요
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('new')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'new'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              새 요청
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'history'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              요청 내역 {existingRequests.length > 0 && `(${existingRequests.length})`}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'new' ? renderNewRequest() : renderHistory()}
        </div>

        {/* Footer */}
        {activeTab === 'new' && (
          <div className="p-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                제출 후 관리자가 검토합니다
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !title || !description || !startDate}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      제출 중...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      요청 제출
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}