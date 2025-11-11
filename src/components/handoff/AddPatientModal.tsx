"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, AlertCircle } from "lucide-react";

interface VitalSigns {
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  consciousness?: string;
  painScore?: number;
}

interface Medication {
  name: string;
  dose?: string;
  time: string;
  route: string;
  note?: string;
}

interface ScheduledProcedure {
  procedure: string;
  scheduledTime: string;
  preparation?: string;
  note?: string;
}

interface Alert {
  type: "allergy" | "fall_risk" | "infection" | "isolation" | "dnr" | "other";
  description: string;
  severity?: "high" | "medium" | "low";
}

interface AddPatientModalProps {
  handoffId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PRIORITY_OPTIONS = [
  { value: "critical" as const, label: "긴급 (Critical)", color: "red", icon: "🔴" },
  { value: "high" as const, label: "높음 (High)", color: "orange", icon: "🟠" },
  { value: "medium" as const, label: "보통 (Medium)", color: "yellow", icon: "🟡" },
  { value: "low" as const, label: "낮음 (Low)", color: "green", icon: "🟢" },
];

export function AddPatientModal({ handoffId, onClose, onSuccess }: AddPatientModalProps) {
  // Basic info
  const [patientIdentifier, setPatientIdentifier] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [bedNumber, setBedNumber] = useState("");
  const [priority, setPriority] = useState<"critical" | "high" | "medium" | "low">("medium");

  // SBAR
  const [situation, setSituation] = useState("");
  const [background, setBackground] = useState("");
  const [assessment, setAssessment] = useState("");
  const [recommendation, setRecommendation] = useState("");

  // Vital signs
  const [showVitalSigns, setShowVitalSigns] = useState(false);
  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({});

  // Medications
  const [medications, setMedications] = useState<Medication[]>([]);
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const [showMedicationForm, setShowMedicationForm] = useState(false);

  // Procedures
  const [procedures] = useState<ScheduledProcedure[]>([]);

  // Alerts
  const [alerts, setAlerts] = useState<Alert[]>([]);
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const [showAlertForm, setShowAlertForm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!patientIdentifier || !roomNumber || !situation || !background || !assessment || !recommendation) {
      setError("필수 항목을 모두 입력해주세요");
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Call API to add patient item
      // await api.handoff.addItem.mutate({ ... });
      console.log("Adding patient item:", {
        handoffId,
        patientIdentifier,
        roomNumber,
        bedNumber,
        priority,
        situation,
        background,
        assessment,
        recommendation,
        vitalSigns: showVitalSigns ? vitalSigns : undefined,
        medications: medications.length > 0 ? medications : undefined,
        scheduledProcedures: procedures.length > 0 ? procedures : undefined,
        alerts: alerts.length > 0 ? alerts : undefined,
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError("환자 추가 중 오류가 발생했습니다");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">환자 추가</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">기본 정보</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  병실 번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 301"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">침상 번호</label>
                <input
                  type="text"
                  value={bedNumber}
                  onChange={(e) => setBedNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  환자 식별자 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={patientIdentifier}
                  onChange={(e) => setPatientIdentifier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 김**"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                우선순위 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-3">
                {PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPriority(option.value)}
                    className={`p-3 border-2 rounded-lg transition-all ${
                      priority === option.value
                        ? `border-${option.color}-500 bg-${option.color}-50`
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-2xl mb-1 block">{option.icon}</span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SBAR */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">SBAR 인수인계</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📋 S (Situation) - 현재 상황 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="환자의 현재 상황을 간략히 설명하세요"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📝 B (Background) - 배경 정보 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="진단명, 입원일, 수술/시술 이력 등"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🔍 A (Assessment) - 평가 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="활력징후, 의식수준, 통증 등 현재 평가"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💡 R (Recommendation) - 권고사항 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="인수자가 해야 할 일, 주의사항 등"
                required
              />
            </div>
          </div>

          {/* Optional: Vital Signs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">활력징후 (선택)</h3>
              <button
                type="button"
                onClick={() => setShowVitalSigns(!showVitalSigns)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {showVitalSigns ? "숨기기" : "추가하기"}
              </button>
            </div>

            {showVitalSigns && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">혈압</label>
                  <input
                    type="text"
                    value={vitalSigns.bloodPressure || ""}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, bloodPressure: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="120/80"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">맥박 (bpm)</label>
                  <input
                    type="number"
                    value={vitalSigns.heartRate || ""}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, heartRate: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="72"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">체온 (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={vitalSigns.temperature || ""}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, temperature: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="36.5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">호흡수 (회/분)</label>
                  <input
                    type="number"
                    value={vitalSigns.respiratoryRate || ""}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, respiratoryRate: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="16"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">산소포화도 (%)</label>
                  <input
                    type="number"
                    value={vitalSigns.oxygenSaturation || ""}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, oxygenSaturation: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="98"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">통증점수 (0-10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={vitalSigns.painScore || ""}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, painScore: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Medications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                투약 일정 ({medications.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowMedicationForm(true)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>

            {medications.map((med, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{med.name}</p>
                  <p className="text-xs text-gray-600">
                    {med.dose} • {med.route} • {med.time}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMedications(medications.filter((_, i) => i !== idx))}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Trash2 className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            ))}
          </div>

          {/* Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">주의사항 ({alerts.length})</h3>
              <button
                type="button"
                onClick={() => setShowAlertForm(true)}
                className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>

            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">{alert.type}</p>
                  <p className="text-xs text-red-800">{alert.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAlerts(alerts.filter((_, i) => i !== idx))}
                  className="p-1 hover:bg-red-100 rounded"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "추가 중..." : "환자 추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
