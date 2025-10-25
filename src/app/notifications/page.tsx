'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Bell, Info, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function NotificationsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            알림
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            중요한 알림과 업데이트를 확인하세요
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">읽지 않음</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">5</p>
              </div>
              <Bell className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">오늘</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">8</p>
              </div>
              <Clock className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">중요</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">2</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Sample Notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
          <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  새로운 스케줄이 생성되었습니다
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  2024년 1월 3주차 스케줄을 확인해주세요
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  2시간 전
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  교대 요청이 승인되었습니다
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  1월 15일 교대 요청이 승인되었습니다
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  5시간 전
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  긴급: 인력 부족 경고
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  1월 20일 야간 근무 인력이 부족합니다
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  1일 전
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            더 많은 알림 기능이 곧 추가됩니다
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
