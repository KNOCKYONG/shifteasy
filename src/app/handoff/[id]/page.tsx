"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  ArrowLeft,
  Clock,
  User,
  AlertCircle,
  Heart,
  Activity,
  Pill,
  Calendar as CalendarIcon,
  MessageCircle,
  CheckCircle,
  Send,
  Plus,
  Loader2,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { api } from "@/lib/trpc/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Priority styles
const PRIORITY_STYLES = {
  critical: {
    bg: "bg-red-50",
    border: "border-l-4 border-red-500",
    badge: "bg-red-100 text-red-800",
    icon: "🔴",
    label: "긴급",
  },
  high: {
    bg: "bg-orange-50",
    border: "border-l-4 border-orange-500",
    badge: "bg-orange-100 text-orange-800",
    icon: "🟠",
    label: "높음",
  },
  medium: {
    bg: "bg-yellow-50",
    border: "border-l-4 border-yellow-500",
    badge: "bg-yellow-100 text-yellow-800",
    icon: "🟡",
    label: "보통",
  },
  low: {
    bg: "bg-green-50",
    border: "border-l-4 border-green-500",
    badge: "bg-green-100 text-green-800",
    icon: "🟢",
    label: "낮음",
  },
};

const STATUS_LABELS = {
  draft: "작성중",
  submitted: "제출됨",
  in_review: "검토중",
  completed: "완료",
};

const SHIFT_TYPE_LABELS = {
  D: "주간",
  E: "저녁",
  N: "야간",
};

