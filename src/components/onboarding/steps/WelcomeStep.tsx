'use client';

interface WelcomeStepProps {
  onNext: () => void;
  mode?: 'manager' | 'member';
}

export function WelcomeStep({ onNext, mode = 'member' }: WelcomeStepProps) {
  const isManager = mode === 'manager';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">ShiftEasy에 오신 것을 환영합니다</h2>
        <p className="text-gray-600 mb-8">
          {isManager
            ? '첫 근무표를 만들기 전에 필요한 기본 정보들을 3분 안에 정리해 볼게요.'
            : '내 근무표를 더 쉽게 보고, 희망 근무와 교환을 편하게 관리할 수 있어요.'}
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">ShiftEasy로 할 수 있는 일</h3>
        <ul className="space-y-3">
          <li className="flex items-start">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-gray-700">
              <strong>자동 근무표 생성:</strong> 복잡한 규칙을 반영해 공정한 근무표를 자동으로 만들어 줍니다.
            </span>
          </li>
          <li className="flex items-start">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-gray-700">
              <strong>근무 교환 관리:</strong> 간호사끼리 근무 교환을 쉽게 신청하고 승인할 수 있어요.
            </span>
          </li>
          <li className="flex items-start">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-gray-700">
              <strong>희망 근무 반영:</strong> 개인 희망 근무를 수집해 가능한 범위에서 반영합니다.
            </span>
          </li>
          <li className="flex items-start">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-gray-700">
              <strong>휴가·교육 일정 관리:</strong> 휴가, 교육, 오프를 한 번에 관리하고 기록으로 남길 수 있어요.
            </span>
          </li>
        </ul>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex">
          <svg
            className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-900 mb-1">
              {isManager ? '3분이면 첫 스케줄 준비 완료!' : '1분이면 기본 설정이 끝나요'}
            </p>
            <p className="text-sm text-amber-700">
              {isManager
                ? '프로필, 팀, 기본 규칙만 설정해 두면 바로 첫 근무표를 생성해 볼 수 있어요.'
                : '내 프로필만 한 번 설정해 두면, 이후에는 바로 스케줄을 확인하고 희망 근무를 남길 수 있어요.'}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={onNext}
          className="w-full px-6 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          시작하기
        </button>
      </div>
    </div>
  );
}

