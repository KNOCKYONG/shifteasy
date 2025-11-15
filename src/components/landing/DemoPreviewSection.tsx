'use client';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { Users, Clock, Calendar, Shield, Mail, Phone } from 'lucide-react';
import Link from 'next/link';

// 풍부한 목업 데이터
const mockStaffData = [
  { id: 1, name: '샘플 A', position: '수간호사', email: 'sample.a@example.com', phone: '010-0000-0000', status: 'active', role: 'manager', yearsOfService: 10, hireYear: 2015, avatar: null },
  { id: 2, name: '샘플 B', position: '간호사', email: 'sample.b@example.com', phone: '010-0000-0000', status: 'active', role: 'member', yearsOfService: 5, hireYear: 2020, avatar: null },
  { id: 3, name: '샘플 C', position: '간호사', email: 'sample.c@example.com', phone: '010-0000-0000', status: 'active', role: 'member', yearsOfService: 3, hireYear: 2022, avatar: null },
  { id: 4, name: '샘플 D', position: '신규 간호사', email: 'sample.d@example.com', phone: '010-0000-0000', status: 'active', role: 'member', yearsOfService: 1, hireYear: 2024, avatar: null },
  { id: 5, name: '샘플 E', position: '간호사', email: 'sample.e@example.com', phone: '010-0000-0000', status: 'on_leave', role: 'member', yearsOfService: 4, hireYear: 2021, avatar: null },
  { id: 6, name: '샘플 F', position: '파트타임 간호사', email: 'sample.f@example.com', phone: '010-0000-0000', status: 'active', role: 'member', yearsOfService: 2, hireYear: 2023, avatar: null },
  { id: 7, name: '샘플 G', position: '간호사', email: 'sample.g@example.com', phone: '010-0000-0000', status: 'active', role: 'member', yearsOfService: 6, hireYear: 2019, avatar: null },
  { id: 8, name: '샘플 H', position: '간호사', email: 'sample.h@example.com', phone: '010-0000-0000', status: 'active', role: 'member', yearsOfService: 7, hireYear: 2018, avatar: null },
  { id: 9, name: '샘플 I', position: '수간호사', email: 'sample.i@example.com', phone: '010-0000-0000', status: 'active', role: 'manager', yearsOfService: 12, hireYear: 2013, avatar: null },
  { id: 10, name: '샘플 J', position: '간호사', email: 'sample.j@example.com', phone: '010-0000-0000', status: 'active', role: 'member', yearsOfService: 4, hireYear: 2021, avatar: null },
  { id: 11, name: '샘플 K', position: '신규 간호사', email: 'sample.k@example.com', phone: '010-0000-0000', status: 'active', role: 'member', yearsOfService: 1, hireYear: 2024, avatar: null },
  { id: 12, name: '샘플 L', position: '파트타임 간호사', email: 'sample.l@example.com', phone: '010-0000-0000', status: 'active', role: 'member', yearsOfService: 3, hireYear: 2022, avatar: null },
];

