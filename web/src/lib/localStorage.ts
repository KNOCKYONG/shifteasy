/**
 * Local Storage Data Management for Shifteasy MVP
 * Provides database-like operations using localStorage for testing
 */

import { testWards, testStaff, testPreferences, testRequests, testSchedules, testShifts } from './testdata'
import type { 
  Ward, Staff, Preference, Request, Schedule, Shift, Assignment,
  RequestType, RequestStatus, RequestPriority, ShiftType
} from './types'

const STORAGE_KEYS = {
  wards: 'shifteasy_wards',
  staff: 'shifteasy_staff',
  preferences: 'shifteasy_preferences',
  requests: 'shifteasy_requests',
  schedules: 'shifteasy_schedules',
  assignments: 'shifteasy_assignments',
  shifts: 'shifteasy_shifts'
}

// Initialize localStorage with test data if empty
function initializeStorage() {
  if (!localStorage.getItem(STORAGE_KEYS.wards)) {
    localStorage.setItem(STORAGE_KEYS.wards, JSON.stringify(testWards))
  }
  if (!localStorage.getItem(STORAGE_KEYS.staff)) {
    localStorage.setItem(STORAGE_KEYS.staff, JSON.stringify(testStaff))
  }
  if (!localStorage.getItem(STORAGE_KEYS.preferences)) {
    localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(testPreferences))
  }
  if (!localStorage.getItem(STORAGE_KEYS.requests)) {
    localStorage.setItem(STORAGE_KEYS.requests, JSON.stringify(testRequests))
  }
  if (!localStorage.getItem(STORAGE_KEYS.schedules)) {
    localStorage.setItem(STORAGE_KEYS.schedules, JSON.stringify(testSchedules))
  }
  if (!localStorage.getItem(STORAGE_KEYS.assignments)) {
    localStorage.setItem(STORAGE_KEYS.assignments, JSON.stringify([]))
  }
  if (!localStorage.getItem(STORAGE_KEYS.shifts)) {
    localStorage.setItem(STORAGE_KEYS.shifts, JSON.stringify(testShifts))
  }
}

// Generic storage functions
function getFromStorage<T>(key: string): T[] {
  const data = localStorage.getItem(key)
  return data ? JSON.parse(data) : []
}

function saveToStorage<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data))
}

function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Ward operations
export const wardService = {
  findMany: (filter?: { id?: string }): Ward[] => {
    initializeStorage()
    const wards = getFromStorage<Ward>(STORAGE_KEYS.wards)
    if (filter?.id) {
      return wards.filter(ward => ward.id === filter.id)
    }
    return wards
  },

  findUnique: (where: { id: string }): Ward | null => {
    initializeStorage()
    const wards = getFromStorage<Ward>(STORAGE_KEYS.wards)
    return wards.find(ward => ward.id === where.id) || null
  }
}

// Staff operations
export const staffService = {
  findMany: (filter?: { wardId?: string, active?: boolean }): Staff[] => {
    initializeStorage()
    const staff = getFromStorage<Staff>(STORAGE_KEYS.staff)
    let result = staff
    
    if (filter?.wardId) {
      result = result.filter(s => s.wardId === filter.wardId)
    }
    if (filter?.active !== undefined) {
      result = result.filter(s => s.active === filter.active)
    }
    
    return result
  },

  findFirst: (where: { id?: string, wardId?: string, active?: boolean }): Staff | null => {
    initializeStorage()
    const staff = getFromStorage<Staff>(STORAGE_KEYS.staff)
    return staff.find(s => {
      if (where.id && s.id !== where.id) return false
      if (where.wardId && s.wardId !== where.wardId) return false
      if (where.active !== undefined && s.active !== where.active) return false
      return true
    }) || null
  }
}

