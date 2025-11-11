"use client";
import { useState, useEffect } from "react";
import { X, Calendar, Users, Clock, ChevronRight, ChevronLeft, Plus, Trash2, AlertCircle } from "lucide-react";
import { api } from "@/lib/trpc/client";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useRouter } from "next/navigation";

interface CreateHandoffDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PatientItem {
  patientIdentifier: string;
  roomNumber: string;
  bedNumber?: string;
  priority: "critical" | "high" | "medium" | "low";
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    consciousness?: string;
    painScore?: number;
  };
  medications?: Array<{
    name: string;
    dose?: string;
    time: string;
    route: string;
    note?: string;
  }>;
  scheduledProcedures?: Array<{
    procedure: string;
    scheduledTime: string;
    preparation?: string;
    note?: string;
  }>;
  alerts?: Array<{
    type: "allergy" | "fall_risk" | "infection" | "isolation" | "dnr" | "other";
    description: string;
    severity?: "high" | "medium" | "low";
  }>;
}

interface TemplateConfig {
  fields: {
    sbar: {
      situation: { enabled: boolean; required: boolean };
      background: { enabled: boolean; required: boolean };
      assessment: { enabled: boolean; required: boolean };
      recommendation: { enabled: boolean; required: boolean };
    };
    vitalSigns: { enabled: boolean; required: boolean };
    medications: { enabled: boolean; required: boolean };
    scheduledProcedures: { enabled: boolean; required: boolean };
    alerts: { enabled: boolean; required: boolean };
  };
}