// 근무표 목업 데이터 - 2025년 1월 기준 (31일)
const mockScheduleData = [
  { id: 1, name: '샘플 A', position: '수간호사', shifts: ['D', 'D', 'D', 'D', 'D', 'OFF', 'OFF', 'E', 'E', 'E', 'E', 'E', 'OFF', 'OFF', 'N', 'N', 'N', 'N', 'N', 'OFF', 'OFF', 'D', 'D', 'D', 'D', 'D', 'OFF', 'OFF', 'E', 'E', 'E'] },
  { id: 2, name: '샘플 B', position: '간호사', shifts: ['E', 'E', 'E', 'E', 'E', 'OFF', 'OFF', 'N', 'N', 'N', 'N', 'N', 'OFF', 'OFF', 'D', 'D', 'D', 'D', 'D', 'OFF', 'OFF', 'E', 'E', 'E', 'E', 'E', 'OFF', 'OFF', 'N', 'N', 'N'] },
  { id: 3, name: '샘플 C', position: '간호사', shifts: ['N', 'N', 'N', 'N', 'N', 'OFF', 'OFF', 'D', 'D', 'D', 'D', 'D', 'OFF', 'OFF', 'E', 'E', 'E', 'E', 'E', 'OFF', 'OFF', 'N', 'N', 'N', 'N', 'N', 'OFF', 'OFF', 'D', 'D', 'D'] },
  { id: 4, name: '샘플 D', position: '신규 간호사', shifts: ['D', 'D', 'D', 'OFF', 'OFF', 'D', 'D', 'D', 'D', 'OFF', 'OFF', 'E', 'E', 'E', 'E', 'E', 'OFF', 'OFF', 'N', 'N', 'N', 'N', 'N', 'OFF', 'OFF', 'D', 'D', 'D', 'D', 'D', 'OFF'] },
  { id: 5, name: '샘플 E', position: '간호사', shifts: ['OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF'] },
  { id: 6, name: '샘플 F', position: '파트타임', shifts: ['E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E', 'OFF', 'E'] },
  { id: 7, name: '샘플 G', position: '간호사', shifts: ['OFF', 'OFF', 'N', 'N', 'N', 'N', 'N', 'OFF', 'OFF', 'D', 'D', 'D', 'D', 'D', 'OFF', 'OFF', 'E', 'E', 'E', 'E', 'E', 'OFF', 'OFF', 'N', 'N', 'N', 'N', 'N', 'OFF', 'OFF', 'D'] },
  { id: 8, name: '샘플 H', position: '간호사', shifts: ['D', 'D', 'D', 'D', 'OFF', 'OFF', 'D', 'E', 'E', 'E', 'E', 'E', 'OFF', 'OFF', 'N', 'N', 'N', 'N', 'N', 'OFF', 'OFF', 'D', 'D', 'D', 'D', 'D', 'OFF', 'OFF', 'E', 'E', 'E'] },
];

type StatusFilter = 'all' | 'active' | 'on-leave' | 'manager' | 'part-time';
type ViewMode = 'staff' | 'schedule';

