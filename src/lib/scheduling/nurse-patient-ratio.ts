/**
 * Nurse-to-Patient Ratio Calculator
 * 간호사 대 환자 비율 계산기
 */

import { z } from 'zod';
import type { UnitType } from './nurse-constraints';

// ==========================================
// Types and Interfaces
// ==========================================

export interface PatientAcuity {
  level: 1 | 2 | 3 | 4 | 5; // 1=lowest, 5=highest acuity
  description: string;
  nursingHoursRequired: number; // 환자당 필요 간호시간
}

export interface UnitCensus {
  unitType: UnitType;
  totalBeds: number;
  occupiedBeds: number;
  patients: {
    id: string;
    acuityLevel: number;
    specialNeeds?: string[];
  }[];
}

export interface NurseStaffing {
  nurseId: string;
  skillLevel: 'junior' | 'intermediate' | 'senior' | 'expert';
  certifications: string[];
  maxPatientCapacity: number;
  currentAssignments: string[]; // patient IDs
  floatPool: boolean;
}

export interface RatioCalculation {
  unit: UnitType;
  shift: 'D' | 'E' | 'N';
  date: Date;
  requiredNurses: number;
  availableNurses: number;
  actualRatio: string; // e.g., "1:4.5"
  targetRatio: string; // e.g., "1:4"
  isCompliant: boolean;
  gap: number; // negative = understaffed, positive = overstaffed
  adjustmentNeeded: string;
}

// ==========================================
// Standard Ratios by Unit Type
// ==========================================

export const STANDARD_RATIOS: Record<UnitType, Record<'D' | 'E' | 'N', string>> = {
  ICU: {
    D: '1:2',  // 1 nurse to 2 patients (day)
    E: '1:2',  // 1 nurse to 2 patients (evening)
    N: '1:2',  // 1 nurse to 2 patients (night)
  },
  ER: {
    D: '1:4',
    E: '1:4',
    N: '1:5',
  },
  OR: {
    D: '1:1',  // 1:1 during surgery
    E: '1:1',
    N: '1:1',
  },
  PACU: {
    D: '1:2',
    E: '1:2',
    N: '1:3',
  },
  GENERAL: {
    D: '1:5',
    E: '1:6',
    N: '1:7',
  },
  PEDIATRIC: {
    D: '1:4',
    E: '1:4',
    N: '1:5',
  },
  MATERNITY: {
    D: '1:4',  // Mother-baby pairs
    E: '1:5',
    N: '1:6',
  },
};

// ==========================================
// Acuity-Adjusted Ratios
// ==========================================

export const ACUITY_MULTIPLIERS: Record<number, number> = {
  1: 0.6,  // Low acuity - can handle more patients
  2: 0.8,
  3: 1.0,  // Normal acuity - standard ratio
  4: 1.3,
  5: 1.8,  // High acuity - needs more nursing time
};

// ==========================================
// Nurse Patient Ratio Calculator Class
// ==========================================

export class NursePatientRatioCalculator {
  /**
   * Calculate the required number of nurses for a unit
   */
  calculateRequiredNurses(
    census: UnitCensus,
    shift: 'D' | 'E' | 'N',
    useAcuityAdjustment: boolean = true
  ): number {
    const standardRatio = this.parseRatio(STANDARD_RATIOS[census.unitType][shift]);
    
    if (!useAcuityAdjustment) {
      return Math.ceil(census.occupiedBeds / standardRatio.patientsPerNurse);
    }

    // Calculate weighted patient load based on acuity
    let weightedPatientLoad = 0;
    census.patients.forEach(patient => {
      const multiplier = ACUITY_MULTIPLIERS[patient.acuityLevel] || 1.0;
      weightedPatientLoad += multiplier;
    });

    // Adjust based on unit-specific factors
    const unitAdjustmentFactor = this.getUnitAdjustmentFactor(census.unitType, shift);
    weightedPatientLoad *= unitAdjustmentFactor;

    return Math.ceil(weightedPatientLoad / standardRatio.patientsPerNurse);
  }

