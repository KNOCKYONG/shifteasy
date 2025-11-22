'use client';

import { useRouter } from 'next/navigation';

interface TeamStepProps {
  onComplete: () => void;
  onBack: () => void;
  mode?: 'manager' | 'member';
}

export function TeamStep({ onComplete, onBack, mode = 'member' }: TeamStepProps) {
  const router = useRouter();
  const isManager = mode === 'manager';

  const handleGoToTeam = () => {
    router.push('/department');
  };

  const handleGoToSchedule = () => {
    router.push('/schedule');
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isManager ? '팀 구성 계획 세우기' : '내가 속한 팀 이해하기'}
        </h2>
        <p className="text-gray-600 mb-8">
          {isManager
            ? '어떤 팀에 누가 속해 있는지 정리해 두면 근무표를 만들 때 훨씬 수월해집니다.'
            : '내가 속한 팀이 어떻게 구성되어 있는지 알면 스케줄을 이해하기가 쉬워요.'}
        </p>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          팀이란 무엇인가요?
        </h3>
        <p className="text-gray-700 mb-4">
          함께 근무하는 간호사들을 하나의 그룹으로 묶어 관리하는 단위를 팀이라고 부릅니다. 예를 들어
          &quot;내과병동 3교대팀&quot;, &quot;외과병동 Day팀&quot;처럼 나눌 수 있어요.
        </p>
        <div className="bg-white rounded-lg p-4 space-y-3">
          <div className="flex items-start">
            <span className="text-blue-600 font-bold mr-3">1.</span>
            <div>
              <p className="font-medium text-gray-900">팀 이름 정하기</p>
              <p className="text-sm text-gray-600">
                예: &quot;내과병동 3교대 A팀&quot;, &quot;중환자실 Night팀&quot; 처럼 근무 패턴이 한눈에 보이도록
                정하면 좋아요.
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <span className="text-blue-600 font-bold mr-3">2.</span>
            <div>
              <p className="font-medium text-gray-900">
                {isManager ? '팀에 구성원 배정하기' : '내가 속한 팀 확인하기'}
              </p>
              <p className="text-sm text-gray-600">
                {isManager
                  ? '각 팀에 어떤 간호사들이 속하는지 정의하면 스케줄 생성 시 자동으로 반영됩니다.'
                  : '관리자가 나를 어느 팀에 배정해 두었는지에 따라 내가 보는 스케줄이 달라집니다.'}
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <span className="text-blue-600 font-bold mr-3">3.</span>
            <div>
              <p className="font-medium text-gray-900">선호도와 특이사항 기록하기</p>
              <p className="text-sm text-gray-600">
                야간 선호, 주말 근무 가능 여부, 교육 일정 등 팀원의 특성을 미리 정리해 두면 배치에 도움이 됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          {isManager ? '팀을 잘 구성해 두면 좋은 점' : '팀을 이해하면 좋은 점'}
        </h3>
        <div className="space-y-3">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-gray-900">자동 근무표 생성이 쉬워집니다</p>
              <p className="text-sm text-gray-600">
                인원, 경력, 야간·주말 부담 등을 고려해 팀을 나눠두면 더 공정한 근무표를 만들 수 있어요.
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-gray-900">
                {isManager ? '근무 교환·요청 관리가 명확해집니다' : '근무 교환·요청의 기준을 이해할 수 있어요'}
              </p>
              <p className="text-sm text-gray-600">
                같은 팀 안에서 누구와 교환이 가능한지, 어떤 기준으로 승인되는지 더 명확해집니다.
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-gray-900">커뮤니케이션이 수월해집니다</p>
              <p className="text-sm text-gray-600">
                팀 단위로 공지·회의·교육을 진행하면 모두가 같은 정보를 공유할 수 있어요.
              </p>
            </div>
          </div>
        </div>
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
              {isManager ? '처음에는 한 팀부터 가볍게 시작해도 좋아요' : '팀 구성은 관리자와 함께 맞춰가면 됩니다'}
            </p>
            <p className="text-sm text-amber-700">
              {isManager
                ? '우선 대표 팀 하나만 만들어 스케줄을 돌려 보고, 이후에 팀을 나누거나 추가해도 괜찮습니다.'
                : '온보딩에서는 팀을 직접 만들지 않아도 됩니다. 나중에 배정된 팀과 스케줄만 잘 확인해 주세요.'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-6 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          이전
        </button>

        {isManager ? (
          <>
            <button
              type="button"
              onClick={onComplete}
              className="flex-1 px-6 py-3 text-base font-medium text-white bg-gray-600 border border-transparent rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              나중에 팀 만들기
            </button>
            <button
              type="button"
              onClick={handleGoToTeam}
              className="flex-1 px-6 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              지금 팀 관리 화면 열기
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onComplete}
              className="flex-1 px-6 py-3 text-base font-medium text-white bg-gray-600 border border-transparent rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              온보딩 완료하기
            </button>
            <button
              type="button"
              onClick={handleGoToSchedule}
              className="flex-1 px-6 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              내 스케줄 보러가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

