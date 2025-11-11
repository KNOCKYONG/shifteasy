'use client';

import { useState } from 'react';
import { Calendar, Clock, User, Users, ChevronDown, ChevronUp, AlertCircle, Award } from 'lucide-react';
import { format } from 'date-fns';

interface OpenRequestApplicant {
  employeeId: string;
  employeeName: string;
  experienceYears: number;
  seniorityLevel: 'junior' | 'intermediate' | 'senior' | 'expert';
  shift: {
    date: string;
    type: string;
    time: string;
  };
  appliedAt: Date;
  message?: string;
}

interface OpenRequestCardProps {
  request: {
    id: string;
    requesterName: string;
    requesterExperience: number;
    requesterSeniority: 'junior' | 'intermediate' | 'senior' | 'expert';
    requesterShift: {
      date: string;
      type: string;
      time: string;
    };
    reason: string;
    createdAt: Date;
    openApplications: OpenRequestApplicant[];
    status: string;
  };
  currentUser?: {
    id: string;
    name: string;
    experienceYears: number;
    seniorityLevel: 'junior' | 'intermediate' | 'senior' | 'expert';
  };
  onApply?: (requestId: string, message: string) => void;
  onSelectApplicant?: (requestId: string, applicantId: string) => void;
  isOwner?: boolean;
}

export function OpenRequestCard({
  request,
  currentUser,
  onApply,
  onSelectApplicant,
  isOwner = false
}: OpenRequestCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const getSeniorityBadgeColor = (level: string) => {
    switch (level) {
      case 'junior': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-blue-100 text-blue-800';
      case 'senior': return 'bg-purple-100 text-purple-800';
      case 'expert': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeniorityLabel = (level: string) => {
    switch (level) {
      case 'junior': return '신입';
      case 'intermediate': return '중급';
      case 'senior': return '선임';
      case 'expert': return '전문가';
      default: return level;
    }
  };

  // 공정성 점수 계산 (연차 차이 기반)
  const calculateFairnessScore = (applicant: OpenRequestApplicant): number => {
    const experienceDiff = Math.abs(request.requesterExperience - applicant.experienceYears);

    // 연차 차이가 적을수록 높은 점수
    if (experienceDiff <= 1) return 100;
    if (experienceDiff <= 2) return 90;
    if (experienceDiff <= 3) return 80;
    if (experienceDiff <= 5) return 70;
    if (experienceDiff <= 7) return 60;
    return 50;
  };

  const getFairnessLabel = (score: number) => {
    if (score >= 90) return { text: '매우 공정', color: 'text-green-600' };
    if (score >= 70) return { text: '공정', color: 'text-blue-600' };
    if (score >= 50) return { text: '검토 필요', color: 'text-yellow-600' };
    return { text: '주의 필요', color: 'text-red-600' };
  };

  const hasApplied = currentUser && request.openApplications.some(
    app => app.employeeId === currentUser.id
  );

  const canApply = currentUser && !hasApplied && !isOwner && request.status === 'requested';

  const handleApply = () => {
    if (!onApply || !applicationMessage.trim()) return;

    onApply(request.id, applicationMessage);
    setApplicationMessage('');
    setShowApplicationForm(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        {/* 헤더 */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium">{request.requesterName}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">경력 {request.requesterExperience}년</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeniorityBadgeColor(request.requesterSeniority)}`}>
                  {getSeniorityLabel(request.requesterSeniority)}
                </span>
              </div>
            </div>
          </div>
          <span className="text-xs text-gray-500">
            {format(new Date(request.createdAt), "M'월' d'일' HH:mm")}
          </span>
        </div>

        {/* 근무 정보 */}
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span>{new Date(request.requesterShift.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-gray-500" />
              <span>{request.requesterShift.type} ({request.requesterShift.time})</span>
            </div>
          </div>
        </div>

        {/* 사유 */}
        <p className="text-sm text-gray-600 mb-3">{request.reason}</p>

        {/* 지원 현황 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              {request.openApplications.length}명 지원
            </span>
            {hasApplied && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                지원 완료
              </span>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            {isExpanded ? '접기' : '상세보기'}
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 확장 영역 */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4">
          {/* 지원자 목록 */}
          {request.openApplications.length > 0 ? (
            <div className="space-y-3 mb-4">
              <h4 className="text-sm font-medium text-gray-700">지원자 목록</h4>
              {request.openApplications.map((applicant) => {
                const fairnessScore = calculateFairnessScore(applicant);
                const fairnessLabel = getFairnessLabel(fairnessScore);

                return (
                  <div key={applicant.employeeId} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{applicant.employeeName}</span>
                          <span className="text-xs text-gray-500">경력 {applicant.experienceYears}년</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeniorityBadgeColor(applicant.seniorityLevel)}`}>
                            {getSeniorityLabel(applicant.seniorityLevel)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                          <span>제안: {format(new Date(applicant.shift.date), 'M/d')} {applicant.shift.type}</span>
                          <span>지원일: {format(new Date(applicant.appliedAt), 'M/d HH:mm')}</span>
                        </div>
                        {applicant.message && (
                          <p className="text-sm text-gray-600 italic">&quot;{applicant.message}&quot;</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Award className={`w-4 h-4 ${fairnessLabel.color}`} />
                          <span className={`text-xs font-medium ${fairnessLabel.color}`}>
                            공정성: {fairnessLabel.text} ({fairnessScore}점)
                          </span>
                        </div>
                      </div>
                      {isOwner && onSelectApplicant && request.status === 'requested' && (
                        <button
                          onClick={() => onSelectApplicant(request.id, applicant.employeeId)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          선택
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-4">아직 지원자가 없습니다.</p>
          )}

          {/* 지원 폼 */}
          {canApply && !showApplicationForm && (
            <button
              onClick={() => setShowApplicationForm(true)}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Award className="w-4 h-4" />
              지원하기
            </button>
          )}

          {canApply && showApplicationForm && (
            <div className="space-y-3">
              {currentUser && calculateFairnessScore({
                employeeId: currentUser.id,
                employeeName: currentUser.name,
                experienceYears: currentUser.experienceYears,
                seniorityLevel: currentUser.seniorityLevel,
                shift: { date: '', type: '', time: '' },
                appliedAt: new Date()
              }) < 70 && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="flex gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">공정성 주의</p>
                      <p>연차 차이가 커서 공정성 점수가 낮습니다. 관리자 검토가 필요할 수 있습니다.</p>
                    </div>
                  </div>
                </div>
              )}

              <textarea
                value={applicationMessage}
                onChange={(e) => setApplicationMessage(e.target.value)}
                placeholder="지원 메시지를 입력하세요 (선택사항)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowApplicationForm(false);
                    setApplicationMessage('');
                  }}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  지원 확인
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}