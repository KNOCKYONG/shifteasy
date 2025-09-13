import { NextResponse } from 'next/server'
import { staffService } from '@/lib/memoryStorage'

export async function GET() {
  const allStaff = staffService.findMany({}).staff
  const ward3AStaff = staffService.findMany({ wardId: "ward-3A" }).staff
  
  // Test the same parameters used in staff API
  const testParams = {
    wardId: "ward-3A",
    role: null,
    active: true,
    limit: 3,
    offset: 0
  }
  
  // Simulate API logic
  const testStaffResults = staffService.findMany({
    wardId: testParams.wardId || undefined,
    role: testParams.role || undefined, 
    active: testParams.active,
    limit: testParams.limit,
    offset: testParams.offset
  })
  
  return NextResponse.json({
    totalStaffInMemory: allStaff.length,
    ward3AStaffCount: ward3AStaff.length,
    sampleAllStaff: allStaff.slice(0, 3).map(s => ({ id: s.id, name: s.name, wardId: s.wardId })),
    sampleWard3AStaff: ward3AStaff.slice(0, 3).map(s => ({ id: s.id, name: s.name, wardId: s.wardId })),
    testStaffResults: {
      count: testStaffResults.totalCount,
      staff: testStaffResults.staff.map(s => ({ id: s.id, name: s.name, wardId: s.wardId, role: s.role }))
    }
  })
}