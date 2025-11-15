'use client';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { Users, Clock, Calendar, Shield, Mail, Phone, Sparkles, CheckCircle, Zap, FileText, Settings } from 'lucide-react';
import Link from 'next/link';

// 풍부한 목업 데이터 - Config 직급 코드 사용 (직급별 밸런스)
// HN: 수석간호사 (Level 9, 10-12년차), SN: 전문간호사 (Level 7, 7-9년차), CN: 책임간호사 (Level 5, 5-6년차), RN: 정규간호사 (Level 3, 3-4년차), NA: 간호조무사 (Level 1, 1-2년차)
const mockStaffData = [
  { id: 1, name: '김수연', position: 'HN', email: 'kim.suyeon@hospital.com', phone: '010-1234-5678', status: 'active', role: 'manager', yearsOfService: 10, hireYear: 2015, avatar: null },
  { id: 2, name: '임채원', position: 'SN', email: 'lim.chaewon@hospital.com', phone: '010-9012-3456', status: 'active', role: 'member', yearsOfService: 8, hireYear: 2017, avatar: null },
  { id: 3, name: '한지우', position: 'CN', email: 'han.jiwoo@hospital.com', phone: '010-8901-2345', status: 'active', role: 'member', yearsOfService: 6, hireYear: 2019, avatar: null },
  { id: 4, name: '윤서준', position: 'CN', email: 'yoon.seojun@hospital.com', phone: '010-7890-1234', status: 'active', role: 'member', yearsOfService: 5, hireYear: 2020, avatar: null },
  { id: 5, name: '이지은', position: 'RN', email: 'lee.jieun@hospital.com', phone: '010-2345-6789', status: 'active', role: 'member', yearsOfService: 4, hireYear: 2021, avatar: null },
  { id: 6, name: '정하은', position: 'RN', email: 'jung.haeun@hospital.com', phone: '010-5678-9012', status: 'on_leave', role: 'member', yearsOfService: 4, hireYear: 2021, avatar: null },
  { id: 7, name: '송예진', position: 'RN', email: 'song.yejin@hospital.com', phone: '010-0123-4567', status: 'active', role: 'member', yearsOfService: 3, hireYear: 2022, avatar: null },
  { id: 8, name: '박민준', position: 'RN', email: 'park.minjun@hospital.com', phone: '010-3456-7890', status: 'active', role: 'member', yearsOfService: 3, hireYear: 2022, avatar: null },
  { id: 9, name: '최서윤', position: 'NA', email: 'choi.seoyun@hospital.com', phone: '010-4567-8901', status: 'active', role: 'member', yearsOfService: 1, hireYear: 2024, avatar: null },
  { id: 10, name: '오태양', position: 'NA', email: 'oh.taeyang@hospital.com', phone: '010-1122-3344', status: 'active', role: 'member', yearsOfService: 1, hireYear: 2024, avatar: null },
  { id: 11, name: '강민지', position: 'NA', email: 'kang.minji@hospital.com', phone: '010-6789-0123', status: 'active', role: 'member', yearsOfService: 2, hireYear: 2023, avatar: null },
  { id: 12, name: '배수아', position: 'NA', email: 'bae.sua@hospital.com', phone: '010-2233-4455', status: 'active', role: 'member', yearsOfService: 2, hireYear: 2023, avatar: null },
];

