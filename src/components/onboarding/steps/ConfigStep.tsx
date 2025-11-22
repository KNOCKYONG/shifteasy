'use client';

interface ConfigStepProps {
  onNext: () => void;
  onBack: () => void;
  mode?: 'manager' | 'member';
}

export function ConfigStep({ onNext, onBack, mode = 'member' }: ConfigStepProps) {
  const isManager = mode === 'manager';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isManager ? '근무 환경 기본 설정 살펴보기' : '우리 병동의 근무 규칙 이해하기'}
        </h2>
        <p className="text-gray-600 mb-8">
          {isManager
            ? '설정 메뉴에서 어떤 항목들을 손봐야 첫 스케줄을 안정적으로 만들 수 있는지 정리해 드려요.'
            : '관리자가 어떻게 규칙을 설정하는지 알면, 내 스케줄이 어떤 기준으로 만들어지는지 이해하기 쉬워요.'}
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 mb-4">설정 메뉴에서 다루는 주요 항목</h3>

        {/* 기본 설정 */}
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
            <span className="text-blue-600 font-bold text-lg">1</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">
              {isManager ? '스케줄 생성 규칙' : '스케줄 생성 기준'}
            </h4>
            <p className="text-sm text-gray-600">
              {isManager
                ? '근무 시간, 연속 근무 제한, 야간·휴일 가중치 등을 설정해서 병동 상황에 맞게 자동 스케줄러를 튜닝할 수 있습니다.'
                : '연속 근무 일수, 야간/휴일 균형 등은 관리자 설정에 따라 자동으로 맞춰집니다.'}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              상단 메뉴의 <span className="font-medium">설정 &gt; 기본 설정</span> 에서 관리합니다.
            </p>
          </div>
        </div>

        {/* 근무 유형 */}
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-4">
            <span className="text-green-600 font-bold text-lg">2</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">근무 유형(Shift)</h4>
            <p className="text-sm text-gray-600">
              Day, Evening, Night, Off 등 근무 종류와 시작·종료 시간, 색상, 초과근무 허용 여부를 정의합니다.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              <span className="font-medium">설정 &gt; 근무 유형</span> 에서 수정할 수 있고, 변경 즉시 스케줄 생성에 반영됩니다.
            </p>
          </div>
        </div>

        {/* 부서/팀 패턴 */}
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
            <span className="text-purple-600 font-bold text-lg">3</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">
              {isManager ? '부서별 근무 패턴' : '우리 팀의 근무 패턴'}
            </h4>
            <p className="text-sm text-gray-600">
              {isManager
                ? '병동/팀별로 3교대, 2교대, 파트타임 패턴을 미리 정의해 두면 스케줄 생성이 훨씬 쉬워집니다.'
                : '내가 속한 팀이 3교대인지, 2교대인지에 따라 근무 패턴이 달라집니다.'}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              <span className="font-medium">부서/팀 관리</span> 화면에서 각 팀의 패턴과 인원 기준을 관리합니다.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex">
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
            <p className="text-sm font-medium text-green-900 mb-1">
              {isManager ? '지금은 개념만 가볍게 확인하면 충분해요' : '규칙은 관리자에게 맡겨두셔도 괜찮아요'}
            </p>
            <p className="text-sm text-green-700">
              {isManager
                ? '온보딩 이후에도 설정 메뉴에서 언제든지 다시 조정할 수 있습니다. 우선 기본값으로 스케줄을 한 번 만들어 보세요.'
                : '온보딩에서는 규칙을 바꾸지 않아도 됩니다. 나중에 궁금할 때 설정 화면에서 어떻게 되어 있는지만 확인해 보셔도 좋아요.'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2 flex items-center">
          <svg
            className="w-5 h-5 text-gray-600 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          기억해두면 좋은 팁
        </h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <span>설정은 한 번에 완벽하게 맞추지 않아도 됩니다. 스케줄을 돌려보면서 조금씩 조정해도 괜찮아요.</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <span>규칙을 바꾸면 기존 스케줄은 그대로 두고, 새 스케줄 생성에만 영향을 줄 수 있습니다.</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <span>팀 내 합의를 거쳐 주요 규칙을 정해두면 교대 근무 만족도가 더 높아집니다.</span>
          </li>
        </ul>
      </div>

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-6 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          다음
        </button>
      </div>
    </div>
  );
}

