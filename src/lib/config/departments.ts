/**
 * Utility functions for loading and managing custom departments
 */

export interface ConfigurableDepartment {
  id: string;
  name: string;
  code: string;
  requiresSpecialSkills: boolean;
}

const DEFAULT_DEPARTMENTS: ConfigurableDepartment[] = [
  { id: 'dept-er', name: '응급실', code: 'ER', requiresSpecialSkills: true },
  { id: 'dept-icu', name: '중환자실', code: 'ICU', requiresSpecialSkills: true },
  { id: 'dept-or', name: '수술실', code: 'OR', requiresSpecialSkills: true },
  { id: 'dept-ward', name: '일반병동', code: 'WARD', requiresSpecialSkills: false },
];

/**
 * Load custom departments from localStorage
 */
export function loadDepartments(): ConfigurableDepartment[] {
  if (typeof window === 'undefined') return DEFAULT_DEPARTMENTS;

  try {
    const saved = localStorage.getItem('customDepartments');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading departments:', error);
  }

  return DEFAULT_DEPARTMENTS;
}

/**
 * Get department by ID
 */
export function getDepartment(id: string): ConfigurableDepartment | undefined {
  const departments = loadDepartments();
  return departments.find(d => d.id === id);
}

/**
 * Get department by code
 */
export function getDepartmentByCode(code: string): ConfigurableDepartment | undefined {
  const departments = loadDepartments();
  return departments.find(d => d.code === code);
}

/**
 * Save departments to localStorage
 */
export function saveDepartments(departments: ConfigurableDepartment[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('customDepartments', JSON.stringify(departments));
  }
}

/**
 * Get formatted department options for UI components
 */
export function getDepartmentOptions() {
  const departments = loadDepartments();
  return departments.map(dept => ({
    value: dept.id,
    label: dept.name,
    code: dept.code,
    requiresSpecialSkills: dept.requiresSpecialSkills,
  }));
}