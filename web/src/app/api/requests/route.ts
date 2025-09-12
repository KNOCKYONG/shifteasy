import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { wardService, staffService, requestService, preferenceService, auditLogService } from '@/lib/memoryStorage'
import { format, parseISO, isValid } from 'date-fns'

// 요청 생성 스키마
const CreateRequestSchema = z.object({
  wardId: z.string(),
  staffId: z.string(),
  type: z.enum(['ANNUAL_LEAVE', 'SICK_LEAVE', 'SHIFT_PREFERENCE', 'SHIFT_AVOIDANCE', 'OVERTIME']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  startDate: z.string(),
  endDate: z.string().optional(),
  shiftType: z.enum(['D', 'E', 'N', 'O']).optional(),
  reason: z.string().optional(),
  description: z.string().optional()
})

// 요청 목록 조회 쿼리 스키마
const ListRequestsSchema = z.object({
  wardId: z.string().nullable().optional(),
  staffId: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).nullable().optional(),
  type: z.enum(['ANNUAL_LEAVE', 'SICK_LEAVE', 'SHIFT_PREFERENCE', 'SHIFT_AVOIDANCE', 'OVERTIME']).nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
})

/**
 * POST /api/requests - 새 요청 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = CreateRequestSchema.parse(body)

    // 날짜 유효성 검증
    if (!isValid(parseISO(data.startDate))) {
      return NextResponse.json(
        { error: 'Invalid startDate format' },
        { status: 400 }
      )
    }

    if (data.endDate && !isValid(parseISO(data.endDate))) {
      return NextResponse.json(
        { error: 'Invalid endDate format' },
        { status: 400 }
      )
    }

    // 병동과 직원 존재 확인
    const ward = wardService.findUnique({ id: data.wardId })

    if (!ward) {
      return NextResponse.json(
        { error: 'Ward not found' },
        { status: 404 }
      )
    }

    const staff = staffService.findFirst({
      id: data.staffId,
      wardId: data.wardId,
      active: true
    })

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff not found or not active in this ward' },
        { status: 404 }
      )
    }

    // 중복 요청 확인 (같은 날짜, 같은 타입)
    const existingRequest = requestService.findFirst({
      staffId: data.staffId,
      type: data.type,
      startDate: new Date(data.startDate),
      status: { in: ['PENDING', 'APPROVED'] }
    })

    if (existingRequest) {
      return NextResponse.json(
        { error: 'Similar request already exists for this date and type' },
        { status: 409 }
      )
    }

    // 월별 요청 제한 확인
    const currentMonth = format(parseISO(data.startDate), 'yyyy-MM')
    const monthlyRequests = requestService.count({
      staffId: data.staffId,
      type: data.type,
      createdAt: {
        gte: new Date(`${currentMonth}-01`),
        lt: new Date(`${currentMonth}-31`)
      }
    })

    // 타입별 월간 제한 (설정 가능하게 만들 수 있음)
    const MONTHLY_LIMITS = {
      ANNUAL_LEAVE: 8,
      SICK_LEAVE: 5,
      SHIFT_PREFERENCE: 10,
      SHIFT_AVOIDANCE: 5,
      OVERTIME: 15
    }

    if (monthlyRequests >= MONTHLY_LIMITS[data.type]) {
      return NextResponse.json(
        { 
          error: `Monthly limit exceeded for ${data.type}`,
          limit: MONTHLY_LIMITS[data.type],
          current: monthlyRequests
        },
        { status: 400 }
      )
    }

    // 요청 생성
    const newRequest = requestService.create({
      wardId: data.wardId,
      staffId: data.staffId,
      type: data.type,
      priority: data.priority,
      startDate: data.startDate,
      endDate: data.endDate || null,
      shiftType: data.shiftType || null,
      reason: data.reason,
      description: data.description
    })

    // Include related data for response
    const requestWithRelations = {
      ...newRequest,
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role
      },
      ward: {
        id: ward.id,
        name: ward.name
      }
    }

    // 감사 로그
    await auditLogService.create({
      userId: data.staffId, // 요청자가 사용자
      action: 'CREATE_REQUEST',
      entityType: 'Request',
      entityId: newRequest.id,
      newData: {
        type: data.type,
        priority: data.priority,
        startDate: data.startDate,
        endDate: data.endDate,
        shiftType: data.shiftType
      },
      metadata: {
        staffName: staff.name,
        wardName: ward.name
      }
    })

    return NextResponse.json({
      success: true,
      request: {
        id: requestWithRelations.id,
        type: requestWithRelations.type,
        status: requestWithRelations.status,
        priority: requestWithRelations.priority,
        startDate: new Date(requestWithRelations.startDate).toISOString(),
        endDate: requestWithRelations.endDate ? new Date(requestWithRelations.endDate).toISOString() : null,
        shiftType: requestWithRelations.shiftType,
        reason: requestWithRelations.reason,
        description: requestWithRelations.description,
        createdAt: requestWithRelations.createdAt,
        staff: requestWithRelations.staff,
        ward: requestWithRelations.ward
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Create request error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/requests - 요청 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = ListRequestsSchema.parse({
      wardId: searchParams.get('wardId'),
      staffId: searchParams.get('staffId'),
      status: searchParams.get('status'),
      type: searchParams.get('type'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset')
    })

    // 검색 조건 구성
    const where: any = {}

    if (query.wardId) where.wardId = query.wardId
    if (query.staffId) where.staffId = query.staffId
    if (query.status) where.status = query.status
    if (query.type) where.type = query.type

    if (query.startDate || query.endDate) {
      where.startDate = {}
      if (query.startDate) where.startDate.gte = new Date(query.startDate)
      if (query.endDate) where.startDate.lte = new Date(query.endDate)
    }

    // 요청 목록 조회
    const { requests, totalCount } = requestService.findMany({
      wardId: query.wardId,
      staffId: query.staffId,
      status: query.status,
      type: query.type,
      startDate: query.startDate || query.endDate ? {
        gte: query.startDate ? new Date(query.startDate) : undefined,
        lte: query.endDate ? new Date(query.endDate) : undefined
      } : undefined,
      limit: query.limit,
      offset: query.offset
    })

    // Add related data to requests
    const formattedRequests = requests.map(req => {
      const staff = staffService.findFirst({ id: req.staffId })
      const ward = wardService.findUnique({ id: req.wardId })
      
      return {
        id: req.id,
        type: req.type,
        status: req.status,
        priority: req.priority,
        startDate: new Date(req.startDate).toISOString(),
        endDate: req.endDate ? new Date(req.endDate).toISOString() : null,
        shiftType: req.shiftType,
        reason: req.reason,
        description: req.description,
        approvedBy: req.approvedBy,
        approvedAt: req.approvedAt ? new Date(req.approvedAt).toISOString() : null,
        rejectedReason: req.rejectedReason,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        staff: staff ? {
          id: staff.id,
          name: staff.name,
          role: staff.role
        } : null,
        ward: ward ? {
          id: ward.id,
          name: ward.name
        } : null
      }
    })

    // 통계 정보도 함께 제공
    const statusCounts = requestService.groupBy({
      by: ['status'],
      where: query.wardId ? { wardId: query.wardId } : undefined,
      _count: {
        status: true
      }
    })

    const typeCounts = requestService.groupBy({
      by: ['type'],
      where: query.wardId ? { wardId: query.wardId } : undefined,
      _count: {
        type: true
      }
    })

    return NextResponse.json({
      success: true,
      requests: formattedRequests,
      pagination: {
        total: totalCount,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < totalCount
      },
      statistics: {
        byStatus: Object.fromEntries(
          statusCounts.map(s => [s.status, s._count.status])
        ),
        byType: Object.fromEntries(
          typeCounts.map(t => [t.type, t._count.type])
        )
      }
    })

  } catch (error) {
    console.error('List requests error:', error)
    
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