export function CreateHandoffDialog({ isOpen, onClose }: CreateHandoffDialogProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [step, setStep] = useState(1); // 1: Basic Info, 2: Patient Info

  // Step 1: Basic Information
  const [shiftDate, setShiftDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [shiftType, setShiftType] = useState<"D" | "E" | "N">("D");
  const [receiverUserId, setReceiverUserId] = useState("");
  const [overallNotes, setOverallNotes] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Step 2: Patient Information
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [editingPatientIndex, setEditingPatientIndex] = useState<number | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
  const [sortBy, setSortBy] = useState<"priority" | "room" | "order">("priority");

  // Fetch templates
  const { data: templates = [] } = api.handoff.listTemplates.useQuery({});

  // Fetch users for receiver selection (placeholder - should be actual users from department)
  const { data: staffData } = api.staff.list.useQuery({});
  const users = staffData?.items || [];

  // Mutations
  const createHandoffMutation = api.handoff.create.useMutation({
    onSuccess: async (handoff) => {
      // Add all patient items
      for (const patient of patients) {
        await addItemMutation.mutateAsync({
          handoffId: handoff.id,
          ...patient,
        });
      }

      await utils.handoff.list.invalidate();
      onClose();
      router.push(`/handoff/${handoff.id}`);
    },
  });

  const addItemMutation = api.handoff.addItem.useMutation();

  // Get selected template config
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const templateConfig = (selectedTemplate?.config as TemplateConfig) || null;

  // Set default template when templates load
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      const defaultTemplate = templates.find((t) => t.isDefault === "true");
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      } else {
        setSelectedTemplateId(templates[0].id);
      }
    }
  }, [templates, selectedTemplateId]);

  const handleAddPatient = () => {
    const newPatient: PatientItem = {
      patientIdentifier: "",
      roomNumber: "",
      bedNumber: "",
      priority: "medium",
      situation: "",
      background: "",
      assessment: "",
      recommendation: "",
    };

    if (templateConfig?.fields.vitalSigns.enabled) {
      newPatient.vitalSigns = {};
    }
    if (templateConfig?.fields.medications.enabled) {
      newPatient.medications = [];
    }
    if (templateConfig?.fields.scheduledProcedures.enabled) {
      newPatient.scheduledProcedures = [];
    }
    if (templateConfig?.fields.alerts.enabled) {
      newPatient.alerts = [];
    }

    setPatients([...patients, newPatient]);
    setEditingPatientIndex(patients.length);
  };

  const handleRemovePatient = (index: number) => {
    setPatients(patients.filter((_, i) => i !== index));
    if (editingPatientIndex === index) {
      setEditingPatientIndex(null);
    }
  };

  const handleUpdatePatient = (index: number, updates: Partial<PatientItem>) => {
    const updated = [...patients];
    updated[index] = { ...updated[index], ...updates };
    setPatients(updated);
  };

  const handleSubmit = async () => {
    // Validation
    if (patients.length === 0) {
      alert("최소 1명의 환자 정보를 입력해주세요.");
      return;
    }

    // Validate required fields based on template
    for (const patient of patients) {
      if (!patient.patientIdentifier || !patient.roomNumber) {
        alert("환자 식별자와 병실 번호는 필수입니다.");
        return;
      }

      if (templateConfig?.fields.sbar.situation.required && !patient.situation) {
        alert("Situation (상황)은 필수 항목입니다.");
        return;
      }
      if (templateConfig?.fields.sbar.background.required && !patient.background) {
        alert("Background (배경)는 필수 항목입니다.");
        return;
      }
      if (templateConfig?.fields.sbar.assessment.required && !patient.assessment) {
        alert("Assessment (평가)는 필수 항목입니다.");
        return;
      }
      if (templateConfig?.fields.sbar.recommendation.required && !patient.recommendation) {
        alert("Recommendation (권고사항)은 필수 항목입니다.");
        return;
      }
    }

    // Get user's department (placeholder - should come from auth context)
    const userDepartmentId = users[0]?.departmentId || "default-dept-id";

    await createHandoffMutation.mutateAsync({
      departmentId: userDepartmentId,
      shiftDate: new Date(shiftDate),
      shiftType,
      receiverUserId: receiverUserId || undefined,
      overallNotes,
    });
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        기본 정보
      </h3>

      {/* Template Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          템플릿 선택
        </label>
        <select
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
              {template.isDefault === "true" && " (기본)"}
            </option>
          ))}
        </select>
        {selectedTemplate?.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {selectedTemplate.description}
          </p>
        )}
      </div>

      {/* Shift Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          <Calendar className="w-4 h-4 inline mr-1" />
          근무 날짜 *
        </label>
        <input
          type="date"
          value={shiftDate}
          onChange={(e) => setShiftDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
        />
      </div>

      {/* Shift Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          <Clock className="w-4 h-4 inline mr-1" />
          근무 타입 *
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(["D", "E", "N"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setShiftType(type)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                shiftType === type
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {type === "D" ? "주간" : type === "E" ? "저녁" : "야간"}
            </button>
          ))}
        </div>
      </div>

      {/* Receiver */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          <Users className="w-4 h-4 inline mr-1" />
          인수자 (선택)
        </label>
        <select
          value={receiverUserId}
          onChange={(e) => setReceiverUserId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
        >
          <option value="">나중에 지정</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.employeeId})
            </option>
          ))}
        </select>
      </div>

      {/* Overall Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          전체 특이사항 (선택)
        </label>
        <textarea
          value={overallNotes}
          onChange={(e) => setOverallNotes(e.target.value)}
          placeholder="전체 근무 중 특이사항이 있다면 기재하세요"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
        />
      </div>
    </div>
  );

  // Priority labels and colors
  const PRIORITY_LABELS = {
    critical: "긴급",
    high: "높음",
    medium: "보통",
    low: "낮음",
  };

  const PRIORITY_COLORS = {
    critical: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700",
    high: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700",
    medium: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
    low: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700",
  };

  const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

  // Filter and sort patients
  const getFilteredAndSortedPatients = () => {
    let filtered = patients;

    // Apply priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter((p) => p.priority === priorityFilter);
    }

    // Apply sorting
    const sorted = [...filtered];
    if (sortBy === "priority") {
      sorted.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    } else if (sortBy === "room") {
      sorted.sort((a, b) => {
        if (!a.roomNumber || !b.roomNumber) return 0;
        return a.roomNumber.localeCompare(b.roomNumber);
      });
    }
    // "order" keeps original order

    return sorted;
  };

  const filteredPatients = getFilteredAndSortedPatients();

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          환자 정보 ({filteredPatients.length}/{patients.length}명)
        </h3>
        <button
          onClick={handleAddPatient}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          환자 추가
        </button>
      </div>

      {/* Filter and Sort Controls */}
      {patients.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* Priority Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">우선순위:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPriorityFilter("all")}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  priorityFilter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
                }`}
              >
                전체
              </button>
              {(["critical", "high", "medium", "low"] as const).map((priority) => (
                <button
                  key={priority}
                  onClick={() => setPriorityFilter(priority)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors border ${
                    priorityFilter === priority
                      ? PRIORITY_COLORS[priority]
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {PRIORITY_LABELS[priority]}
                </button>
              ))}
            </div>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">정렬:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "priority" | "room" | "order")}
              className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500"
            >
              <option value="priority">우선순위순</option>
              <option value="room">병실번호순</option>
              <option value="order">추가순</option>
            </select>
          </div>
        </div>
      )}

      {patients.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <p>환자를 추가하여 인수인계를 시작하세요</p>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <p>해당 우선순위의 환자가 없습니다</p>
          <button
            onClick={() => setPriorityFilter("all")}
            className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            전체 보기
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredPatients.map((patient) => {
            const originalIndex = patients.indexOf(patient);
            return (
            <div
              key={originalIndex}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                    환자 {originalIndex + 1}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded border ${PRIORITY_COLORS[patient.priority]}`}>
                    {PRIORITY_LABELS[patient.priority]}
                  </span>
                  {patient.patientIdentifier && (
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {patient.patientIdentifier} ({patient.roomNumber}
                      {patient.bedNumber && `-${patient.bedNumber}`})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemovePatient(originalIndex)}
                  className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {editingPatientIndex === originalIndex ? (
                <div className="space-y-3">
                  {/* Priority Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      우선순위 *
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(["critical", "high", "medium", "low"] as const).map((priority) => (
                        <button
                          key={priority}
                          type="button"
                          onClick={() => handleUpdatePatient(originalIndex, { priority })}
                          className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                            patient.priority === priority
                              ? PRIORITY_COLORS[priority]
                              : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {PRIORITY_LABELS[priority]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="환자 식별자 *"
                      value={patient.patientIdentifier}
                      onChange={(e) =>
                        handleUpdatePatient(originalIndex, { patientIdentifier: e.target.value })
                      }
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <input
                      type="text"
                      placeholder="병실 번호 *"
                      value={patient.roomNumber}
                      onChange={(e) =>
                        handleUpdatePatient(originalIndex, { roomNumber: e.target.value })
                      }
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  {/* SBAR */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      SBAR
                    </h4>
                    <textarea
                      placeholder="Situation (상황) *"
                      value={patient.situation}
                      onChange={(e) =>
                        handleUpdatePatient(originalIndex, { situation: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <textarea
                      placeholder="Background (배경) *"
                      value={patient.background}
                      onChange={(e) =>
                        handleUpdatePatient(originalIndex, { background: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <textarea
                      placeholder="Assessment (평가) *"
                      value={patient.assessment}
                      onChange={(e) =>
                        handleUpdatePatient(originalIndex, { assessment: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <textarea
                      placeholder="Recommendation (권고사항) *"
                      value={patient.recommendation}
                      onChange={(e) =>
                        handleUpdatePatient(originalIndex, { recommendation: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <button
                    onClick={() => setEditingPatientIndex(null)}
                    className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                  >
                    완료
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingPatientIndex(originalIndex)}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  정보 입력/수정
                </button>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              새 인수인계 시작
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              단계 {step}/2: {step === 1 ? "기본 정보" : "환자 정보"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? renderStep1() : renderStep2()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => (step === 1 ? onClose() : setStep(1))}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {step === 1 ? (
              <>취소</>
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                이전
              </>
            )}
          </button>

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              다음
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createHandoffMutation.isPending || patients.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createHandoffMutation.isPending ? "생성 중..." : "인수인계 생성"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
