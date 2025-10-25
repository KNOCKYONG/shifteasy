'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function RequestsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            요청사항
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            근무 교대 및 휴가 요청을 관리합니다
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">대기 중</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">3</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">승인됨</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">12</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">거부됨</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">2</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">긴급</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">1</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="max-w-md mx-auto">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              곧 출시됩니다
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              요청사항 관리 기능이 곧 추가될 예정입니다.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
