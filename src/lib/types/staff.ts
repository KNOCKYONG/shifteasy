/**
 * Staff-related type definitions
 */

import type { Role } from '../types';

/**
 * Staff skill assessment
 */
export interface StaffSkills {
  technicalSkill: number; // 1-5
  leadership: number; // 1-5
  communication: number; // 1-5
  adaptability: number; // 1-5
  reliability: number; // 1-5
}

/**
 * Staff availability
 */
export interface StaffAvailability {
  date: string;
  available: boolean;
  preferredShift?: string;
  avoidShift?: string;
  notes?: string;
}

/**
 * Staff preference
 */
export interface StaffPreference {
  shiftPreferences: {
    day: number; // -5 to 5
    evening: number; // -5 to 5
    night: number; // -5 to 5
  };
  weekendPreference: number; // -5 to 5
  maxConsecutiveDays?: number;
  preferredTeammates?: string[];
  avoidTeammates?: string[];
}

/**
 * Staff certification
 */
export interface StaffCertification {
  id: string;
  name: string;
  issueDate: string;
  expiryDate?: string;
  issuingOrganization: string;
  verified: boolean;
}

/**
 * Staff training record
 */
export interface StaffTraining {
  id: string;
  name: string;
  completedDate: string;
  hours: number;
  type: 'mandatory' | 'optional' | 'certification';
  status: 'completed' | 'in_progress' | 'scheduled';
}

/**
 * Staff performance review
 */
export interface StaffPerformance {
  reviewDate: string;
  reviewerId: string;
  overallRating: number; // 1-5
  skills: StaffSkills;
  strengths: string[];
  areasForImprovement: string[];
  goals: string[];
  comments?: string;
}

/**
 * Staff statistics
 */
export interface StaffStatistics {
  totalHoursWorked: number;
  averageHoursPerWeek: number;
  overtimeHours: number;
  sickDays: number;
  vacationDays: number;
  shiftDistribution: {
    day: number;
    evening: number;
    night: number;
    off: number;
  };
  attendanceRate: number;
  performanceScore: number;
}

/**
 * Team composition analysis
 */
export interface TeamComposition {
  totalStaff: number;
  roleDistribution: Record<Role, number>;
  experienceDistribution: {
    junior: number;
    intermediate: number;
    senior: number;
    expert: number;
  };
  averageSkillLevel: number;
  balanceScore: number;
  recommendations: string[];
}

/**
 * Staff filter options
 */
export interface StaffFilterOptions {
  roles?: Role[];
  minSkillLevel?: number;
  maxSkillLevel?: number;
  active?: boolean;
  wardId?: string;
  searchTerm?: string;
  sortBy?: 'name' | 'role' | 'experience' | 'skill';
  sortOrder?: 'asc' | 'desc';
}