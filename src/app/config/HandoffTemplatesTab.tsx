"use client";
import { useState } from "react";
import { ClipboardList, Plus, Edit2, Trash2, Save, X, Check } from "lucide-react";
import { api as trpc } from "@/lib/trpc/client";

interface FieldConfig {
  enabled: boolean;
  required: boolean;
}

interface VitalSignsConfig extends FieldConfig {
  fields?: {
    bloodPressure?: { enabled: boolean };
    heartRate?: { enabled: boolean };
    temperature?: { enabled: boolean };
    respiratoryRate?: { enabled: boolean };
    oxygenSaturation?: { enabled: boolean };
    consciousness?: { enabled: boolean };
    painScore?: { enabled: boolean };
  };
}

interface TemplateConfig {
  fields: {
    sbar: {
      situation: FieldConfig;
      background: FieldConfig;
      assessment: FieldConfig;
      recommendation: FieldConfig;
    };
    vitalSigns: VitalSignsConfig;
    medications: FieldConfig;
    scheduledProcedures: FieldConfig;
    alerts: FieldConfig;
  };
}

const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  fields: {
    sbar: {
      situation: { enabled: true, required: true },
      background: { enabled: true, required: true },
      assessment: { enabled: true, required: true },
      recommendation: { enabled: true, required: true },
    },
    vitalSigns: {
      enabled: true,
      required: false,
      fields: {
        bloodPressure: { enabled: true },
        heartRate: { enabled: true },
        temperature: { enabled: true },
        respiratoryRate: { enabled: true },
        oxygenSaturation: { enabled: true },
        consciousness: { enabled: true },
        painScore: { enabled: true },
      },
    },
    medications: { enabled: true, required: false },
    scheduledProcedures: { enabled: true, required: false },
    alerts: { enabled: true, required: false },
  },
};