// Preference operations
export const preferenceService = {
  findMany: (filter?: { staffId?: string, wardId?: string, dateRange?: { gte: Date, lte: Date } }): Preference[] => {
    initializeStorage()
    const preferences = getFromStorage<Preference>(STORAGE_KEYS.preferences)
    let result = preferences
    
    if (filter?.staffId) {
      result = result.filter(p => p.staffId === filter.staffId)
    }
    if (filter?.wardId) {
      const wardStaff = staffService.findMany({ wardId: filter.wardId }).staff
      const wardStaffIds = wardStaff.map(s => s.id)
      result = result.filter(p => wardStaffIds.includes(p.staffId))
    }
    if (filter?.dateRange) {
      result = result.filter(p => {
        const prefDate = new Date(p.date)
        return prefDate >= filter.dateRange!.gte && prefDate <= filter.dateRange!.lte
      })
    }
    
    return result
  },

  create: (data: Omit<Preference, 'id' | 'createdAt' | 'updatedAt'>): Preference => {
    initializeStorage()
    const preferences = getFromStorage<Preference>(STORAGE_KEYS.preferences)
    const newPreference: Preference = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    preferences.push(newPreference)
    saveToStorage(STORAGE_KEYS.preferences, preferences)
    return newPreference
  }
}

// Request operations
export const requestService = {
  findMany: (filter?: {
    wardId?: string,
    staffId?: string,
    status?: RequestStatus,
    type?: RequestType,
    startDate?: { gte?: Date, lte?: Date },
    limit?: number,
    offset?: number
  }): { requests: Request[], totalCount: number } => {
    initializeStorage()
    let requests = getFromStorage<Request>(STORAGE_KEYS.requests)
    
    // Apply filters
    if (filter?.wardId) {
      requests = requests.filter(r => r.wardId === filter.wardId)
    }
    if (filter?.staffId) {
      requests = requests.filter(r => r.staffId === filter.staffId)
    }
    if (filter?.status) {
      requests = requests.filter(r => r.status === filter.status)
    }
    if (filter?.type) {
      requests = requests.filter(r => r.type === filter.type)
    }
    if (filter?.startDate) {
      requests = requests.filter(r => {
        const reqDate = new Date(r.startDate)
        if (filter.startDate?.gte && reqDate < filter.startDate.gte) return false
        if (filter.startDate?.lte && reqDate > filter.startDate.lte) return false
        return true
      })
    }
    
    // Sort by priority and created date
    requests.sort((a, b) => {
      const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    
    const totalCount = requests.length
    
    // Apply pagination
    if (filter?.offset) {
      requests = requests.slice(filter.offset)
    }
    if (filter?.limit) {
      requests = requests.slice(0, filter.limit)
    }
    
    return { requests, totalCount }
  },

  findUnique: (where: { id: string }): Request | null => {
    initializeStorage()
    const requests = getFromStorage<Request>(STORAGE_KEYS.requests)
    return requests.find(r => r.id === where.id) || null
  },

  create: (data: Omit<Request, 'id' | 'createdAt' | 'updatedAt'>): Request => {
    initializeStorage()
    const requests = getFromStorage<Request>(STORAGE_KEYS.requests)
    const newRequest: Request = {
      ...data,
      id: generateId(),
      status: 'PENDING' as RequestStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    requests.push(newRequest)
    saveToStorage(STORAGE_KEYS.requests, requests)
    return newRequest
  },

  update: (where: { id: string }, data: Partial<Omit<Request, 'id' | 'createdAt'>>): Request | null => {
    initializeStorage()
    const requests = getFromStorage<Request>(STORAGE_KEYS.requests)
    const index = requests.findIndex(r => r.id === where.id)
    
    if (index === -1) return null
    
    const updatedRequest = {
      ...requests[index],
      ...data,
      updatedAt: new Date().toISOString()
    }
    
    requests[index] = updatedRequest
    saveToStorage(STORAGE_KEYS.requests, requests)
    return updatedRequest
  },

  delete: (where: { id: string }): boolean => {
    initializeStorage()
    const requests = getFromStorage<Request>(STORAGE_KEYS.requests)
    const index = requests.findIndex(r => r.id === where.id)
    
    if (index === -1) return false
    
    requests.splice(index, 1)
    saveToStorage(STORAGE_KEYS.requests, requests)
    return true
  },

  count: (where: {
    staffId?: string,
    type?: RequestType,
    createdAt?: { gte: Date, lt: Date }
  }): number => {
    initializeStorage()
    const requests = getFromStorage<Request>(STORAGE_KEYS.requests)
    return requests.filter(r => {
      if (where.staffId && r.staffId !== where.staffId) return false
      if (where.type && r.type !== where.type) return false
      if (where.createdAt) {
        const createdAt = new Date(r.createdAt)
        if (createdAt < where.createdAt.gte || createdAt >= where.createdAt.lt) return false
      }
      return true
    }).length
  },

  findFirst: (where: {
    staffId: string,
    type: RequestType,
    startDate: Date,
    status: { in: RequestStatus[] }
  }): Request | null => {
    initializeStorage()
    const requests = getFromStorage<Request>(STORAGE_KEYS.requests)
    return requests.find(r => {
      if (r.staffId !== where.staffId) return false
      if (r.type !== where.type) return false
      if (new Date(r.startDate).getTime() !== where.startDate.getTime()) return false
      if (!where.status.in.includes(r.status)) return false
      return true
    }) || null
  },

  groupBy: (config: {
    by: string[],
    where?: { wardId?: string, staffId?: string, createdAt?: { gte: Date } },
    _count: { [key: string]: boolean }
  }): Array<{ [key: string]: any, _count: { [key: string]: number } }> => {
    initializeStorage()
    let requests = getFromStorage<Request>(STORAGE_KEYS.requests)
    
    // Apply where filter
    if (config.where) {
      if (config.where.wardId) {
        requests = requests.filter(r => r.wardId === config.where!.wardId)
      }
      if (config.where.staffId) {
        requests = requests.filter(r => r.staffId === config.where!.staffId)
      }
      if (config.where.createdAt?.gte) {
        requests = requests.filter(r => new Date(r.createdAt) >= config.where!.createdAt!.gte)
      }
    }
    
    // Group by specified fields
    const groups: { [key: string]: any[] } = {}
    
    requests.forEach(request => {
      const key = config.by.map(field => (request as any)[field]).join('|')
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(request)
    })
    
    // Convert to expected format
    return Object.entries(groups).map(([key, items]) => {
      const keyParts = key.split('|')
      const result: any = {}
      
      config.by.forEach((field, index) => {
        result[field] = keyParts[index]
      })
      
      result._count = {}
      Object.keys(config._count).forEach(countField => {
        result._count[countField] = items.length
      })
      
      return result
    })
  }
}

// Schedule operations
export const scheduleService = {
  create: (data: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>): Schedule => {
    initializeStorage()
    const schedules = getFromStorage<Schedule>(STORAGE_KEYS.schedules)
    const newSchedule: Schedule = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    schedules.push(newSchedule)
    saveToStorage(STORAGE_KEYS.schedules, schedules)
    return newSchedule
  }
}

// Assignment operations
export const assignmentService = {
  createMany: (data: { data: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>[] }): { count: number } => {
    initializeStorage()
    const assignments = getFromStorage<Assignment>(STORAGE_KEYS.assignments)
    
    const newAssignments = data.data.map(item => ({
      ...item,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
    
    assignments.push(...newAssignments)
    saveToStorage(STORAGE_KEYS.assignments, assignments)
    
    return { count: newAssignments.length }
  }
}

// Shift operations
export const shiftService = {
  findMany: (filter?: { wardId?: string, active?: boolean }): Shift[] => {
    initializeStorage()
    let shifts = getFromStorage<Shift>(STORAGE_KEYS.shifts)
    
    if (filter?.active !== undefined) {
      shifts = shifts.filter(s => s.active === filter.active)
    }
    
    return shifts
  }
}

// Audit log (mock for localStorage)
export const auditLogService = {
  create: (data: any): Promise<any> => {
    // For MVP, we'll just log to console instead of storing audit logs
    console.log('Audit Log:', data)
    return Promise.resolve(data)
  }
}

// Initialize storage on module load
if (typeof window !== 'undefined') {
  initializeStorage()
}