// 근무표 목업 데이터 - 2025년 11월 기준 (30일) - Config 직급 코드 사용 (직급별 밸런스)
// 현실적인 3교대 로테이션 패턴: 주간(D) → 저녁(E) → 야간(N) → 행정(A) → 휴무(OFF) 사이클
// 11월 주말: 1-2일(토일), 8-9일(토일), 15-16일(토일), 22-23일(토일), 29-30일(토일) = 총 10일
// ^ 표시: 요청사항이 있는 근무
// 각 시프트에 고년차(HN, SN, CN)와 저년차(RN, NA)가 적절히 배치됨
const mockScheduleData = [
  // 김수연 (HN-수석간호사, 10년차, 21일 근무): 행정 업무, 주말 일부 휴무
  { id: 1, name: '김수연', position: 'HN', shifts: ['OFF', 'OFF', 'A', 'A', 'A^', 'A', 'A', 'OFF', 'OFF', 'A', 'A', 'A', 'A', 'A^', 'OFF', 'OFF', 'A', 'A', 'A', 'A', 'A', 'OFF', 'OFF', 'A', 'A', 'A^', 'A', 'A', 'OFF', 'OFF'] },

  // 임채원 (SN-전문간호사, 8년차, 22일 근무): D→E→N 로테이션, 안정적 패턴
  { id: 2, name: '임채원', position: 'SN', shifts: ['OFF', 'OFF', 'D', 'D', 'D^', 'D', 'OFF', 'E', 'OFF', 'E', 'E', 'E^', 'E', 'OFF', 'OFF', 'N', 'N', 'N', 'N^', 'OFF', 'D', 'OFF', 'D', 'D', 'D', 'D', 'OFF', 'OFF', 'OFF', 'E'] },

  // 한지우 (CN-책임간호사, 6년차, 23일 근무): D 시작 로테이션, 고년차 역할
  { id: 3, name: '한지우', position: 'CN', shifts: ['OFF', 'D', 'D', 'D', 'D^', 'OFF', 'E', 'OFF', 'E', 'E', 'E', 'E', 'OFF', 'N', 'OFF', 'N', 'N^', 'N', 'OFF', 'D', 'D', 'OFF', 'D', 'D', 'D^', 'D', 'OFF', 'E', 'OFF', 'E'] },

  // 윤서준 (CN-책임간호사, 5년차, 22일 근무): 야간 비중, 중견 역할
  { id: 4, name: '윤서준', position: 'CN', shifts: ['OFF', 'N', 'N', 'N^', 'N', 'OFF', 'D', 'OFF', 'D', 'D', 'D', 'OFF', 'E', 'E', 'OFF', 'E', 'E^', 'OFF', 'N', 'N', 'N', 'OFF', 'OFF', 'D', 'D', 'D^', 'D', 'OFF', 'OFF', 'N'] },

  // 이지은 (RN-정규간호사, 4년차, 22일 근무): D→E→N 로테이션
  { id: 5, name: '이지은', position: 'RN', shifts: ['OFF', 'OFF', 'D', 'D', 'D^', 'D', 'OFF', 'OFF', 'OFF', 'E', 'E', 'E', 'E^', 'OFF', 'OFF', 'OFF', 'N', 'N', 'N', 'OFF', 'D', 'OFF', 'OFF', 'D', 'D^', 'D', 'D', 'OFF', 'OFF', 'OFF'] },

  // 정하은 (RN-정규간호사, 4년차, 10일 근무 + 연차): 초중반 근무 후 연차
  { id: 6, name: '정하은', position: 'RN', shifts: ['OFF', 'OFF', 'D', 'D', 'D', 'OFF', 'E', 'OFF', 'OFF', 'E', 'E', 'OFF', 'OFF', 'OFF', 'OFF', '연차', '연차', '연차', '연차', '연차', '연차', 'OFF', '연차', '연차', '연차', '연차', '연차', '연차', 'OFF', '연차'] },

  // 송예진 (RN-정규간호사, 3년차, 23일 근무): E 시작 로테이션
  { id: 7, name: '송예진', position: 'RN', shifts: ['OFF', 'E', 'E', 'E', 'E^', 'OFF', 'N', 'OFF', 'OFF', 'N', 'N', 'N^', 'OFF', 'D', 'OFF', 'D', 'D', 'D', 'D', 'OFF', 'E', 'OFF', 'E', 'E', 'E^', 'E', 'OFF', 'N', 'OFF', 'N'] },

  // 박민준 (RN-정규간호사, 3년차, 22일 근무): D 위주 로테이션
  { id: 8, name: '박민준', position: 'RN', shifts: ['OFF', 'OFF', 'D', 'D', 'D', 'D^', 'OFF', 'OFF', 'E', 'E', 'E', 'E', 'OFF', 'N', 'OFF', 'N', 'N^', 'N', 'OFF', 'OFF', 'D', 'OFF', 'D', 'D', 'D', 'D', 'OFF', 'E', 'OFF', 'E'] },

  // 최서윤 (NA-간호조무사, 1년차, 20일 근무): 주간 위주, 야간 없음
  { id: 9, name: '최서윤', position: 'NA', shifts: ['OFF', 'D', 'D', 'D^', 'D', 'D', 'OFF', 'OFF', 'OFF', 'D', 'D', 'D', 'D', 'OFF', 'OFF', 'E', 'E', 'E^', 'E', 'OFF', 'OFF', 'OFF', 'OFF', 'D', 'D', 'D', 'D^', 'OFF', 'OFF', 'OFF'] },

  // 오태양 (NA-간호조무사, 1년차, 19일 근무): 주간/저녁 위주
  { id: 10, name: '오태양', position: 'NA', shifts: ['OFF', 'OFF', 'D', 'D', 'D', 'D', 'OFF', 'OFF', 'E', 'E', 'E^', 'E', 'OFF', 'OFF', 'OFF', 'D', 'D', 'D', 'D^', 'OFF', 'OFF', 'OFF', 'E', 'E', 'E', 'E', 'OFF', 'OFF', 'OFF', 'OFF'] },

  // 강민지 (NA-간호조무사, 2년차, 14일 근무): 저녁 위주, 불규칙
  { id: 11, name: '강민지', position: 'NA', shifts: ['OFF', 'OFF', 'E', 'E^', 'OFF', 'OFF', 'E', 'OFF', 'OFF', 'OFF', 'E', 'E', 'OFF', 'OFF', 'OFF', 'OFF', 'E', 'E^', 'OFF', 'OFF', 'E', 'OFF', 'OFF', 'OFF', 'E', 'E', 'OFF', 'OFF', 'OFF', 'OFF'] },

  // 배수아 (NA-간호조무사, 2년차, 15일 근무): 주간/저녁 혼합
  { id: 12, name: '배수아', position: 'NA', shifts: ['OFF', 'OFF', 'D', 'D', 'OFF', 'E', 'E', 'OFF', 'OFF', 'D', 'D', 'OFF', 'OFF', 'E', 'OFF', 'E', 'OFF', 'D', 'D', 'OFF', 'OFF', 'OFF', 'E', 'E', 'OFF', 'D', 'OFF', 'OFF', 'OFF', 'OFF'] },
];

