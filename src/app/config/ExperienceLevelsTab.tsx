"use client";
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, GraduationCap, TrendingUp } from 'lucide-react';

export interface ExperienceLevel {
  code: string;
  name: string;
  description: string;
  yearsMin: number;
  yearsMax: number | null;
  color: string;
  sortOrder: number;
}

interface ExperienceLevelsTabProps {
  experienceLevels: ExperienceLevel[];
  setExperienceLevels: React.Dispatch<React.SetStateAction<ExperienceLevel[]>>;
}

const colorOptions = [
  { value: '#10b981', label: '초록' },
  { value: '#3b82f6', label: '파랑' },
  { value: '#f59e0b', label: '주황' },
  { value: '#ef4444', label: '빨강' },
  { value: '#8b5cf6', label: '보라' },
  { value: '#ec4899', label: '분홍' },
];

export function ExperienceLevelsTab({ experienceLevels, setExperienceLevels }: ExperienceLevelsTabProps) {
  const [newLevel, setNewLevel] = useState<ExperienceLevel>({
    code: '',
    name: '',
    description: '',
    yearsMin: 0,
    yearsMax: null,
    color: '#3b82f6',
    sortOrder: experienceLevels.length,
  });
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newLevel.code || !newLevel.name) {
      alert('코드와 이름을 입력해주세요.');
      return;
    }

    if (experienceLevels.some(l => l.code === newLevel.code)) {
      alert('이미 존재하는 코드입니다.');
      return;
    }

    setExperienceLevels([...experienceLevels, { ...newLevel, sortOrder: experienceLevels.length }]);
    setNewLevel({
      code: '',
      name: '',
      description: '',
      yearsMin: 0,
      yearsMax: null,
      color: '#3b82f6',
      sortOrder: experienceLevels.length + 1,
    });
  };

  const handleUpdate = (code: string) => {
    const level = experienceLevels.find(l => l.code === code);
    if (!level) return;

    if (!level.name) {
      alert('이름을 입력해주세요.');
      return;
    }

    setExperienceLevels(experienceLevels.map(l =>
      l.code === code ? level : l
    ));
    setEditingCode(null);
  };

  const handleDelete = (code: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setExperienceLevels(experienceLevels.filter(l => l.code !== code));
  };

  const handleCancel = () => {
    setEditingCode(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">경력 단계 관리</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              직원들의 경력 단계를 정의하고 관리합니다. 근무 교환 시 팀 구성의 경력 균형을 분석하는 데 사용됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* Add New Level */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          새 경력 단계 추가
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              코드 (영문) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newLevel.code}
              onChange={(e) => setNewLevel({ ...newLevel, code: e.target.value.toUpperCase() })}
              placeholder="JUNIOR"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newLevel.name}
              onChange={(e) => setNewLevel({ ...newLevel, name: e.target.value })}
              placeholder="주니어"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              설명
            </label>
            <input
              type="text"
              value={newLevel.description}
              onChange={(e) => setNewLevel({ ...newLevel, description: e.target.value })}
              placeholder="1-3년 경력의 간호사"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              최소 연차 (년)
            </label>
            <input
              type="number"
              value={newLevel.yearsMin}
              onChange={(e) => setNewLevel({ ...newLevel, yearsMin: parseInt(e.target.value) || 0 })}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              최대 연차 (년) <span className="text-gray-500 text-xs">(비워두면 제한 없음)</span>
            </label>
            <input
              type="number"
              value={newLevel.yearsMax ?? ''}
              onChange={(e) => setNewLevel({ ...newLevel, yearsMax: e.target.value ? parseInt(e.target.value) : null })}
              min="0"
              placeholder="제한 없음"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              색상
            </label>
            <select
              value={newLevel.color}
              onChange={(e) => setNewLevel({ ...newLevel, color: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {colorOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            추가
          </button>
        </div>
      </div>

      {/* Levels List */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            등록된 경력 단계
          </h3>
        </div>
        {experienceLevels.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            등록된 경력 단계가 없습니다. 위에서 새로운 단계를 추가해주세요.
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {experienceLevels
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((level) => (
                <div key={level.code} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  {editingCode === level.code ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          코드
                        </label>
                        <input
                          type="text"
                          value={level.code}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          이름
                        </label>
                        <input
                          type="text"
                          value={level.name}
                          onChange={(e) => {
                            setExperienceLevels(experienceLevels.map(l =>
                              l.code === level.code ? { ...l, name: e.target.value } : l
                            ));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          설명
                        </label>
                        <input
                          type="text"
                          value={level.description}
                          onChange={(e) => {
                            setExperienceLevels(experienceLevels.map(l =>
                              l.code === level.code ? { ...l, description: e.target.value } : l
                            ));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          최소 연차
                        </label>
                        <input
                          type="number"
                          value={level.yearsMin}
                          onChange={(e) => {
                            setExperienceLevels(experienceLevels.map(l =>
                              l.code === level.code ? { ...l, yearsMin: parseInt(e.target.value) || 0 } : l
                            ));
                          }}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          최대 연차
                        </label>
                        <input
                          type="number"
                          value={level.yearsMax ?? ''}
                          onChange={(e) => {
                            setExperienceLevels(experienceLevels.map(l =>
                              l.code === level.code ? { ...l, yearsMax: e.target.value ? parseInt(e.target.value) : null } : l
                            ));
                          }}
                          min="0"
                          placeholder="제한 없음"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          색상
                        </label>
                        <select
                          value={level.color}
                          onChange={(e) => {
                            setExperienceLevels(experienceLevels.map(l =>
                              l.code === level.code ? { ...l, color: e.target.value } : l
                            ));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        >
                          {colorOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2 flex justify-end gap-2">
                        <button
                          onClick={handleCancel}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <X className="w-4 h-4" />
                          취소
                        </button>
                        <button
                          onClick={() => handleUpdate(level.code)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                          <Save className="w-4 h-4" />
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: level.color }}
                        >
                          {level.code}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{level.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{level.description}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            경력: {level.yearsMin}년 ~ {level.yearsMax ? `${level.yearsMax}년` : '제한없음'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingCode(level.code)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(level.code)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Usage Info */}
      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-400">
        <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">💡 활용 방법</p>
        <ul className="list-disc list-inside space-y-1">
          <li>팀 관리 화면에서 각 직원의 경력 단계를 설정할 수 있습니다.</li>
          <li>근무 교환 요청 미리보기에서 팀 구성의 경력 균형 변화를 확인할 수 있습니다.</li>
          <li>예: "시니어 간호사 2명 → 주니어 간호사만 4명" 등의 변화를 분석합니다.</li>
        </ul>
      </div>
    </div>
  );
}
