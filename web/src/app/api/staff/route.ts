import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { staffService, wardService } from '@/lib/memoryStorage'

const ListStaffSchema = z.object({
  wardId: z.string().nullable().optional(),
  role: z.enum(['RN', 'CN', 'NA', 'LEAD']).nullable().optional(),
  active: z.string().nullable().optional().transform(val => val === null ? true : val === 'true'),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const query = ListStaffSchema.parse({
      wardId: searchParams.get('wardId'),
      role: searchParams.get('role'),
      active: searchParams.get('active'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset')
    })

    // Validate ward exists if wardId provided
    if (query.wardId) {
      const ward = wardService.findUnique({ id: query.wardId })
      if (!ward) {
        return NextResponse.json(
          { error: 'Ward not found' },
          { status: 404 }
        )
      }
    }

    const { staff, totalCount } = staffService.findMany({
      wardId: query.wardId || undefined,
      role: query.role || undefined,
      active: query.active,
      limit: query.limit,
      offset: query.offset
    })

    const formattedStaff = staff.map(s => ({
      id: s.id,
      name: s.name,
      role: s.role,
      wardId: s.wardId,
      employeeId: s.employeeId,
      hireDate: s.hireDate ? new Date(s.hireDate).toISOString() : null,
      maxWeeklyHours: s.maxWeeklyHours,
      skills: s.skills,
      technicalSkill: s.technicalSkill,
      leadership: s.leadership,
      communication: s.communication,
      adaptability: s.adaptability,
      reliability: s.reliability,
      experienceLevel: s.experienceLevel,
      active: s.active,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }))

    return NextResponse.json({
      success: true,
      staff: formattedStaff,
      pagination: {
        total: totalCount,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < totalCount
      }
    })

  } catch (error) {
    console.error('List staff error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}