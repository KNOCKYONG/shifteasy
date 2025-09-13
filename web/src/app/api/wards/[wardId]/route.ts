import { NextRequest, NextResponse } from 'next/server'
import { wardService } from '@/lib/memoryStorage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wardId: string }> }
) {
  try {
    const { wardId } = await params
    
    if (!wardId) {
      return NextResponse.json(
        { error: 'Ward ID is required' },
        { status: 400 }
      )
    }

    const ward = wardService.findUnique({ id: wardId })

    if (!ward) {
      return NextResponse.json(
        { error: 'Ward not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      ward: {
        id: ward.id,
        name: ward.name,
        code: ward.code,
        active: ward.active,
        hardRules: ward.hardRules,
        softRules: ward.softRules,
        createdAt: ward.createdAt,
        updatedAt: ward.updatedAt
      }
    })

  } catch (error) {
    console.error('Get ward error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}