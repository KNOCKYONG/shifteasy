'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Upload, FileText, CheckCircle, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/trpc/client';

interface ConsultingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  // Step 1: Basic Information
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  industry: string;
  teamSize: string;

  // Step 2: Schedule Information
  currentMethod: string;
  files: File[];

  // Step 3: Detailed Information
  painPoints: string;
  specialRequirements: string;
  additionalNotes: string;
}

const ACCEPTED_FILE_TYPES = '.xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total
const MIN_FILES = 3; // Minimum 3 months of schedules

/**
 * Convert File to base64 data URL
 */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload file to Cloudflare R2 via API endpoint
 */
async function uploadFileToR2(file: File): Promise<{
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}> {
  // Convert file to base64 data URL
  const dataUrl = await fileToDataURL(file);

  // Upload to R2 via API endpoint
  const response = await fetch('/api/upload-consulting-file', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dataUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload file');
  }

  return response.json();
}

/**
 * Upload multiple files to R2 in parallel
 */
async function uploadMultipleFilesToR2(files: File[]): Promise<Array<{
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}>> {
  const uploads = files.map(file => uploadFileToR2(file));
  return Promise.all(uploads);
}

export default function ConsultingRequestModal({ isOpen, onClose }: ConsultingRequestModalProps) {
  const { t } = useTranslation('consulting');
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);

  // tRPC mutation
  const submitRequest = api.consulting.submit.useMutation();

  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    industry: '',
    teamSize: '',
    currentMethod: '',
    files: [],
    painPoints: '',
    specialRequirements: '',
    additionalNotes: '',
  });

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles: File[] = [];
    let totalSize = formData.files.reduce((sum, file) => sum + file.size, 0);
    let error = '';

    for (const file of newFiles) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        error = t('errors.fileTooLarge', { name: file.name });
        continue;
      }

      // Check total size
      if (totalSize + file.size > MAX_TOTAL_SIZE) {
        error = t('errors.totalSizeTooLarge');
        break;
      }

      validFiles.push(file);
      totalSize += file.size;
    }

    if (validFiles.length > 0) {
      setFormData(prev => ({
        ...prev,
        files: [...prev.files, ...validFiles]
      }));
      setErrors(prev => ({ ...prev, files: '' }));
    }

    if (error) {
      setErrors(prev => ({ ...prev, files: error }));
    }
  }, [formData.files, t]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      addFiles(newFiles);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, [addFiles]);

  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.companyName.trim()) newErrors.companyName = t('errors.required');
      if (!formData.contactName.trim()) newErrors.contactName = t('errors.required');
      if (!formData.phone.trim()) newErrors.phone = t('errors.required');
      if (!formData.email.trim()) {
        newErrors.email = t('errors.required');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = t('errors.invalidEmail');
      }
      if (!formData.industry) newErrors.industry = t('errors.required');
      if (!formData.teamSize) newErrors.teamSize = t('errors.required');
    }

    if (step === 2) {
      if (!formData.currentMethod) newErrors.currentMethod = t('errors.required');
      if (formData.files.length < MIN_FILES) {
        newErrors.files = t('errors.minFiles', { count: MIN_FILES });
      }
    }

    if (step === 3) {
      if (!formData.painPoints.trim()) newErrors.painPoints = t('errors.required');
      if (!formData.specialRequirements.trim()) newErrors.specialRequirements = t('errors.required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);

    try {
      // Upload files to Cloudflare R2 and get public URLs
      const uploadedFiles = await uploadMultipleFilesToR2(formData.files);

      // Submit consulting request via tRPC
      await submitRequest.mutateAsync({
        companyName: formData.companyName,
        contactName: formData.contactName,
        phone: formData.phone,
        email: formData.email,
        industry: formData.industry as 'healthcare' | 'manufacturing' | 'service' | 'retail' | 'other',
        teamSize: formData.teamSize as '1-10' | '11-30' | '31-50' | '51+',
        currentMethod: formData.currentMethod as 'excel' | 'paper' | 'software' | 'other',
        files: uploadedFiles,
        painPoints: formData.painPoints,
        specialRequirements: formData.specialRequirements,
        additionalNotes: formData.additionalNotes || undefined,
      });

      setIsSuccess(true);

      // Reset form after 3 seconds
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (error) {
      console.error('Submission error:', error);
      setErrors({ submit: t('errors.submitFailed') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData({
      companyName: '',
      contactName: '',
      phone: '',
      email: '',
      industry: '',
      teamSize: '',
      currentMethod: '',
      files: [],
      painPoints: '',
      specialRequirements: '',
      additionalNotes: '',
    });
    setErrors({});
    setIsSuccess(false);
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl font-bold text-white">{t('title')}</h2>
            <button
              onClick={handleClose}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="relative h-2 bg-white/30 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className="absolute inset-y-0 left-0 bg-white rounded-full"
            />
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-between mt-3">
            {[1, 2, 3].map(step => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
                    step <= currentStep
                      ? 'bg-white text-blue-600'
                      : 'bg-white/30 text-white'
                  }`}
                >
                  {step}
                </div>
                <span className="ml-2 text-sm text-white font-medium">
                  {t(`steps.step${step}`)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] px-6 py-6">
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <CheckCircle className="w-20 h-20 text-green-500 mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('success.title')}</h3>
                <p className="text-gray-600 text-center">{t('success.message')}</p>
              </motion.div>
            ) : (
              <motion.div
                key={`step-${currentStep}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('fields.companyName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border ${
                          errors.companyName ? 'border-red-500' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all`}
                        placeholder={t('placeholders.companyName')}
                      />
                      {errors.companyName && (
                        <p className="mt-1 text-sm text-red-500">{errors.companyName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('fields.contactName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.contactName}
                        onChange={(e) => handleInputChange('contactName', e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border ${
                          errors.contactName ? 'border-red-500' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all`}
                        placeholder={t('placeholders.contactName')}
                      />
                      {errors.contactName && (
                        <p className="mt-1 text-sm text-red-500">{errors.contactName}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t('fields.phone')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className={`w-full px-4 py-3 rounded-lg border ${
                            errors.phone ? 'border-red-500' : 'border-gray-300'
                          } focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all`}
                          placeholder={t('placeholders.phone')}
                        />
                        {errors.phone && (
                          <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t('fields.email')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className={`w-full px-4 py-3 rounded-lg border ${
                            errors.email ? 'border-red-500' : 'border-gray-300'
                          } focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all`}
                          placeholder={t('placeholders.email')}
                        />
                        {errors.email && (
                          <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t('fields.industry')} <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.industry}
                          onChange={(e) => handleInputChange('industry', e.target.value)}
                          className={`w-full px-4 py-3 rounded-lg border ${
                            errors.industry ? 'border-red-500' : 'border-gray-300'
                          } focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all`}
                        >
                          <option value="">{t('placeholders.industry')}</option>
                          <option value="healthcare">{t('industries.healthcare')}</option>
                          <option value="manufacturing">{t('industries.manufacturing')}</option>
                          <option value="service">{t('industries.service')}</option>
                          <option value="retail">{t('industries.retail')}</option>
                          <option value="other">{t('industries.other')}</option>
                        </select>
                        {errors.industry && (
                          <p className="mt-1 text-sm text-red-500">{errors.industry}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t('fields.teamSize')} <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.teamSize}
                          onChange={(e) => handleInputChange('teamSize', e.target.value)}
                          className={`w-full px-4 py-3 rounded-lg border ${
                            errors.teamSize ? 'border-red-500' : 'border-gray-300'
                          } focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all`}
                        >
                          <option value="">{t('placeholders.teamSize')}</option>
                          <option value="1-10">{t('teamSizes.small')}</option>
                          <option value="11-30">{t('teamSizes.medium')}</option>
                          <option value="31-50">{t('teamSizes.large')}</option>
                          <option value="51+">{t('teamSizes.enterprise')}</option>
                        </select>
                        {errors.teamSize && (
                          <p className="mt-1 text-sm text-red-500">{errors.teamSize}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Schedule Information & File Upload */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('fields.currentMethod')} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.currentMethod}
                        onChange={(e) => handleInputChange('currentMethod', e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border ${
                          errors.currentMethod ? 'border-red-500' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all`}
                      >
                        <option value="">{t('placeholders.currentMethod')}</option>
                        <option value="excel">{t('methods.excel')}</option>
                        <option value="paper">{t('methods.paper')}</option>
                        <option value="software">{t('methods.software')}</option>
                        <option value="other">{t('methods.other')}</option>
                      </select>
                      {errors.currentMethod && (
                        <p className="mt-1 text-sm text-red-500">{errors.currentMethod}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('fields.files')} <span className="text-red-500">*</span>
                      </label>
                      <p className="text-sm text-gray-600 mb-3">
                        {t('fileUpload.description', { count: MIN_FILES })}
                      </p>

                      {/* Drag & Drop Area */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                          isDragging
                            ? 'border-blue-500 bg-blue-50'
                            : errors.files
                            ? 'border-red-300 bg-red-50'
                            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                      >
                        <input
                          type="file"
                          multiple
                          accept={ACCEPTED_FILE_TYPES}
                          onChange={handleFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-700 font-medium mb-2">
                          {t('fileUpload.dragDrop')}
                        </p>
                        <p className="text-sm text-gray-500">
                          {t('fileUpload.formats')}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {t('fileUpload.maxSize')}
                        </p>
                      </div>

                      {errors.files && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-red-500">
                          <AlertCircle className="w-4 h-4" />
                          {errors.files}
                        </div>
                      )}

                      {/* File List */}
                      {formData.files.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-sm font-semibold text-gray-700">
                            {t('fileUpload.uploaded', { count: formData.files.length })}
                          </p>
                          {formData.files.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-gray-100 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => removeFile(index)}
                                className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3: Detailed Information */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('fields.painPoints')} <span className="text-red-500">*</span>
                      </label>
                      <p className="text-sm text-gray-600 mb-2">{t('hints.painPoints')}</p>
                      <textarea
                        value={formData.painPoints}
                        onChange={(e) => handleInputChange('painPoints', e.target.value)}
                        rows={4}
                        className={`w-full px-4 py-3 rounded-lg border ${
                          errors.painPoints ? 'border-red-500' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none`}
                        placeholder={t('placeholders.painPoints')}
                      />
                      {errors.painPoints && (
                        <p className="mt-1 text-sm text-red-500">{errors.painPoints}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('fields.specialRequirements')} <span className="text-red-500">*</span>
                      </label>
                      <p className="text-sm text-gray-600 mb-2">{t('hints.specialRequirements')}</p>
                      <textarea
                        value={formData.specialRequirements}
                        onChange={(e) => handleInputChange('specialRequirements', e.target.value)}
                        rows={4}
                        className={`w-full px-4 py-3 rounded-lg border ${
                          errors.specialRequirements ? 'border-red-500' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none`}
                        placeholder={t('placeholders.specialRequirements')}
                      />
                      {errors.specialRequirements && (
                        <p className="mt-1 text-sm text-red-500">{errors.specialRequirements}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('fields.additionalNotes')}
                      </label>
                      <textarea
                        value={formData.additionalNotes}
                        onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                        placeholder={t('placeholders.additionalNotes')}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {!isSuccess && (
          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                disabled={currentStep === 1 || isSubmitting}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  currentStep === 1
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
                {t('buttons.back')}
              </button>

              <div className="flex items-center gap-3">
                {currentStep < totalSteps ? (
                  <button
                    onClick={handleNext}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('buttons.next')}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t('buttons.submitting')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        {t('buttons.submit')}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
