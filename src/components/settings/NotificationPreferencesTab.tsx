"use client";

import { useState, useEffect } from "react";
import { Bell, Clock, CheckCircle2, AlertCircle, Loader2, Save } from "lucide-react";
import { api } from "@/lib/trpc/client";

export function NotificationPreferencesTab() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Fetch current preferences
  const { data: preferences, isLoading, refetch } = api.preferences.getNotificationPreferences.useQuery();

  // Update mutation
  const updateMutation = api.preferences.updateNotificationPreferences.useMutation({
    onSuccess: () => {
      setMessage({ type: 'success', text: '알림 설정이 저장되었습니다.' });
      refetch();
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error) => {
      setMessage({ type: 'error', text: `저장 실패: ${error.message}` });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  // Local state for editing
  const [enabled, setEnabled] = useState(true);
  const [channels, setChannels] = useState({
    sse: true,
    push: false,
    email: false,
  });
  const [types, setTypes] = useState({
    handoff_submitted: true,
    handoff_completed: true,
    handoff_critical_patient: true,
    handoff_reminder: true,
    schedule_published: true,
    schedule_updated: true,
    swap_requested: true,
    swap_approved: true,
    swap_rejected: true,
  });
  const [quietHours, setQuietHours] = useState({
    enabled: false,
    start: '22:00',
    end: '08:00',
  });

  // Update local state when preferences load
  useEffect(() => {
    if (preferences) {
      setEnabled(preferences.enabled ?? true);
      setChannels({
        sse: preferences.channels?.sse ?? true,
        push: preferences.channels?.push ?? false,
        email: preferences.channels?.email ?? false,
      });
      setTypes({
        handoff_submitted: preferences.types?.handoff_submitted ?? true,
        handoff_completed: preferences.types?.handoff_completed ?? true,
        handoff_critical_patient: preferences.types?.handoff_critical_patient ?? true,
        handoff_reminder: preferences.types?.handoff_reminder ?? true,
        schedule_published: preferences.types?.schedule_published ?? true,
        schedule_updated: preferences.types?.schedule_updated ?? true,
        swap_requested: preferences.types?.swap_requested ?? true,
        swap_approved: preferences.types?.swap_approved ?? true,
        swap_rejected: preferences.types?.swap_rejected ?? true,
      });
      setQuietHours({
        enabled: preferences.quietHours?.enabled ?? false,
        start: preferences.quietHours?.start ?? '22:00',
        end: preferences.quietHours?.end ?? '08:00',
      });
    }
  }, [preferences]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await updateMutation.mutateAsync({
        enabled,
        channels,
        types,
        quietHours,
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <Bell className="w-5 h-5" />
        알림 설정
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        받고 싶은 알림 종류와 알림 방식을 선택하세요.
      </p>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Master toggle */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-300">전체 알림 설정</p>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                모든 알림을 일괄적으로 켜거나 끌 수 있습니다
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
            </label>
          </div>
        </div>

        {/* Notification channels */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">알림 채널</h4>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">실시간 알림 (SSE)</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                브라우저에서 즉시 알림을 받습니다
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={channels.sse}
                onChange={(e) => setChannels({ ...channels, sse: e.target.checked })}
                disabled={!enabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg opacity-60">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                푸시 알림
                <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">곧 제공</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                모바일 기기에서 푸시 알림을 받습니다
              </p>
            </div>
            <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg opacity-60">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                이메일 알림
                <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">곧 제공</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                중요 알림을 이메일로 받습니다
              </p>
            </div>
            <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          </div>
        </div>

        {/* Notification types */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">알림 종류</h4>

          {/* Handoff notifications */}
          <div className="space-y-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h5 className="text-xs font-semibold text-green-800 dark:text-green-300 mb-2">인수인계 알림</h5>

            <NotificationTypeToggle
              label="인수인계 제출"
              description="새로운 인수인계가 도착했을 때"
              checked={types.handoff_submitted}
              onChange={(checked) => setTypes({ ...types, handoff_submitted: checked })}
              disabled={!enabled}
            />
            <NotificationTypeToggle
              label="인수인계 완료"
              description="인수인계가 완료되었을 때"
              checked={types.handoff_completed}
              onChange={(checked) => setTypes({ ...types, handoff_completed: checked })}
              disabled={!enabled}
            />
            <NotificationTypeToggle
              label="긴급 환자 추가"
              description="긴급 환자가 추가되었을 때 (우선순위: 긴급)"
              checked={types.handoff_critical_patient}
              onChange={(checked) => setTypes({ ...types, handoff_critical_patient: checked })}
              disabled={!enabled}
              urgent
            />
            <NotificationTypeToggle
              label="인수인계 리마인더"
              description="교대 시간 30분 전 알림 (곧 제공)"
              checked={types.handoff_reminder}
              onChange={(checked) => setTypes({ ...types, handoff_reminder: checked })}
              disabled={!enabled}
              comingSoon
            />
          </div>

          {/* Schedule notifications */}
          <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <h5 className="text-xs font-semibold text-purple-800 dark:text-purple-300 mb-2">스케줄 알림</h5>

            <NotificationTypeToggle
              label="스케줄 발행"
              description="새로운 스케줄이 발행되었을 때"
              checked={types.schedule_published}
              onChange={(checked) => setTypes({ ...types, schedule_published: checked })}
              disabled={!enabled}
            />
            <NotificationTypeToggle
              label="스케줄 변경"
              description="기존 스케줄이 수정되었을 때"
              checked={types.schedule_updated}
              onChange={(checked) => setTypes({ ...types, schedule_updated: checked })}
              disabled={!enabled}
            />
          </div>

          {/* Swap notifications */}
          <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h5 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">근무 교환 알림</h5>

            <NotificationTypeToggle
              label="교환 요청"
              description="근무 교환 요청이 접수되었을 때"
              checked={types.swap_requested}
              onChange={(checked) => setTypes({ ...types, swap_requested: checked })}
              disabled={!enabled}
            />
            <NotificationTypeToggle
              label="교환 승인"
              description="교환 요청이 승인되었을 때"
              checked={types.swap_approved}
              onChange={(checked) => setTypes({ ...types, swap_approved: checked })}
              disabled={!enabled}
            />
            <NotificationTypeToggle
              label="교환 거절"
              description="교환 요청이 거절되었을 때"
              checked={types.swap_rejected}
              onChange={(checked) => setTypes({ ...types, swap_rejected: checked })}
              disabled={!enabled}
            />
          </div>
        </div>

        {/* Quiet hours */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                방해 금지 시간
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                지정한 시간대에는 알림을 받지 않습니다 (긴급 알림 제외)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={quietHours.enabled}
                onChange={(e) => setQuietHours({ ...quietHours, enabled: e.target.checked })}
                disabled={!enabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
            </label>
          </div>

          {quietHours.enabled && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  시작 시간
                </label>
                <input
                  type="time"
                  value={quietHours.start}
                  onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })}
                  disabled={!enabled}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  종료 시간
                </label>
                <input
                  type="time"
                  value={quietHours.end}
                  onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })}
                  disabled={!enabled}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                설정 저장
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface NotificationTypeToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  urgent?: boolean;
  comingSoon?: boolean;
}

function NotificationTypeToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  urgent = false,
  comingSoon = false,
}: NotificationTypeToggleProps) {
  return (
    <div className={`flex items-center justify-between p-2 bg-white dark:bg-gray-900/50 rounded ${comingSoon ? 'opacity-60' : ''}`}>
      <div className="flex-1">
        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
          {label}
          {urgent && <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">긴급</span>}
          {comingSoon && <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">곧 제공</span>}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer ml-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled || comingSoon}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
      </label>
    </div>
  );
}
