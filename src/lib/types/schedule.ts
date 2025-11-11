/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Schedule-related type definitions
 */

import type { ShiftType } from '../types';

/**
 * Schedule generation configuration
 */
export interface ScheduleConfig {
  maxConsecutiveDays: number;
  minRestHours: number;
  maxWeeklyHours: number;
  minStaffPerShift: Record<ShiftType, number>;
  fairnessWeight: number;
  preferenceWeight: number;
}

/**
 * Schedule generation request
 */
export interface ScheduleGenerationRequest {
  startDate: string;
  endDate?: string;
  teamData: {
    wardId: string;
    staff: any[]; // Staff array from team data
  };
  config: ScheduleConfig;
}

/**
 * Schedule generation response
 */
export interface ScheduleGenerationResponse {
  schedule: Record<string, Record<string, ShiftType>>;
  metrics: ScheduleMetrics;
  warnings?: string[];
  errors?: string[];
}

/**
 * Schedule metrics
 */
export interface ScheduleMetrics {
  processingTime: number;
  coverageRate: number;
  distributionBalance: number;
  constraintViolations: number;
  preferenceScore: number;
  fairnessScore: number;
  totalShifts: number;
  unassignedShifts: number;
}

/**
 * Shift swap request
 */
export interface ShiftSwapRequest {
  id: string;
  fromStaffId: string;
  toStaffId: string;
  date: string;
  shift: ShiftType;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  rejectedReason?: string;
}

/**
 * Schedule validation result
 */
export interface ScheduleValidationResult {
  valid: boolean;
  errors: ScheduleValidationError[];
  warnings: ScheduleValidationWarning[];
}

/**
 * Schedule validation error
 */
export interface ScheduleValidationError {
  type: 'constraint_violation' | 'missing_coverage' | 'overtime' | 'conflict';
  staffId?: string;
  date?: string;
  shift?: ShiftType;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Schedule validation warning
 */
export interface ScheduleValidationWarning {
  type: 'suboptimal' | 'preference_ignored' | 'imbalance';
  staffId?: string;
  date?: string;
  message: string;
}

/**
 * Schedule statistics
 */
export interface ScheduleStatistics {
  totalShifts: number;
  shiftDistribution: Record<ShiftType, number>;
  staffHours: Record<string, number>;
  weekendCoverage: number;
  nightShiftDistribution: Record<string, number>;
  overtimeHours: number;
  understaffedShifts: number;
}