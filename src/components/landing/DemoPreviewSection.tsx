'use client';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { Users, Clock, Calendar, Shield, Mail, Phone } from 'lucide-react';
import Link from 'next/link';

// 풍부한 목업 데이터
const mockStaffData = [
  { id: 1, name: '김수연', position: '수간호사', email: 'kim.suyeon@hospital.com', phone: '010-1234-5678', status: 'active', role: 'manager', yearsOfService: 10, hireYear: 2015, avatar: null },
  { id: 2, name: '이지은', position: '간호사', email: 'lee.jieun@hospital.com', phone: '010-2345-6789', status: 'active', role: 'member', yearsOfService: 5, hireYear: 2020, avatar: null },
  { id: 3, name: '박민지', position: '간호사', email: 'park.minji@hospital.com', phone: '010-3456-7890', status: 'active', role: 'member', yearsOfService: 3, hireYear: 2022, avatar: null },
  { id: 4, name: '최서현', position: '신규 간호사', email: 'choi.seohyun@hospital.com', phone: '010-4567-8901', status: 'active', role: 'member', yearsOfService: 1, hireYear: 2024, avatar: null },
  { id: 5, name: '정다은', position: '간호사', email: 'jung.daeun@hospital.com', phone: '010-5678-9012', status: 'on_leave', role: 'member', yearsOfService: 4, hireYear: 2021, avatar: null },
  { id: 6, name: '강하늘', position: '파트타임 간호사', email: 'kang.haneul@hospital.com', phone: '010-6789-0123', status: 'active', role: 'member', yearsOfService: 2, hireYear: 2023, avatar: null },
  { id: 7, name: '윤서아', position: '간호사', email: 'yoon.seoa@hospital.com', phone: '010-7890-1234', status: 'active', role: 'member', yearsOfService: 6, hireYear: 2019, avatar: null },
  { id: 8, name: '임채원', position: '간호사', email: 'lim.chaewon@hospital.com', phone: '010-8901-2345', status: 'active', role: 'member', yearsOfService: 7, hireYear: 2018, avatar: null },
  { id: 9, name: '조현우', position: '수간호사', email: 'jo.hyunwoo@hospital.com', phone: '010-9012-3456', status: 'active', role: 'manager', yearsOfService: 12, hireYear: 2013, avatar: null },
  { id: 10, name: '송지훈', position: '간호사', email: 'song.jihoon@hospital.com', phone: '010-0123-4567', status: 'active', role: 'member', yearsOfService: 4, hireYear: 2021, avatar: null },
  { id: 11, name: '한소희', position: '신규 간호사', email: 'han.sohee@hospital.com', phone: '010-1111-2222', status: 'active', role: 'member', yearsOfService: 1, hireYear: 2024, avatar: null },
  { id: 12, name: '배수지', position: '파트타임 간호사', email: 'bae.suzy@hospital.com', phone: '010-2222-3333', status: 'active', role: 'member', yearsOfService: 3, hireYear: 2022, avatar: null },
];

type StatusFilter = 'all' | 'active' | 'on-leave' | 'manager' | 'part-time';

export default function DemoPreviewSection() {
  const { t } = useTranslation('landing');
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

  return (
    <section className="py-20 bg-gradient-to-b from-white to-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F172A] mb-4">
            {t('demoPreview.title')}
          </h2>
          <p className="text-lg sm:text-xl text-[#64748B] max-w-3xl mx-auto">
            {t('demoPreview.subtitle')}
          </p>
        </motion.div>

        {/* Interactive Dashboard Demo */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
        >
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
        </motion.div>

        {/* Bottom Feature Highlight */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
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
        </motion.div>
      </div>
    </section>
  );
}