export function HandoffTemplatesTab() {
  const utils = trpc.useUtils();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    config: DEFAULT_TEMPLATE_CONFIG,
  });

  // Fetch templates
  const { data: templates = [], isLoading } = trpc.handoff.listTemplates.useQuery({});

  // Mutations
  const createMutation = trpc.handoff.createTemplate.useMutation({
    onSuccess: async () => {
      await utils.handoff.listTemplates.invalidate();
      setIsCreating(false);
      setNewTemplate({
        name: '',
        description: '',
        config: DEFAULT_TEMPLATE_CONFIG,
      });
    },
  });

  const updateMutation = trpc.handoff.updateTemplate.useMutation({
    onSuccess: async () => {
      await utils.handoff.listTemplates.invalidate();
      setEditingId(null);
    },
  });

  const deleteMutation = trpc.handoff.deleteTemplate.useMutation({
    onSuccess: async () => {
      await utils.handoff.listTemplates.invalidate();
    },
  });

  const handleCreate = () => {
    if (!newTemplate.name) {
      alert('템플릿 이름을 입력하세요.');
      return;
    }

    createMutation.mutate({
      name: newTemplate.name,
      description: newTemplate.description,
      config: newTemplate.config,
      isDefault: templates.length === 0, // First template is default
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`"${name}" 템플릿을 삭제하시겠습니까?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const FieldConfigRow = ({
    label,
    config,
    onToggleEnabled,
    onToggleRequired,
    disableRequiredToggle = false,
  }: {
    label: string;
    config: FieldConfig;
    onToggleEnabled: () => void;
    onToggleRequired: () => void;
    disableRequiredToggle?: boolean;
  }) => (
    <div className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={onToggleEnabled}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">활성화</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.required}
            onChange={onToggleRequired}
            disabled={!config.enabled || disableRequiredToggle}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">필수</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
        <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
            인수인계 템플릿 관리
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
            인수인계 작성 시 사용할 항목을 설정합니다. 활성화된 항목만 작성 화면에 표시되며, 필수로 설정된 항목은 반드시 입력해야 합니다.
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
            💡 SBAR (Situation, Background, Assessment, Recommendation)은 의료 인수인계의 표준 형식입니다.
          </p>
        </div>
      </div>

      {/* Create New Template Button */}
      {!isCreating && (
        <button
          onClick={() => setIsCreating(true)}
          className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          새 템플릿 만들기
        </button>
      )}

      {/* Create Template Form */}
      {isCreating && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-blue-500 dark:border-blue-400 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            새 템플릿 만들기
          </h3>

          {/* Template Name & Description */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                템플릿 이름 *
              </label>
              <input
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="예: 일반병동 표준 템플릿"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                설명
              </label>
              <textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder="템플릿 사용 목적이나 특징을 설명하세요"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          {/* SBAR Fields */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
              SBAR 항목 (필수)
            </h4>
            <div className="space-y-2">
              <FieldConfigRow
                label="Situation (상황)"
                config={newTemplate.config.fields.sbar.situation}
                onToggleEnabled={() => {}}
                onToggleRequired={() => {}}
                disableRequiredToggle={true}
              />
              <FieldConfigRow
                label="Background (배경)"
                config={newTemplate.config.fields.sbar.background}
                onToggleEnabled={() => {}}
                onToggleRequired={() => {}}
                disableRequiredToggle={true}
              />
              <FieldConfigRow
                label="Assessment (평가)"
                config={newTemplate.config.fields.sbar.assessment}
                onToggleEnabled={() => {}}
                onToggleRequired={() => {}}
                disableRequiredToggle={true}
              />
              <FieldConfigRow
                label="Recommendation (권고사항)"
                config={newTemplate.config.fields.sbar.recommendation}
                onToggleEnabled={() => {}}
                onToggleRequired={() => {}}
                disableRequiredToggle={true}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              * SBAR 항목은 의료 인수인계의 표준이므로 항상 필수로 활성화됩니다.
            </p>
          </div>

          {/* Additional Fields */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
              추가 정보 항목
            </h4>
            <div className="space-y-2">
              <FieldConfigRow
                label="활력징후 (Vital Signs)"
                config={newTemplate.config.fields.vitalSigns}
                onToggleEnabled={() => {
                  setNewTemplate({
                    ...newTemplate,
                    config: {
                      ...newTemplate.config,
                      fields: {
                        ...newTemplate.config.fields,
                        vitalSigns: {
                          ...newTemplate.config.fields.vitalSigns,
                          enabled: !newTemplate.config.fields.vitalSigns.enabled,
                        },
                      },
                    },
                  });
                }}
                onToggleRequired={() => {
                  setNewTemplate({
                    ...newTemplate,
                    config: {
                      ...newTemplate.config,
                      fields: {
                        ...newTemplate.config.fields,
                        vitalSigns: {
                          ...newTemplate.config.fields.vitalSigns,
                          required: !newTemplate.config.fields.vitalSigns.required,
                        },
                      },
                    },
                  });
                }}
              />
              <FieldConfigRow
                label="투약 정보 (Medications)"
                config={newTemplate.config.fields.medications}
                onToggleEnabled={() => {
                  setNewTemplate({
                    ...newTemplate,
                    config: {
                      ...newTemplate.config,
                      fields: {
                        ...newTemplate.config.fields,
                        medications: {
                          ...newTemplate.config.fields.medications,
                          enabled: !newTemplate.config.fields.medications.enabled,
                        },
                      },
                    },
                  });
                }}
                onToggleRequired={() => {
                  setNewTemplate({
                    ...newTemplate,
                    config: {
                      ...newTemplate.config,
                      fields: {
                        ...newTemplate.config.fields,
                        medications: {
                          ...newTemplate.config.fields.medications,
                          required: !newTemplate.config.fields.medications.required,
                        },
                      },
                    },
                  });
                }}
              />
              <FieldConfigRow
                label="예정 시술/검사 (Scheduled Procedures)"
                config={newTemplate.config.fields.scheduledProcedures}
                onToggleEnabled={() => {
                  setNewTemplate({
                    ...newTemplate,
                    config: {
                      ...newTemplate.config,
                      fields: {
                        ...newTemplate.config.fields,
                        scheduledProcedures: {
                          ...newTemplate.config.fields.scheduledProcedures,
                          enabled: !newTemplate.config.fields.scheduledProcedures.enabled,
                        },
                      },
                    },
                  });
                }}
                onToggleRequired={() => {
                  setNewTemplate({
                    ...newTemplate,
                    config: {
                      ...newTemplate.config,
                      fields: {
                        ...newTemplate.config.fields,
                        scheduledProcedures: {
                          ...newTemplate.config.fields.scheduledProcedures,
                          required: !newTemplate.config.fields.scheduledProcedures.required,
                        },
                      },
                    },
                  });
                }}
              />
              <FieldConfigRow
                label="특이사항/알림 (Alerts)"
                config={newTemplate.config.fields.alerts}
                onToggleEnabled={() => {
                  setNewTemplate({
                    ...newTemplate,
                    config: {
                      ...newTemplate.config,
                      fields: {
                        ...newTemplate.config.fields,
                        alerts: {
                          ...newTemplate.config.fields.alerts,
                          enabled: !newTemplate.config.fields.alerts.enabled,
                        },
                      },
                    },
                  });
                }}
                onToggleRequired={() => {
                  setNewTemplate({
                    ...newTemplate,
                    config: {
                      ...newTemplate.config,
                      fields: {
                        ...newTemplate.config.fields,
                        alerts: {
                          ...newTemplate.config.fields.alerts,
                          required: !newTemplate.config.fields.alerts.required,
                        },
                      },
                    },
                  });
                }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newTemplate.name}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending ? '저장 중...' : '템플릿 저장'}
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewTemplate({
                  name: '',
                  description: '',
                  config: DEFAULT_TEMPLATE_CONFIG,
                });
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Template List */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          등록된 템플릿
        </h3>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            로딩 중...
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p>등록된 템플릿이 없습니다.</p>
            <p className="text-sm mt-1">새 템플릿을 만들어보세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => {
              const config = template.config as TemplateConfig;
              const enabledFieldsCount = [
                config?.fields?.vitalSigns?.enabled,
                config?.fields?.medications?.enabled,
                config?.fields?.scheduledProcedures?.enabled,
                config?.fields?.alerts?.enabled,
              ].filter(Boolean).length;

              return (
                <div
                  key={template.id}
                  className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {template.name}
                      </h4>
                      {template.isDefault === 'true' && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                          기본
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        SBAR 필수 + {enabledFieldsCount}개 추가 항목
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(template.id, template.name)}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
