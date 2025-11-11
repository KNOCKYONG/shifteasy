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

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          환자 정보 ({patients.length}명)
        </h3>
        <button
          onClick={handleAddPatient}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          환자 추가
        </button>
      </div>

      {patients.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <p>환자를 추가하여 인수인계를 시작하세요</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {patients.map((patient, index) => (
            <div
              key={index}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                    환자 {index + 1}
                  </span>
                  {patient.patientIdentifier && (
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {patient.patientIdentifier} ({patient.roomNumber}
                      {patient.bedNumber && `-${patient.bedNumber}`})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemovePatient(index)}
                  className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {editingPatientIndex === index ? (
                <div className="space-y-3">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="환자 식별자 *"
                      value={patient.patientIdentifier}
                      onChange={(e) =>
                        handleUpdatePatient(index, { patientIdentifier: e.target.value })
                      }
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <input
                      type="text"
                      placeholder="병실 번호 *"
                      value={patient.roomNumber}
                      onChange={(e) =>
                        handleUpdatePatient(index, { roomNumber: e.target.value })
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
                        handleUpdatePatient(index, { situation: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <textarea
                      placeholder="Background (배경) *"
                      value={patient.background}
                      onChange={(e) =>
                        handleUpdatePatient(index, { background: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <textarea
                      placeholder="Assessment (평가) *"
                      value={patient.assessment}
                      onChange={(e) =>
                        handleUpdatePatient(index, { assessment: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <textarea
                      placeholder="Recommendation (권고사항) *"
                      value={patient.recommendation}
                      onChange={(e) =>
                        handleUpdatePatient(index, { recommendation: e.target.value })
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
                  onClick={() => setEditingPatientIndex(index)}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  정보 입력/수정
                </button>
              )}
            </div>
          ))}
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
