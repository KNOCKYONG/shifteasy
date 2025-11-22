'use client';

import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { api } from '@/lib/trpc/client';

interface ProfileStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function ProfileStep({ onNext, onBack }: ProfileStepProps) {
  const currentUser = useCurrentUser();
  const [formData, setFormData] = useState({
    displayName: currentUser.name || '',
    department: '',
    position: currentUser.dbUser?.position || '',
    phoneNumber: currentUser.dbUser?.profile?.phone || '',
  });

  const updateProfileMutation = api.onboarding.updateProfile.useMutation({
    onSuccess: () => {
      onNext();
    },
  }) as any;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await updateProfileMutation.mutateAsync({
      displayName: formData.displayName,
      department: formData.department || null,
      position: formData.position || null,
      phoneNumber: formData.phoneNumber || null,
    });
  };

  const isValid = formData.displayName.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">기본 프로필 설정</h2>
        <p className="text-gray-600">근무표와 팀 화면에 표시될 내 정보를 정리해 주세요.</p>
      </div>

      <div className="space-y-4">
        {/* 이름 (필수) */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="displayName"
            required
            value={formData.displayName}
            onChange={e => setFormData({ ...formData, displayName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예) 홍길동"
          />
          <p className="mt-1 text-xs text-gray-500">근무표와 교대표에 표시되는 이름입니다.</p>
        </div>

        {/* 부서 (선택) */}
        <div>
          <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
            부서
          </label>
          <input
            type="text"
            id="department"
            value={formData.department}
            onChange={e => setFormData({ ...formData, department: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예) 내과병동, 외과병동"
          />
        </div>

        {/* 직급 (선택) */}
        <div>
          <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-2">
            직급
          </label>
          <select
            id="position"
            value={formData.position}
            onChange={e => setFormData({ ...formData, position: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">선택해 주세요</option>
            <option value="head_nurse">수간호사 / 팀장</option>
            <option value="charge_nurse">책임간호사</option>
            <option value="senior_nurse">선임간호사</option>
            <option value="staff_nurse">일반간호사</option>
          </select>
        </div>

        {/* 연락처 (선택) */}
        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
            연락처
          </label>
          <input
            type="tel"
            id="phoneNumber"
            value={formData.phoneNumber}
            onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예) 010-0000-0000"
          />
          <p className="mt-1 text-xs text-gray-500">
            필요한 경우에만 관리자와 팀장이 확인할 수 있으며, 외부에는 공개되지 않습니다.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <svg
            className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-8-4a1 1 0 100 2 1 1 0 000-2zm-1 4a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900 mb-1">선택 항목은 나중에 언제든지 수정할 수 있어요</p>
            <p className="text-sm text-blue-700">
              이름만 정확히 입력해 주시면 됩니다. 부서·직급·연락처는 이후 팀 관리/설정 화면에서도 변경할 수 있어요.
            </p>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {updateProfileMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <svg
              className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 112 0 1 1 0 01-2 0zm1-8a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-900">프로필 저장 중 오류가 발생했습니다</p>
              <p className="text-sm text-red-700 mt-1">잠시 후 다시 시도해 주세요.</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={updateProfileMutation.isLoading}
          className="px-6 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          이전
        </button>
        <button
          type="submit"
          disabled={!isValid || updateProfileMutation.isLoading}
          className="px-6 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
        >
          {updateProfileMutation.isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              저장 중...
            </>
          ) : (
            '다음으로'
          )}
        </button>
      </div>
    </form>
  );
}
