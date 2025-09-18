/**
 * Utility functions for loading and managing contract types
 */

export interface ConfigurableContractType {
  code: string;
  name: string;
  description: string;
  maxHoursPerWeek?: number;
  minHoursPerWeek?: number;
  isPrimary: boolean;
}

const DEFAULT_CONTRACT_TYPES: ConfigurableContractType[] = [
  { code: 'FT', name: '정규직', description: '정규 고용 계약', isPrimary: true },
  { code: 'PT', name: '파트타임', description: '시간제 계약', maxHoursPerWeek: 30, isPrimary: false },
  { code: 'CT', name: '계약직', description: '기간 계약직', isPrimary: false },
  { code: 'IN', name: '인턴', description: '인턴십 프로그램', maxHoursPerWeek: 40, isPrimary: false },
];

/**
 * Load custom contract types from localStorage
 */
export function loadContractTypes(): ConfigurableContractType[] {
  if (typeof window === 'undefined') return DEFAULT_CONTRACT_TYPES;

  try {
    const saved = localStorage.getItem('customContractTypes');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading contract types:', error);
  }

  return DEFAULT_CONTRACT_TYPES;
}

/**
 * Get contract type by code
 */
export function getContractType(code: string): ConfigurableContractType | undefined {
  const contractTypes = loadContractTypes();
  return contractTypes.find(c => c.code === code);
}

/**
 * Save contract types to localStorage
 */
export function saveContractTypes(contractTypes: ConfigurableContractType[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('customContractTypes', JSON.stringify(contractTypes));
  }
}

/**
 * Get formatted contract type options for UI components
 */
export function getContractTypeOptions() {
  const contractTypes = loadContractTypes();
  return contractTypes.map(contract => ({
    value: contract.code,
    label: contract.name,
    description: contract.description,
    maxHoursPerWeek: contract.maxHoursPerWeek,
    minHoursPerWeek: contract.minHoursPerWeek,
    isPrimary: contract.isPrimary,
  }));
}