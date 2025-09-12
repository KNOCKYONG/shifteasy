import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requestService, staffService, wardService, preferenceService, auditLogService } from '@/lib/memoryStorage'

// 요청 승인/거부 스키마
const UpdateRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']),
  rejectedReason: z.string().optional(),
  approvedBy: z.string().optional()
})

// 요청 수정 스키마
const ModifyRequestSchema = z.object({
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  reason: z.string().optional(),
  description: z.string().optional(),
  shiftType: z.enum(['D', 'E', 'N', 'O']).optional()
})

/**
 * GET /api/requests/[id] - 특정 요청 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id

    const requestData = requestService.findUnique({ id: requestId })
    
    if (!requestData) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    const staff = staffService.findFirst({ id: requestData.staffId })
    const ward = wardService.findUnique({ id: requestData.wardId })

    // 관련 통계 정보도 함께 제공
    const staffRequestStats = requestService.groupBy({
      by: ['status', 'type'],
      where: {
        staffId: requestData.staffId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // 이번 달
        }
      },
      _count: {
        id: true
      }
    })

    const formattedRequest = {
      id: requestData.id,
      type: requestData.type,
      status: requestData.status,
      priority: requestData.priority,
      startDate: new Date(requestData.startDate).toISOString(),
      endDate: requestData.endDate ? new Date(requestData.endDate).toISOString() : null,
      shiftType: requestData.shiftType,
      reason: requestData.reason,
      description: requestData.description,
      approvedBy: requestData.approvedBy,
      approvedAt: requestData.approvedAt ? new Date(requestData.approvedAt).toISOString() : null,
      rejectedReason: requestData.rejectedReason,
      createdAt: requestData.createdAt,
      updatedAt: requestData.updatedAt,
      staff: staff ? {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        employeeId: staff.employeeId
      } : null,
      ward: ward ? {
        id: ward.id,
        name: ward.name,
        code: ward.code
      } : null,
      staffStats: {
        thisMonth: Object.fromEntries(
          staffRequestStats.map(s => [`${s.type}_${s.status}`, s._count.id])
        )
      }
    }

    return NextResponse.json({
      success: true,
      request: formattedRequest
    })

  } catch (error) {
    console.error('Get request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/requests/[id] - 요청 상태 업데이트 (승인/거부)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id
    const body = await request.json()

    // 상태 업데이트인지 내용 수정인지 구분
    let updateData: any = {}
    let isStatusUpdate = false

    if ('status' in body) {
      // 상태 업데이트 (승인/거부)
      const data = UpdateRequestSchema.parse(body)
      isStatusUpdate = true
      
      updateData = {
        status: data.status,
        updatedAt: new Date()
      }

      if (data.status === 'APPROVED') {
        updateData.approvedBy = data.approvedBy || 'system'
        updateData.approvedAt = new Date()
      } else if (data.status === 'REJECTED') {
        updateData.rejectedReason = data.rejectedReason || '사유 없음'
      }
    } else {
      // 내용 수정
      const data = ModifyRequestSchema.parse(body)
      
      updateData = {
        ...Object.fromEntries(
          Object.entries(data).filter(([_, value]) => value !== undefined)
        ),
        updatedAt: new Date()
      }
    }

    // 요청 존재 확인
    const existingRequest = requestService.findUnique({ id: requestId })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    const existingStaff = staffService.findFirst({ id: existingRequest.staffId })

    // 상태 변경 가능성 확인
    if (isStatusUpdate) {
      if (existingRequest.status === 'APPROVED' || existingRequest.status === 'REJECTED') {
        return NextResponse.json(
          { error: 'Cannot modify already processed request' },
          { status: 400 }
        )
      }
    }

    // 업데이트 실행
    const updatedRequest = requestService.update({ id: requestId }, updateData)

    if (!updatedRequest) {
      return NextResponse.json(
        { error: 'Failed to update request' },
        { status: 500 }
      )
    }

    const updatedStaff = staffService.findFirst({ id: updatedRequest.staffId })
    const updatedWard = wardService.findUnique({ id: updatedRequest.wardId })

    // 감사 로그
    await auditLogService.create({
      userId: updateData.approvedBy || 'system',
      action: isStatusUpdate ? 'UPDATE_REQUEST_STATUS' : 'MODIFY_REQUEST',
      entityType: 'Request',
      entityId: requestId,
      oldData: {
        status: existingRequest.status,
        priority: existingRequest.priority,
        reason: existingRequest.reason
      },
      newData: updateData,
      metadata: {
        staffName: existingStaff?.name || 'Unknown',
        isStatusUpdate,
        previousStatus: existingRequest.status
      }
    })

    // 자동 선호도 생성 (승인된 선호도 요청의 경우)
    if (
      isStatusUpdate && 
      updateData.status === 'APPROVED' && 
      (existingRequest.type === 'SHIFT_PREFERENCE' || existingRequest.type === 'SHIFT_AVOIDANCE')
    ) {
      try {
        const preferenceScore = existingRequest.type === 'SHIFT_PREFERENCE' ? 5 : -5
        
        preferenceService.create({
          staffId: existingRequest.staffId,
          date: existingRequest.startDate,
          shiftType: existingRequest.shiftType!,
          score: preferenceScore,
          reason: `승인된 ${existingRequest.type} 요청으로부터 자동 생성`
        })
      } catch (prefError) {
        console.warn('Failed to create automatic preference:', prefError)
        // 선호도 생성 실패는 주요 프로세스를 중단하지 않음
      }
    }

    return NextResponse.json({
      success: true,
      request: {
        id: updatedRequest.id,
        type: updatedRequest.type,
        status: updatedRequest.status,
        priority: updatedRequest.priority,
        startDate: new Date(updatedRequest.startDate).toISOString(),
        endDate: updatedRequest.endDate ? new Date(updatedRequest.endDate).toISOString() : null,
        shiftType: updatedRequest.shiftType,
        reason: updatedRequest.reason,
        description: updatedRequest.description,
        approvedBy: updatedRequest.approvedBy,
        approvedAt: updatedRequest.approvedAt ? new Date(updatedRequest.approvedAt).toISOString() : null,
        rejectedReason: updatedRequest.rejectedReason,
        createdAt: updatedRequest.createdAt,
        updatedAt: updatedRequest.updatedAt,
        staff: updatedStaff ? {
          id: updatedStaff.id,
          name: updatedStaff.name,
          role: updatedStaff.role
        } : null,
        ward: updatedWard ? {
          id: updatedWard.id,
          name: updatedWard.name
        } : null
      }
    })

  } catch (error) {
    console.error('Update request error:', error)
    
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
 * DELETE /api/requests/[id] - 요청 삭제 (취소)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id

    // 요청 존재 및 삭제 가능 상태 확인
    const existingRequest = requestService.findUnique({ id: requestId })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    const existingStaff = staffService.findFirst({ id: existingRequest.staffId })

    // 승인된 요청은 삭제 불가
    if (existingRequest.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Cannot delete approved request' },
        { status: 400 }
      )
    }

    // 요청 삭제
    const deleteSuccess = requestService.delete({ id: requestId })

    if (!deleteSuccess) {
      return NextResponse.json(
        { error: 'Failed to delete request' },
        { status: 500 }
      )
    }

    // 감사 로그
    await auditLogService.create({
      userId: 'system', // TODO: 실제 사용자 ID로 교체
      action: 'DELETE_REQUEST',
      entityType: 'Request',
      entityId: requestId,
      oldData: {
        type: existingRequest.type,
        status: existingRequest.status,
        startDate: existingRequest.startDate,
        staffId: existingRequest.staffId
      },
      metadata: {
        staffName: existingStaff?.name || 'Unknown',
        reason: 'Request cancelled by user'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Request deleted successfully'
    })

  } catch (error) {
    console.error('Delete request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}