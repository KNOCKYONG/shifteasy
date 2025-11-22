'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const [isConfirming, setIsConfirming] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const confirmPayment = async () => {
      const paymentKey = searchParams.get('paymentKey');
      const orderId = searchParams.get('orderId');
      const amount = searchParams.get('amount');

      if (!paymentKey || !orderId || !amount) {
        setError('寃곗젣 ?뺣낫媛 ?щ컮瑜댁? ?딆뒿?덈떎.');
        setIsConfirming(false);
        return;
      }

      try {
        const response = await fetch('/api/payments/toss/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: parseInt(amount),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '寃곗젣 ?뱀씤???ㅽ뙣?덉뒿?덈떎.');
        }

        setIsConfirming(false);
      } catch (err) {
        console.error('Payment confirmation error:', err);
        setError(err instanceof Error ? err.message : '寃곗젣 ?뱀씤 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
        setIsConfirming(false);
      }
    };

    confirmPayment();
  }, [searchParams]);

  if (isConfirming) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">寃곗젣 ?뺤씤 以?..</h2>
          <p className="text-gray-600">?좎떆留?湲곕떎?ㅼ＜?몄슂.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">!</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">寃곗젣 ?뱀씤 ?ㅽ뙣</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <Link
              href="/billing"
              className="block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              ?ㅼ떆 ?쒕룄?섍린
            </Link>
            <Link
              href="/dashboard"
              className="block w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              ??쒕낫?쒕줈 ?대룞
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">寃곗젣媛 ?꾨즺?섏뿀?듬땲??</h2>
        <p className="text-gray-600 mb-8">
          ShiftEasy瑜??좏깮??二쇱뀛??媛먯궗?⑸땲??
          <br />
          ?댁젣 紐⑤뱺 湲곕뒫???ъ슜?섏떎 ???덉뒿?덈떎.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            ?벁 寃곗젣 ?곸닔利앹씠 ?대찓?쇰줈 諛쒖넚?섏뿀?듬땲??
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-300"
        >
          ??쒕낫?쒕줈 ?대룞
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">寃곗젣 ?뺤씤 以?..</h2>
          <p className="text-gray-600">?좎떆留?湲곕떎?ㅼ＜?몄슂.</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}