  /**
   * Parse ratio string (e.g., "1:4") into numeric values
   */
  parseRatio(ratioString: string): { nursesPerPatient: number; patientsPerNurse: number } {
    const [nurses, patients] = ratioString.split(':').map(Number);
    return {
      nursesPerPatient: nurses / patients,
      patientsPerNurse: patients / nurses,
    };
  }

  /**
   * Format ratio as string
   */
  formatRatio(nurses: number, patients: number): string {
    if (nurses === 0) return '0:0';
    const gcd = this.calculateGCD(nurses, patients);
    return `${nurses / gcd}:${patients / gcd}`;
  }

  /**
   * Calculate greatest common divisor
   */
  private calculateGCD(a: number, b: number): number {
    return b === 0 ? a : this.calculateGCD(b, a % b);
  }

  /**
   * Get unit-specific adjustment factor
   */
  private getUnitAdjustmentFactor(unitType: UnitType, shift: 'D' | 'E' | 'N'): number {
    // Night shift generally needs fewer nurses due to lower activity
    const nightShiftReduction = shift === 'N' ? 0.9 : 1.0;
    
    // Unit-specific factors
    const unitFactors: Record<UnitType, number> = {
      ICU: 1.2,      // Higher complexity
      ER: 1.15,      // Unpredictable workload
      OR: 1.0,       // Predictable, scheduled
      PACU: 1.1,     // Post-op monitoring
      GENERAL: 1.0,  // Standard
      PEDIATRIC: 1.1, // Special care needs
      MATERNITY: 1.05, // Mother-baby care
    };

    return (unitFactors[unitType] || 1.0) * nightShiftReduction;
  }

  /**
   * Validate staffing compliance
   */
  validateStaffingCompliance(
    census: UnitCensus,
    staffing: NurseStaffing[],
    shift: 'D' | 'E' | 'N'
  ): RatioCalculation {
    const requiredNurses = this.calculateRequiredNurses(census, shift, true);
    const availableNurses = staffing.filter(n => n.currentAssignments.length > 0).length;
    const targetRatio = STANDARD_RATIOS[census.unitType][shift];
    const actualRatio = availableNurses > 0 
      ? this.formatRatio(1, Math.round(census.occupiedBeds / availableNurses))
      : '0:0';

    const gap = availableNurses - requiredNurses;
    const isCompliant = gap >= 0;

    let adjustmentNeeded = '';
    if (gap < 0) {
      adjustmentNeeded = `Need ${Math.abs(gap)} more nurse(s)`;
    } else if (gap > 2) {
      adjustmentNeeded = `Can reduce by ${gap - 1} nurse(s)`;
    } else {
      adjustmentNeeded = 'Optimal staffing';
    }

    return {
      unit: census.unitType,
      shift,
      date: new Date(),
      requiredNurses,
      availableNurses,
      actualRatio,
      targetRatio,
      isCompliant,
      gap,
      adjustmentNeeded,
    };
  }

  /**
   * Calculate optimal nurse assignments
   */
  calculateOptimalAssignments(
    census: UnitCensus,
    nurses: NurseStaffing[]
  ): Map<string, string[]> {
    const assignments = new Map<string, string[]>();
    const sortedPatients = [...census.patients].sort((a, b) => b.acuityLevel - a.acuityLevel);
    const sortedNurses = [...nurses].sort((a, b) => {
      const skillOrder = { expert: 4, senior: 3, intermediate: 2, junior: 1 };
      return skillOrder[b.skillLevel] - skillOrder[a.skillLevel];
    });

    // Assign high-acuity patients to more experienced nurses
    let nurseIndex = 0;
    sortedPatients.forEach(patient => {
      const nurse = sortedNurses[nurseIndex % sortedNurses.length];
      if (!assignments.has(nurse.nurseId)) {
        assignments.set(nurse.nurseId, []);
      }
      
      const currentLoad = assignments.get(nurse.nurseId)!;
      if (currentLoad.length < nurse.maxPatientCapacity) {
        currentLoad.push(patient.id);
      } else {
        // Move to next nurse if current is at capacity
        nurseIndex++;
        if (nurseIndex < sortedNurses.length) {
          const nextNurse = sortedNurses[nurseIndex];
          if (!assignments.has(nextNurse.nurseId)) {
            assignments.set(nextNurse.nurseId, []);
          }
          assignments.get(nextNurse.nurseId)!.push(patient.id);
        }
      }
    });

    return assignments;
  }

