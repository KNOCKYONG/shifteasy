'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { BarChart3, TrendingUp, Users, Clock, Calendar, Activity } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            분석
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            근무 스케줄 및 팀 성과 분석 대시보드
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                +12%
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">24</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">활성 직원</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                +8%
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">1,920</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">이번 달 총 근무시간</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                -3%
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">95.2%</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">스케줄 준수율</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Activity className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                +5%
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">87.5%</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">직원 만족도</p>
          </div>
        </div>

        {/* Charts Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              월별 근무시간 추이
            </h3>
            <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-center">
                <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">차트가 여기에 표시됩니다</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              시프트별 분포
            </h3>
            <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-center">
                <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">차트가 여기에 표시됩니다</p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              부서별 성과
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    부서
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    인원
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    근무시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    준수율
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    응급실
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    8명
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    640시간
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full text-xs font-medium">
                      98%
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    중환자실
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    6명
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    480시간
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full text-xs font-medium">
                      96%
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    외래
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    10명
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    800시간
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-full text-xs font-medium">
                      92%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            더 상세한 분석 기능이 곧 추가됩니다
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