type StatusFilter = 'all' | 'active' | 'on-leave' | 'manager' | 'part-time';
type ViewMode = 'generation' | 'schedule';
type PositionFilter = 'all' | 'HN' | 'SN' | 'CN' | 'RN' | 'NA'; // Config 직급 코드: HN(수석간호사), SN(전문간호사), CN(책임간호사), RN(정규간호사), NA(간호조무사)
type ShiftFilter = 'all' | 'D' | 'E' | 'N' | 'A' | 'OFF' | '연차';

export default function DemoPreviewSection() {
  const { t } = useTranslation('landing');
  const [viewMode, setViewMode] = useState<ViewMode>('generation');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all');

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
      filtered = filtered.filter(s => s.position === 'NA'); // 간호조무사(NA)를 파트타임으로 간주
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

  // 필터링된 스케줄 데이터
  const filteredSchedule = useMemo(() => {
    let filtered = mockScheduleData;

    // 직책 필터
    if (positionFilter !== 'all') {
      filtered = filtered.filter(s => s.position === positionFilter);
    }

    // 근무 타입 필터 (특정 근무 타입을 하나라도 포함하는 직원만 표시)
    if (shiftFilter !== 'all') {
      filtered = filtered.filter(s => s.shifts.includes(shiftFilter));
    }

    return filtered;
  }, [positionFilter, shiftFilter]);

  // 통계 계산
  const stats = {
    total: mockStaffData.length,
    active: mockStaffData.filter(s => s.status === 'active').length,
    onLeave: mockStaffData.filter(s => s.status === 'on_leave').length,
    managers: mockStaffData.filter(s => s.role === 'manager').length,
    partTime: mockStaffData.filter(s => s.position === 'NA').length, // 간호조무사(NA)를 파트타임으로 간주
  };

  // Config 직급 코드를 한글 라벨로 변환
  const getPositionLabel = (positionCode: string) => {
    switch (positionCode) {
      case 'HN': return '수석간호사';
      case 'SN': return '전문간호사';
      case 'CN': return '책임간호사';
      case 'RN': return '정규간호사';
      case 'NA': return '간호조무사';
      default: return positionCode;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'manager': return 'bg-[#DBEAFE] text-[#2563EB]';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getShiftBadgeStyle = (shift: string) => {
    // ^ 제거하여 실제 shift type 확인
    const cleanShift = shift.replace('^', '');

    switch (cleanShift) {
      case 'D': return '#3B82F6'; // Day - 주간 (blue-500)
      case 'E': return '#F59E0B'; // Evening - 저녁 (amber-500)
      case 'N': return '#6366F1'; // Night - 야간 (indigo-500)
      case 'A': return '#22C55E'; // Admin - 행정 (green-500)
      case 'OFF': return '#6B7280'; // Off - 휴무 (gray-500)
      case '연차': return '#A855F7'; // Annual Leave - 휴가 (purple-500)
      default: return '#64748B';
    }
  };

  // 2025년 11월 날짜 데이터 생성 (1일~30일)
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(2025, 10, i + 1); // 2025년 11월 (month는 0-based이므로 10)
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
            onClick={() => {
              setViewMode('generation');
              setCurrentStep(0);
            }}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              viewMode === 'generation'
                ? 'bg-[#2563EB] text-white shadow-lg'
                : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#2563EB] hover:text-[#2563EB]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span>{t('demoPreview.tabScheduleGeneration')}</span>
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
              <span>{t('demoPreview.tabCalendarView')}</span>
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
          {/* Schedule Generation View */}
          {viewMode === 'generation' && (
            <div className="p-8 sm:p-12">
              {/* 5-Step Generation Process */}
              <div className="space-y-6">
                {/* Step 1: Team Information */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-start gap-4 p-6 bg-gradient-to-r from-[#DBEAFE] to-white rounded-2xl border-2 border-[#2563EB]"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-[#2563EB] rounded-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-[#0F172A]">{t('demoPreview.generationStep1.title')}</h3>
                      <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <p className="text-sm text-[#64748B] mb-2">{t('demoPreview.generationStep1.description')}</p>
                    <p className="text-xs text-[#2563EB] font-medium">{t('demoPreview.generationStep1.detail')}</p>
                  </div>
                </motion.div>

                {/* Step 2: Work Rules */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-start gap-4 p-6 bg-gradient-to-r from-[#DBEAFE] to-white rounded-2xl border-2 border-[#2563EB]"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-[#2563EB] rounded-full flex items-center justify-center">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-[#0F172A]">{t('demoPreview.generationStep2.title')}</h3>
                      <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <p className="text-sm text-[#64748B] mb-2">{t('demoPreview.generationStep2.description')}</p>
                    <p className="text-xs text-[#2563EB] font-medium">{t('demoPreview.generationStep2.detail')}</p>
                  </div>
                </motion.div>

                {/* Step 3: AI Analysis */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-start gap-4 p-6 bg-gradient-to-r from-[#DBEAFE] to-white rounded-2xl border-2 border-[#2563EB]"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-[#2563EB] rounded-full flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-[#0F172A]">{t('demoPreview.generationStep3.title')}</h3>
                      <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <p className="text-sm text-[#64748B] mb-2">{t('demoPreview.generationStep3.description')}</p>
                    <p className="text-xs text-[#2563EB] font-medium">{t('demoPreview.generationStep3.detail')}</p>
                  </div>
                </motion.div>

                {/* Step 4: Optimal Assignment */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-start gap-4 p-6 bg-gradient-to-r from-[#DBEAFE] to-white rounded-2xl border-2 border-[#2563EB]"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-[#2563EB] rounded-full flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-[#0F172A]">{t('demoPreview.generationStep4.title')}</h3>
                      <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <p className="text-sm text-[#64748B] mb-2">{t('demoPreview.generationStep4.description')}</p>
                    <p className="text-xs text-[#2563EB] font-medium">{t('demoPreview.generationStep4.detail')}</p>
                  </div>
                </motion.div>

                {/* Step 5: Schedule Complete */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-start gap-4 p-6 bg-gradient-to-r from-[#DBEAFE] to-white rounded-2xl border-2 border-[#2563EB]"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-[#2563EB] rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-[#0F172A]">{t('demoPreview.generationStep5.title')}</h3>
                      <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <p className="text-sm text-[#64748B] mb-2">{t('demoPreview.generationStep5.description')}</p>
                    <p className="text-xs text-[#2563EB] font-medium">{t('demoPreview.generationStep5.detail')}</p>
                  </div>
                </motion.div>
              </div>

              {/* CTA Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-8 text-center"
              >
                <Link
                  href="/billing?plan=professional"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1D4ED8] transition-all shadow-lg hover:shadow-xl"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>{t('demoPreview.tryNow')}</span>
                </Link>
              </motion.div>
            </div>
          )}

          {/* Schedule View */}
          {viewMode === 'schedule' && (
            <div className="overflow-x-auto">
              {/* Schedule Header */}
              <div className="p-4 sm:p-6 border-b border-gray-100 bg-[#F8FAFC]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <h3 className="text-lg font-bold text-[#0F172A]">2025년 11월 근무표</h3>
                  <div className="flex gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: '#3B82F6' }}></span>
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
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: '#22C55E' }}></span>
                      <span className="text-[#64748B]">A (행정)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: '#6B7280' }}></span>
                      <span className="text-[#64748B]">OFF</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: '#A855F7' }}></span>
                      <span className="text-[#64748B]">연차</span>
                    </div>
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Position Filter - Config 직급 코드 사용 */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPositionFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        positionFilter === 'all'
                          ? 'bg-[#2563EB] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#2563EB]'
                      }`}
                    >
                      전체
                    </button>
                    <button
                      onClick={() => setPositionFilter('HN')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        positionFilter === 'HN'
                          ? 'bg-[#2563EB] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#2563EB]'
                      }`}
                    >
                      수석간호사
                    </button>
                    <button
                      onClick={() => setPositionFilter('SN')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        positionFilter === 'SN'
                          ? 'bg-[#2563EB] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#2563EB]'
                      }`}
                    >
                      전문간호사
                    </button>
                    <button
                      onClick={() => setPositionFilter('CN')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        positionFilter === 'CN'
                          ? 'bg-[#2563EB] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#2563EB]'
                      }`}
                    >
                      책임간호사
                    </button>
                    <button
                      onClick={() => setPositionFilter('RN')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        positionFilter === 'RN'
                          ? 'bg-[#2563EB] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#2563EB]'
                      }`}
                    >
                      정규간호사
                    </button>
                    <button
                      onClick={() => setPositionFilter('NA')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        positionFilter === 'NA'
                          ? 'bg-[#2563EB] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#2563EB]'
                      }`}
                    >
                      간호조무사
                    </button>
                  </div>

                  {/* Shift Type Filter */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShiftFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        shiftFilter === 'all'
                          ? 'bg-[#F97316] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#F97316]'
                      }`}
                    >
                      전체 근무
                    </button>
                    <button
                      onClick={() => setShiftFilter('D')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        shiftFilter === 'D'
                          ? 'bg-[#3B82F6] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#3B82F6]'
                      }`}
                    >
                      주간
                    </button>
                    <button
                      onClick={() => setShiftFilter('E')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        shiftFilter === 'E'
                          ? 'bg-[#F59E0B] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#F59E0B]'
                      }`}
                    >
                      저녁
                    </button>
                    <button
                      onClick={() => setShiftFilter('N')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        shiftFilter === 'N'
                          ? 'bg-[#6366F1] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#6366F1]'
                      }`}
                    >
                      야간
                    </button>
                    <button
                      onClick={() => setShiftFilter('A')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        shiftFilter === 'A'
                          ? 'bg-[#22C55E] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#22C55E]'
                      }`}
                    >
                      행정
                    </button>
                    <button
                      onClick={() => setShiftFilter('OFF')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        shiftFilter === 'OFF'
                          ? 'bg-[#6B7280] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#6B7280]'
                      }`}
                    >
                      휴무
                    </button>
                    <button
                      onClick={() => setShiftFilter('연차')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        shiftFilter === '연차'
                          ? 'bg-[#A855F7] text-white shadow-md'
                          : 'bg-white text-[#64748B] border border-gray-200 hover:border-[#A855F7]'
                      }`}
                    >
                      연차
                    </button>
                  </div>
                </div>
              </div>

              {/* Schedule Grid */}
              <div className="min-w-max">
                {/* Grid Header */}
                <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `120px repeat(30, 32px)` }}>
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
                {filteredSchedule.map((staff, staffIndex) => (
                  <motion.div
                    key={staff.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: staffIndex * 0.05 }}
                    viewport={{ once: true }}
                    className="grid border-b border-gray-100 hover:bg-gray-50"
                    style={{ gridTemplateColumns: `120px repeat(30, 32px)` }}
                  >
                    <div className="p-1.5 flex flex-col justify-center border-r border-gray-100">
                      <div className="text-xs font-medium text-gray-900 truncate">{staff.name}</div>
                      <div className="text-[10px] text-gray-500 truncate">{staff.position}</div>
                    </div>
                    {staff.shifts.map((shift, dayIndex) => {
                      const hasRequest = shift.includes('^');
                      const cleanShift = shift.replace('^', '');
                      return (
                        <div
                          key={dayIndex}
                          className="p-0.5 border-l border-gray-100 flex items-center justify-center"
                        >
                          <div
                            className="w-full px-1 py-1 rounded text-[10px] font-medium text-white text-center relative"
                            style={{ backgroundColor: getShiftBadgeStyle(shift) }}
                            title={
                              cleanShift === 'D' ? (hasRequest ? '주간 (요청)' : '주간') :
                              cleanShift === 'E' ? (hasRequest ? '저녁 (요청)' : '저녁') :
                              cleanShift === 'N' ? (hasRequest ? '야간 (요청)' : '야간') :
                              cleanShift === 'A' ? (hasRequest ? '행정 (요청)' : '행정') :
                              cleanShift === '연차' ? '연차' : '휴무'
                            }
                          >
                            {cleanShift}
                            {hasRequest && (
                              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-yellow-400 rounded-full border border-white"></span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                ))}

                {/* Empty State */}
                {filteredSchedule.length === 0 && (
                  <div className="p-12 text-center">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-[#64748B]">필터 조건에 맞는 직원이 없습니다</p>
                    <p className="text-sm text-gray-400 mt-1">다른 필터를 시도해보세요</p>
                  </div>
                )}
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
          {viewMode === 'generation' ? (
            <>
              <p className="text-[#64748B] mb-4">
                ✨ AI 기반 근무표 생성 프로세스 - 5단계로 공정하고 효율적인 근무표를 만듭니다
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 text-sm text-[#64748B]">
                  <span className="w-2 h-2 bg-[#2563EB] rounded-full"></span>
                  제약조건 자동 분석
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 text-sm text-[#64748B]">
                  <span className="w-2 h-2 bg-[#2563EB] rounded-full"></span>
                  공정성 평가
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 text-sm text-[#64748B]">
                  <span className="w-2 h-2 bg-[#2563EB] rounded-full"></span>
                  4초 생성 완료
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
