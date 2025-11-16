/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState } from 'react';

/**
 * 스케줄 페이지의 모든 모달 상태를 관리하는 커스텀 훅
 */
export function useScheduleModals() {
  // Import/Export
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf' | 'both' | null>(null);

  // Optimization
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Confirmation
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Report
  const [showReport, setShowReport] = useState(false);

  // Employee Preferences
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);

  // Manage Schedules
  const [showManageModal, setShowManageModal] = useState(false);

  return {
    // Import/Export
    showImportModal,
    setShowImportModal,
    showExportModal,
    setShowExportModal,
    isImporting,
    setIsImporting,
    isExporting,
    setIsExporting,
    importFile,
    setImportFile,
    exportFormat,
    setExportFormat,

    // Optimization
    isOptimizing,
    setIsOptimizing,

    // Confirmation
    showConfirmDialog,
    setShowConfirmDialog,
    isConfirming,
    setIsConfirming,

    // Report
    showReport,
    setShowReport,

    // Employee Preferences
    isPreferencesModalOpen,
    setIsPreferencesModalOpen,

    // Manage Schedules
    showManageModal,
    setShowManageModal,
  };
}