  /**
   * Calculate float pool requirements
   */
  calculateFloatPoolNeeds(
    units: UnitCensus[],
    shift: 'D' | 'E' | 'N'
  ): {
    totalFloatNeeded: number;
    byUnit: Map<UnitType, number>;
    priority: UnitType[];
  } {
    const floatNeeds = new Map<UnitType, number>();
    const priorities: { unit: UnitType; gap: number }[] = [];
    let totalNeeded = 0;

    units.forEach(unit => {
      const required = this.calculateRequiredNurses(unit, shift, true);
      // Assume current staffing is at 80% for calculation
      const current = Math.floor(required * 0.8);
      const gap = required - current;
      
      if (gap > 0) {
        floatNeeds.set(unit.unitType, gap);
        totalNeeded += gap;
        priorities.push({ unit: unit.unitType, gap });
      }
    });

    // Sort by gap size (highest need first)
    priorities.sort((a, b) => b.gap - a.gap);

    return {
      totalFloatNeeded: totalNeeded,
      byUnit: floatNeeds,
      priority: priorities.map(p => p.unit),
    };
  }

  /**
   * Predict staffing needs based on historical data
   */
  predictStaffingNeeds(
    historicalCensus: UnitCensus[],
    targetDate: Date,
    unitType: UnitType
  ): {
    predicted: number;
    confidence: number;
    factors: string[];
  } {
    // Simple prediction based on day of week and seasonal patterns
    const dayOfWeek = targetDate.getDay();
    const month = targetDate.getMonth();
    
    // Base prediction on historical average
    const avgOccupancy = historicalCensus.reduce((sum, c) => sum + c.occupiedBeds, 0) / historicalCensus.length;
    
    // Adjust for day of week (weekends typically lower census)
    const dayAdjustment = [0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 0.9][dayOfWeek];
    
    // Adjust for seasonal patterns (flu season, etc.)
    const seasonalAdjustment = [1.1, 1.1, 1.0, 0.95, 0.9, 0.9, 0.95, 1.0, 1.0, 1.05, 1.1, 1.15][month];
    
    const predicted = Math.ceil(avgOccupancy * dayAdjustment * seasonalAdjustment);
    const confidence = historicalCensus.length >= 30 ? 0.85 : 0.65;
    
    const factors = [];
    if (dayOfWeek === 0 || dayOfWeek === 6) factors.push('Weekend adjustment');
    if (month >= 10 || month <= 1) factors.push('Winter/flu season adjustment');
    
    return { predicted, confidence, factors };
  }
}

// ==========================================
// Validation Schemas
// ==========================================

export const PatientAcuitySchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  description: z.string(),
  nursingHoursRequired: z.number().positive(),
});

export const UnitCensusSchema = z.object({
  unitType: z.enum(['ICU', 'ER', 'OR', 'PACU', 'GENERAL', 'PEDIATRIC', 'MATERNITY']),
  totalBeds: z.number().int().positive(),
  occupiedBeds: z.number().int().min(0),
  patients: z.array(z.object({
    id: z.string(),
    acuityLevel: z.number().int().min(1).max(5),
    specialNeeds: z.array(z.string()).optional(),
  })),
});

export const NurseStaffingSchema = z.object({
  nurseId: z.string(),
  skillLevel: z.enum(['junior', 'intermediate', 'senior', 'expert']),
  certifications: z.array(z.string()),
  maxPatientCapacity: z.number().int().positive(),
  currentAssignments: z.array(z.string()),
  floatPool: z.boolean(),
});

// ==========================================
// Export singleton instance
// ==========================================

export const ratioCalculator = new NursePatientRatioCalculator();