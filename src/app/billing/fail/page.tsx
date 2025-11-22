'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

function PaymentFailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const message = searchParams.get('message');

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">결제에 실패했습니다</h2>

        {message && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">
              {decodeURIComponent(message)}
            </p>
            {code && (
              <p className="text-xs text-red-600 mt-2">오류 코드: {code}</p>
            )}
          </div>
        )}

        <p className="text-gray-600 mb-8">
          결제 과정에서 문제가 발생했습니다.
          <br />
          다시 시도해주시거나 고객센터로 문의해주세요.
        </p>

        <div className="space-y-3">
          <Link
            href="/billing"
            className="block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            다시 시도하기
          </Link>
          <Link
            href="/dashboard"
            className="block w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            대시보드로 이동
          </Link>
          <a
            href="mailto:support@shifteasy.com"
            className="block w-full text-blue-600 py-3 font-semibold hover:text-blue-700 transition-colors"
          >
            고객센터 문의
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <PaymentFailContent />
    </Suspense>
  );
}