export default function DemoPreviewSection() {
  const { t } = useTranslation('landing');
  const [viewMode, setViewMode] = useState<ViewMode>('staff');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 필터링된 근무자 목록
  const filteredStaff = useMemo(() => {
    let filtered = mockStaffData;

    // 상태 필터
    if (statusFilter === 'active') {
      filtered = filtered.filter(s => s.status === 'active');
    } else if (statusFilter === 'on-leave') {
      filtered = filtered.filter(s => s.status === 'on_leave');
    } else if (statusFilter === 'manager') {
      filtered = filtered.filter(s => s.role === 'manager');
    } else if (statusFilter === 'part-time') {
      filtered = filtered.filter(s => s.position.includes('파트타임'));
    }

    // 검색 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.position.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [statusFilter, searchQuery]);

  // 통계 계산
  const stats = {
    total: mockStaffData.length,
    active: mockStaffData.filter(s => s.status === 'active').length,
    onLeave: mockStaffData.filter(s => s.status === 'on_leave').length,
    managers: mockStaffData.filter(s => s.role === 'manager').length,
    partTime: mockStaffData.filter(s => s.position.includes('파트타임')).length,
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'manager': return 'bg-[#DBEAFE] text-[#2563EB]';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getShiftBadgeStyle = (shift: string) => {
    switch (shift) {
      case 'D': return '#EAB308'; // Day - 주간
      case 'E': return '#F59E0B'; // Evening - 저녁
      case 'N': return '#6366F1'; // Night - 야간
      case 'OFF': return '#9CA3AF'; // Off - 휴무
      default: return '#64748B';
    }
  };

  // 2025년 1월 날짜 데이터 생성 (1일~31일)
  const days = Array.from({ length: 31 }, (_, i) => {
    const date = new Date(2025, 0, i + 1); // 2025년 1월
    const dayOfWeek = date.getDay(); // 0(일) ~ 6(토)
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return {
      date: i + 1,
      dayName: dayNames[dayOfWeek],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    };
  });

  return (
    <section className="py-20 bg-gradient-to-b from-white to-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F172A] mb-4">
            {t('demoPreview.title')}
          </h2>
          <p className="text-lg sm:text-xl text-[#64748B] max-w-3xl mx-auto">
            {t('demoPreview.subtitle')}
          </p>
        </motion.div>

        {/* View Mode Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="flex justify-center gap-3 mb-8"
        >
          <button
            onClick={() => setViewMode('staff')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              viewMode === 'staff'
                ? 'bg-[#2563EB] text-white shadow-lg'
                : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#2563EB] hover:text-[#2563EB]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>근무자 보기</span>
            </div>
          </button>
          <button
            onClick={() => setViewMode('schedule')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              viewMode === 'schedule'
                ? 'bg-[#2563EB] text-white shadow-lg'
                : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#2563EB] hover:text-[#2563EB]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              <span>근무표 보기</span>
            </div>
          </button>
        </motion.div>

        {/* Interactive Dashboard Demo */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
        >
          {/* Staff View */}
          {viewMode === 'staff' && (
            <>
              {/* Stats Cards */}
              <div className="p-6 sm:p-8 border-b border-gray-100">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <button
                onClick={() => setStatusFilter('all')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  statusFilter === 'all'
                    ? 'border-[#2563EB] bg-[#DBEAFE]/50 shadow-lg'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-5 h-5 text-[#2563EB]" />
                </div>
                <p className="text-xs text-[#64748B]">전체 인원</p>
                <p className="text-2xl font-bold text-[#0F172A]">{stats.total}명</p>
              </button>

              <button
                onClick={() => setStatusFilter('active')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  statusFilter === 'active'
                    ? 'border-[#2563EB] bg-[#DBEAFE]/50 shadow-lg'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-[#2563EB]" />
                </div>
                <p className="text-xs text-[#64748B]">근무 중</p>
                <p className="text-2xl font-bold text-[#0F172A]">{stats.active}명</p>
              </button>

              <button
                onClick={() => setStatusFilter('on-leave')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  statusFilter === 'on-leave'
                    ? 'border-[#F97316] bg-[#FED7AA]/50 shadow-lg'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-5 h-5 text-[#F97316]" />
                </div>
                <p className="text-xs text-[#64748B]">휴직 중</p>
                <p className="text-2xl font-bold text-[#0F172A]">{stats.onLeave}명</p>
              </button>

              <button
                onClick={() => setStatusFilter('manager')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  statusFilter === 'manager'
                    ? 'border-[#2563EB] bg-[#DBEAFE]/50 shadow-lg'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Shield className="w-5 h-5 text-[#2563EB]" />
                </div>
                <p className="text-xs text-[#64748B]">관리자</p>
                <p className="text-2xl font-bold text-[#0F172A]">{stats.managers}명</p>
              </button>

              <button
                onClick={() => setStatusFilter('part-time')}
                className={`col-span-2 sm:col-span-1 p-4 rounded-xl border-2 transition-all ${
                  statusFilter === 'part-time'
                    ? 'border-[#F97316] bg-[#FED7AA]/50 shadow-lg'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-[#F97316]" />
                </div>
                <p className="text-xs text-[#64748B]">파트타임</p>
                <p className="text-2xl font-bold text-[#0F172A]">{stats.partTime}명</p>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-6 sm:p-8 border-b border-gray-100 bg-[#F8FAFC]">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                placeholder="이름, 이메일, 직책으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-[#0F172A] placeholder-[#64748B]"
              />
              <Link
                href="/billing?plan=professional"
                className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white rounded-lg font-semibold hover:shadow-lg transition-all whitespace-nowrap"
              >
                {t('demoPreview.tryNow')}
              </Link>
            </div>
          </div>

          {/* Staff Grid */}
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  viewport={{ once: true }}
                  className="group bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-[#2563EB]/30 transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {member.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[#0F172A] truncate">{member.name}</h3>
                      <p className="text-xs text-[#64748B] truncate">{member.position}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-3 text-xs">
                    <div className="flex items-center gap-2 text-[#64748B]">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#64748B]">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <span>{member.phone}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {member.yearsOfService && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-[#DBEAFE] text-[#2563EB]">
                        <Clock className="w-3 h-3" />
                        {member.yearsOfService}년차
                      </span>
                    )}
                    {member.hireYear && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-700">
                        <Calendar className="w-3 h-3" />
                        {member.hireYear}년 입사
                      </span>
                    )}
                    {member.role === 'manager' && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)}`}>
                        수간호사
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {filteredStaff.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-[#64748B]">검색 결과가 없습니다</p>
                <p className="text-sm text-gray-400 mt-1">다른 검색어나 필터를 시도해보세요</p>
              </div>
            )}
          </div>
            </>
          )}

          {/* Schedule View */}
          {viewMode === 'schedule' && (
            <div className="overflow-x-auto">
              {/* Schedule Header */}
              <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-[#F8FAFC]">
                <h3 className="text-lg font-bold text-[#0F172A]">2025년 1월 근무표</h3>
                <div className="flex gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: '#EAB308' }}></span>
                    <span className="text-[#64748B]">D (주간)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: '#F59E0B' }}></span>
                    <span className="text-[#64748B]">E (저녁)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: '#6366F1' }}></span>
                    <span className="text-[#64748B]">N (야간)</span>
                  </div>
                </div>
              </div>

              {/* Schedule Grid */}
              <div className="min-w-max">
                {/* Grid Header */}
                <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `120px repeat(31, 32px)` }}>
                  <div className="p-1.5 bg-gray-50 font-medium text-xs text-gray-700 flex items-center border-r border-gray-200">
                    직원
                  </div>
                  {days.map((day) => (
                    <div
                      key={day.date}
                      className={`py-1 px-0.5 bg-gray-50 text-center border-l border-gray-200 ${
                        day.isWeekend ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <div className={`font-medium text-[10px] ${
                        day.isWeekend ? 'text-red-500' : 'text-gray-700'
                      }`}>
                        {day.dayName}
                      </div>
                      <div className={`text-[9px] ${
                        day.isWeekend ? 'text-red-500' : 'text-gray-500'
                      }`}>
                        {day.date}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Grid Rows */}
                {mockScheduleData.map((staff, staffIndex) => (
                  <motion.div
                    key={staff.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: staffIndex * 0.05 }}
                    viewport={{ once: true }}
                    className="grid border-b border-gray-100 hover:bg-gray-50"
                    style={{ gridTemplateColumns: `120px repeat(31, 32px)` }}
                  >
                    <div className="p-1.5 flex flex-col justify-center border-r border-gray-100">
                      <div className="text-xs font-medium text-gray-900 truncate">{staff.name}</div>
                      <div className="text-[10px] text-gray-500 truncate">{staff.position}</div>
                    </div>
                    {staff.shifts.map((shift, dayIndex) => (
                      <div
                        key={dayIndex}
                        className="p-0.5 border-l border-gray-100 flex items-center justify-center"
                      >
                        <div
                          className="w-full px-1 py-1 rounded text-[10px] font-medium text-white text-center"
                          style={{ backgroundColor: getShiftBadgeStyle(shift) }}
                          title={shift === 'D' ? '주간' : shift === 'E' ? '저녁' : shift === 'N' ? '야간' : '휴무'}
                        >
                          {shift}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ))}
              </div>

              {/* Try Now Button */}
              <div className="p-6 text-center border-t border-gray-100">
                <Link
                  href="/billing?plan=professional"
                  className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  {t('demoPreview.tryNow')}
                </Link>
              </div>
            </div>
          )}
        </motion.div>

        {/* Bottom Feature Highlight */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          {viewMode === 'staff' ? (
            <>
              <p className="text-[#64748B] mb-4">
                ✨ 실제 관리자 대시보드 미리보기 - 모든 필터가 실시간으로 작동합니다
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 text-sm text-[#64748B]">
                  <span className="w-2 h-2 bg-[#2563EB] rounded-full"></span>
                  상태별 필터링
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 text-sm text-[#64748B]">
                  <span className="w-2 h-2 bg-[#2563EB] rounded-full"></span>
                  실시간 검색
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 text-sm text-[#64748B]">
                  <span className="w-2 h-2 bg-[#2563EB] rounded-full"></span>
                  경력 정보 관리
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="text-[#64748B] mb-4">
                ✨ AI가 자동으로 생성한 공정한 근무표 - 요청·경력·선호를 모두 반영합니다
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 text-sm text-[#64748B]">
                  <span className="w-2 h-2 bg-[#2563EB] rounded-full"></span>
                  3교대 균등 배분
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 text-sm text-[#64748B]">
                  <span className="w-2 h-2 bg-[#2563EB] rounded-full"></span>
                  연속 근무 제한
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 text-sm text-[#64748B]">
                  <span className="w-2 h-2 bg-[#2563EB] rounded-full"></span>
                  휴무 패턴 최적화
                </span>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
