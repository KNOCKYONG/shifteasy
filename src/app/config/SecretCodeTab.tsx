"use client";

import { useState, useEffect } from "react";
import { Key, Copy, RefreshCw, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Department {
  id: string;
  name: string;
  code?: string;
  secretCode?: string;
}

interface SecretCodeTabProps {
  currentUserRole: string;
}

export function SecretCodeTab({ currentUserRole }: SecretCodeTabProps) {
  const { t } = useTranslation(['config', 'common']);
  const [myDepartment, setMyDepartment] = useState<Department | null>(null);
  const [showSecretCode, setShowSecretCode] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch department secret code
    if (currentUserRole === 'manager' || currentUserRole === 'admin' || currentUserRole === 'owner') {
      fetchDepartmentSecret();
    }
  }, [currentUserRole]);

  const fetchDepartmentSecret = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/departments/my-secret');
      const data = await response.json();

      console.log('Fetch department secret response:', { status: response.status, data });

      if (response.ok && data.department) {
        setMyDepartment(data.department);
      } else {
        console.error('Failed to fetch department secret:', data);
      }
    } catch (error) {
      console.error('Error fetching department secret:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!confirm(t('secretCode.confirmRegenerate', { ns: 'config', defaultValue: '시크릿 코드를 재생성하시겠습니까? 기존 코드는 더 이상 사용할 수 없습니다.' }))) {
      return;
    }

    setIsRegenerating(true);
    try {
      const response = await fetch('/api/departments/my-secret/regenerate', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.department) {
        setMyDepartment(data.department);
        alert(t('secretCode.regenerateSuccess', { ns: 'config', defaultValue: '시크릿 코드가 재생성되었습니다.' }));
      } else {
        alert(t('secretCode.regenerateError', { ns: 'config', defaultValue: '시크릿 코드 재생성에 실패했습니다.' }));
      }
    } catch (error) {
      console.error('Error regenerating secret:', error);
      alert(t('secretCode.regenerateError', { ns: 'config', defaultValue: '시크릿 코드 재생성에 실패했습니다.' }));
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (!myDepartment) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-900 dark:text-amber-300 font-medium">
              {t('secretCode.noDepartment', { ns: 'config', defaultValue: '부서가 배정되지 않았습니다' })}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              {t('secretCode.noDepartmentDesc', { ns: 'config', defaultValue: '관리자에게 문의하여 부서를 배정받으세요.' })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
        <Key className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-900 dark:text-blue-300 font-medium">
            {t('secretCode.title', { ns: 'config', defaultValue: '부서 시크릿 코드' })}
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
            {t('secretCode.description', { ns: 'config', defaultValue: '새로운 팀원이 가입할 때 이 코드를 공유하세요. 코드를 입력한 사용자는 자동으로 이 부서에 배정됩니다.' })}
          </p>
        </div>
      </div>

      {/* Department Info & Secret Code */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{myDepartment.name}</h3>
          {myDepartment.code && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('secretCode.departmentCode', { ns: 'config', defaultValue: '부서 코드' })}: {myDepartment.code}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('secretCode.secretCode', { ns: 'config', defaultValue: '시크릿 코드' })}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="font-mono text-lg text-gray-900 dark:text-gray-100 flex-1">
                  {showSecretCode || !myDepartment.secretCode ? (
                    myDepartment.secretCode || t('secretCode.noCode', { ns: 'config', defaultValue: '코드 없음' })
                  ) : (
                    '••••••••'
                  )}
                </span>
              </div>

              <button
                onClick={() => setShowSecretCode(!showSecretCode)}
                className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
                title={showSecretCode ? t('secretCode.hide', { ns: 'config', defaultValue: '숨기기' }) : t('secretCode.show', { ns: 'config', defaultValue: '보기' })}
              >
                {showSecretCode ? (
                  <EyeOff className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>

              {myDepartment.secretCode && (
                <button
                  onClick={() => handleCopyCode(myDepartment.secretCode!)}
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
                  title={t('secretCode.copy', { ns: 'config', defaultValue: '복사' })}
                >
                  <Copy
                    className={`w-5 h-5 ${
                      copiedCode === myDepartment.secretCode
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  />
                </button>
              )}
            </div>
            {copiedCode === myDepartment.secretCode && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {t('secretCode.copied', { ns: 'config', defaultValue: '클립보드에 복사되었습니다' })}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleRegenerateSecret}
              disabled={isRegenerating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating
                ? t('secretCode.regenerating', { ns: 'config', defaultValue: '생성 중...' })
                : t('secretCode.regenerate', { ns: 'config', defaultValue: '새 코드 생성' })
              }
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {t('secretCode.regenerateNote', { ns: 'config', defaultValue: '새 코드를 생성하면 기존 코드는 더 이상 사용할 수 없습니다.' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