export default function HandoffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const handoffId = params.id as string;
  const { userId } = useCurrentUser();

  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Fetch handoff details with patient items
  const { data: handoffData, isLoading, refetch } = api.handoff.get.useQuery({
    id: handoffId,
  });

  // Mutations
  const submitMutation = api.handoff.submit.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const completeMutation = api.handoff.complete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const addQuestionMutation = api.handoff.addQuestion.useMutation({
    onSuccess: () => {
      refetch();
      setQuestionText("");
      setSelectedItemId(null);
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    );
  }

  if (!handoffData) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">인수인계를 찾을 수 없습니다</p>
        </div>
      </MainLayout>
    );
  }

  const handoff = handoffData;
  const items = handoffData.items || [];
  const isHandover = handoff.handoverUserId === userId;
  const isReceiver = handoff.receiverUserId === userId;
  const canSubmit = isHandover && handoff.status === "draft";
  const canComplete = isReceiver && handoff.status === "submitted";

  // Sort items by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedItems = [...items].sort((a, b) => {
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder];
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder];
    return aPriority - bPriority;
  });

  const handleSubmit = () => {
    if (confirm("인수인계를 제출하시겠습니까?")) {
      submitMutation.mutate({ id: handoffId });
    }
  };

  const handleComplete = () => {
    if (confirm("인수인계를 완료하시겠습니까?")) {
      completeMutation.mutate({ id: handoffId });
    }
  };

  const handleAskQuestion = (itemId: string) => {
    if (questionText.trim()) {
      addQuestionMutation.mutate({
        itemId,
        question: questionText,
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/handoff")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">인수인계 상세</h1>
              <p className="text-sm text-gray-500">
                {format(new Date(handoff.shiftDate), "yyyy년 M월 d일 (E)", { locale: ko })} •{" "}
                {SHIFT_TYPE_LABELS[handoff.shiftType as keyof typeof SHIFT_TYPE_LABELS]} 근무
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canSubmit && (
              <button
                onClick={handleSubmit}
                disabled={items.length === 0 || submitMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitMutation.isPending ? "제출중..." : "인수자에게 제출"}
              </button>
            )}
            {canComplete && (
              <button
                onClick={handleComplete}
                disabled={completeMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {completeMutation.isPending ? "완료 처리중..." : "인수 완료"}
              </button>
            )}
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="grid grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">상태</p>
              <p className="text-lg font-semibold">
                {STATUS_LABELS[handoff.status as keyof typeof STATUS_LABELS]}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">총 환자 수</p>
              <p className="text-lg font-semibold">{items.length}명</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">시작 시간</p>
              <p className="text-lg font-semibold">
                {format(new Date(handoff.startedAt), "HH:mm")}
              </p>
            </div>
            {handoff.completedAt && (
              <div>
                <p className="text-sm text-gray-500 mb-1">소요 시간</p>
                <p className="text-lg font-semibold">{handoff.duration}분</p>
              </div>
            )}
          </div>
        </div>

        {/* Overall Notes */}
        {handoff.overallNotes && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 mb-2">전체 특이사항</p>
            <p className="text-sm text-blue-800">{handoff.overallNotes}</p>
          </div>
        )}

        {/* Patient List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">환자 목록</h2>

          {sortedItems.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">등록된 환자가 없습니다</p>
            </div>
          ) : (
            sortedItems.map((item: any) => {
              const priority = item.priority as keyof typeof PRIORITY_STYLES;
              const styles = PRIORITY_STYLES[priority];
              const isExpanded = expandedPatient === item.id;
              const vitalSigns = item.vitalSigns as any;
              const medications = (item.medications as any[]) || [];
              const scheduledProcedures = (item.scheduledProcedures as any[]) || [];
              const alerts = (item.alerts as any[]) || [];
              const questions = (item.questions as any[]) || [];

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-lg shadow border border-gray-200 overflow-hidden ${styles.bg}`}
                >
                  {/* Patient Header */}
                  <div
                    className={`${styles.border} p-4 cursor-pointer hover:bg-opacity-80 transition-all`}
                    onClick={() => setExpandedPatient(isExpanded ? null : item.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles.badge}`}>
                          {styles.icon} {styles.label}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {item.roomNumber}호 {item.bedNumber && `- ${item.bedNumber}번 침대`}
                          </p>
                          <p className="text-sm text-gray-600">환자: {item.patientIdentifier}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {isExpanded ? "접기" : "자세히 보기"}
                        </p>
                      </div>
                    </div>

                    {/* SBAR Preview */}
                    {!isExpanded && (
                      <div className="mt-3 text-sm text-gray-700">
                        <p className="line-clamp-2">
                          <span className="font-medium">상황:</span> {item.situation}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="p-6 bg-white space-y-6">
                      {/* SBAR Details */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            📋 S (Situation) - 상황
                          </h4>
                          <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded">{item.situation}</p>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            📝 B (Background) - 배경
                          </h4>
                          <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded">{item.background}</p>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            🔍 A (Assessment) - 평가
                          </h4>
                          <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded">{item.assessment}</p>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            💡 R (Recommendation) - 권고사항
                          </h4>
                          <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded">
                            {item.recommendation}
                          </p>
                        </div>
                      </div>

                      {/* Vital Signs */}
                      {vitalSigns && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            활력징후
                          </h4>
                          <div className="grid grid-cols-3 gap-3">
                            {vitalSigns.bloodPressure && (
                              <div className="bg-gray-50 p-3 rounded">
                                <p className="text-xs text-gray-500">혈압</p>
                                <p className="text-sm font-medium">{vitalSigns.bloodPressure}</p>
                              </div>
                            )}
                            {vitalSigns.heartRate && (
                              <div className="bg-gray-50 p-3 rounded">
                                <p className="text-xs text-gray-500">맥박</p>
                                <p className="text-sm font-medium">{vitalSigns.heartRate} bpm</p>
                              </div>
                            )}
                            {vitalSigns.temperature && (
                              <div className="bg-gray-50 p-3 rounded">
                                <p className="text-xs text-gray-500">체온</p>
                                <p className="text-sm font-medium">{vitalSigns.temperature}°C</p>
                              </div>
                            )}
                            {vitalSigns.oxygenSaturation && (
                              <div className="bg-gray-50 p-3 rounded">
                                <p className="text-xs text-gray-500">산소포화도</p>
                                <p className="text-sm font-medium">{vitalSigns.oxygenSaturation}%</p>
                              </div>
                            )}
                            {vitalSigns.painScore !== undefined && (
                              <div className="bg-gray-50 p-3 rounded">
                                <p className="text-xs text-gray-500">통증점수</p>
                                <p className="text-sm font-medium">{vitalSigns.painScore}/10</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Medications */}
                      {medications.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Pill className="w-4 h-4" />
                            투약 일정
                          </h4>
                          <div className="space-y-2">
                            {medications.map((med, idx) => (
                              <div key={idx} className="bg-gray-50 p-3 rounded flex justify-between">
                                <div>
                                  <p className="text-sm font-medium">{med.name}</p>
                                  {med.dose && <p className="text-xs text-gray-600">용량: {med.dose}</p>}
                                  <p className="text-xs text-gray-600">경로: {med.route}</p>
                                </div>
                                <p className="text-sm text-gray-600">{med.time}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Scheduled Procedures */}
                      {scheduledProcedures.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4" />
                            예정 처치
                          </h4>
                          <div className="space-y-2">
                            {scheduledProcedures.map((proc, idx) => (
                              <div key={idx} className="bg-gray-50 p-3 rounded">
                                <div className="flex justify-between items-start">
                                  <p className="text-sm font-medium">{proc.procedure}</p>
                                  <p className="text-xs text-gray-600">{proc.scheduledTime}</p>
                                </div>
                                {proc.preparation && (
                                  <p className="text-xs text-gray-600 mt-1">준비: {proc.preparation}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alerts */}
                      {alerts.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            주의사항
                          </h4>
                          <div className="space-y-2">
                            {alerts.map((alert, idx) => (
                              <div key={idx} className="bg-red-50 border border-red-200 p-3 rounded">
                                <p className="text-sm font-medium text-red-900">{alert.type}</p>
                                <p className="text-sm text-red-800">{alert.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Questions */}
                      {questions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" />
                            질문 및 답변
                          </h4>
                          <div className="space-y-3">
                            {questions.map((q: any, idx: number) => (
                              <div key={idx} className="bg-gray-50 p-3 rounded space-y-2">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">Q: {q.question}</p>
                                  <p className="text-xs text-gray-500">
                                    {format(new Date(q.askedAt), "yyyy-MM-dd HH:mm")}
                                  </p>
                                </div>
                                {q.answer && (
                                  <div className="pl-4 border-l-2 border-blue-300">
                                    <p className="text-sm text-gray-800">A: {q.answer}</p>
                                    <p className="text-xs text-gray-500">
                                      {format(new Date(q.answeredAt), "yyyy-MM-dd HH:mm")}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add Question */}
                      {isReceiver && handoff.status !== "completed" && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">질문하기</h4>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={selectedItemId === item.id ? questionText : ""}
                              onChange={(e) => {
                                setSelectedItemId(item.id);
                                setQuestionText(e.target.value);
                              }}
                              placeholder="궁금한 사항을 입력하세요..."
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => handleAskQuestion(item.id)}
                              disabled={
                                !questionText.trim() ||
                                selectedItemId !== item.id ||
                                addQuestionMutation.isPending
                              }
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </MainLayout>
  );
}
