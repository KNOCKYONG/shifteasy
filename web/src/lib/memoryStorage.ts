/**
 * In-Memory Data Storage for Shifteasy MVP API Routes
 * Server-side storage solution that doesn't depend on localStorage
 */

import { testWards, testStaff, testPreferences, testRequests, testSchedules, testShifts } from './testdata'
import type { 
  Ward, Staff, Preference, Request, Schedule, Shift, Assignment,
  RequestType, RequestStatus
} from './types'

// Process staff to add wardId based on naming patterns
const processedStaff = testStaff.map(staff => {
  // Determine wardId based on staff ID pattern
  let wardId = "ward-3A" // default
  if (staff.id.includes("3a") || staff.id.includes("3A")) {
    wardId = "ward-3A"
  } else if (staff.id.includes("5b") || staff.id.includes("5B")) {
    wardId = "ward-5B"
  }
  
  return {
    ...staff,
    wardId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
})

// In-memory storage
const memoryData = {
  wards: [...testWards],
  staff: [...processedStaff],
  preferences: [...testPreferences],
  requests: [...testRequests],
  schedules: [...testSchedules],
  assignments: [] as Assignment[],
  shifts: [...testShifts]
}

function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Ward operations
export const wardService = {
  findMany: (filter?: { id?: string }): Ward[] => {
    const wards = memoryData.wards
    if (filter?.id) {
      return wards.filter(ward => ward.id === filter.id)
    }
    return wards
  },

  findUnique: (where: { id: string }): Ward | null => {
    return memoryData.wards.find(ward => ward.id === where.id) || null
  }
}

// Staff operations
export const staffService = {
  findMany: (filter?: { 
    wardId?: string, 
    role?: string,
    active?: boolean,
    limit?: number,
    offset?: number 
  }): { staff: Staff[], totalCount: number } => {
    const staff = memoryData.staff
    let result = staff
    
    if (filter?.wardId) {
      result = result.filter(s => s.wardId === filter.wardId)
    }
    if (filter?.role) {
      result = result.filter(s => s.role === filter.role)
    }
    if (filter?.active !== undefined) {
      result = result.filter(s => s.active === filter.active)
    }
    
    const totalCount = result.length
    
    if (filter?.offset) {
      result = result.slice(filter.offset)
    }
    if (filter?.limit) {
      result = result.slice(0, filter.limit)
    }
    
    return { staff: result, totalCount }
  },

  findFirst: (where: { id?: string, wardId?: string, active?: boolean }): Staff | null => {
    const staff = memoryData.staff
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
    const preferences = memoryData.preferences
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
    const newPreference: Preference = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    memoryData.preferences.push(newPreference)
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
    let requests = [...memoryData.requests]
    
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
    return memoryData.requests.find(r => r.id === where.id) || null
  },

  create: (data: Omit<Request, 'id' | 'createdAt' | 'updatedAt'>): Request => {
    const newRequest: Request = {
      ...data,
      id: generateId(),
      status: 'PENDING' as RequestStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    memoryData.requests.push(newRequest)
    return newRequest
  },

  update: (where: { id: string }, data: Partial<Omit<Request, 'id' | 'createdAt'>>): Request | null => {
    const index = memoryData.requests.findIndex(r => r.id === where.id)
    
    if (index === -1) return null
    
    const updatedRequest = {
      ...memoryData.requests[index],
      ...data,
      updatedAt: new Date().toISOString()
    }
    
    memoryData.requests[index] = updatedRequest
    return updatedRequest
  },

  delete: (where: { id: string }): boolean => {
    const index = memoryData.requests.findIndex(r => r.id === where.id)
    
    if (index === -1) return false
    
    memoryData.requests.splice(index, 1)
    return true
  },

  count: (where: {
    staffId?: string,
    type?: RequestType,
    createdAt?: { gte: Date, lt: Date }
  }): number => {
    return memoryData.requests.filter(r => {
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
    return memoryData.requests.find(r => {
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
  }): Array<{ [key: string]: unknown, _count: { [key: string]: number } }> => {
    let requests = [...memoryData.requests]
    
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
    const groups: { [key: string]: Request[] } = {}
    
    requests.forEach(request => {
      const key = config.by.map(field => (request as Record<string, unknown>)[field]).join('|')
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(request)
    })
    
    // Convert to expected format
    return Object.entries(groups).map(([key, items]) => {
      const keyParts = key.split('|')
      const result: { [key: string]: unknown; _count: { [key: string]: number } } = { _count: {} }
      
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
  create: (data: Omit<Schedule, 'id'>): Schedule => {
    const newSchedule: Schedule = {
      ...data,
      id: generateId()
    }
    memoryData.schedules.push(newSchedule)
    return newSchedule
  }
}

// Assignment operations
export const assignmentService = {
  createMany: (data: { data: Omit<Assignment, 'id'>[] }): { count: number } => {
    const newAssignments = data.data.map(item => ({
      ...item,
      id: generateId()
    }))
    
    memoryData.assignments.push(...newAssignments)
    
    return { count: newAssignments.length }
  }
}

// Shift operations
export const shiftService = {
  findMany: (filter?: { wardId?: string, active?: boolean }): Shift[] => {
    let shifts = [...memoryData.shifts]
    
    if (filter?.active !== undefined) {
      shifts = shifts.filter(s => s.active === filter.active)
    }
    
    return shifts
  }
}

// Audit log (mock for memory storage)
export const auditLogService = {
  create: (data: Record<string, unknown>): Promise<Record<string, unknown>> => {
    // For MVP, we'll just log to console instead of storing audit logs
    console.log('Audit Log:', data)
    return Promise.resolve(data)
  }
}