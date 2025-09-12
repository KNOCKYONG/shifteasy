import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { preferenceService, staffService } from '@/lib/memoryStorage'

const CreatePreferenceSchema = z.object({
  staffId: z.string(),
  date: z.string(),
  shiftType: z.enum(['D', 'E', 'N', 'O']),
  score: z.number().min(1).max(5),
  reason: z.string().optional()
})

const BulkCreatePreferencesSchema = z.object({
  preferences: z.array(CreatePreferenceSchema)
})

const ListPreferencesSchema = z.object({
  staffId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  shiftType: z.enum(['D', 'E', 'N', 'O']).nullable().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
})

/**
 * POST /api/preferences - 선호도 생성 (단일 또는 bulk)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Bulk creation check
    if (body.preferences && Array.isArray(body.preferences)) {
      const data = BulkCreatePreferencesSchema.parse(body)
      
      const createdPreferences = []
      for (const pref of data.preferences) {
        // Validate staff exists
        const staff = staffService.findFirst({ id: pref.staffId })
        if (!staff) {
          return NextResponse.json(
            { error: `Staff not found: ${pref.staffId}` },
            { status: 404 }
          )
        }

        // Remove existing preference for same staff/date/shift if exists
        // This is handled in the create function

        const newPreference = preferenceService.create({
          staffId: pref.staffId,
          date: pref.date,
          shiftType: pref.shiftType,
          score: pref.score,
          reason: pref.reason
        })

        createdPreferences.push(newPreference)
      }

      return NextResponse.json({
        success: true,
        preferences: createdPreferences.map(p => ({
          id: p.id,
          staffId: p.staffId,
          date: new Date(p.date).toISOString().split('T')[0],
          shiftType: p.shiftType,
          score: p.score,
          reason: p.reason,
          createdAt: p.createdAt
        })),
        count: createdPreferences.length
      }, { status: 201 })
    } else {
      // Single preference creation
      const data = CreatePreferenceSchema.parse(body)
      
      // Validate staff exists
      const staff = staffService.findFirst({ id: data.staffId })
      if (!staff) {
        return NextResponse.json(
          { error: 'Staff not found' },
          { status: 404 }
        )
      }

      const newPreference = preferenceService.create({
        staffId: data.staffId,
        date: data.date,
        shiftType: data.shiftType,
        score: data.score,
        reason: data.reason
      })

      return NextResponse.json({
        success: true,
        preference: {
          id: newPreference.id,
          staffId: newPreference.staffId,
          date: new Date(newPreference.date).toISOString().split('T')[0],
          shiftType: newPreference.shiftType,
          score: newPreference.score,
          reason: newPreference.reason,
          createdAt: newPreference.createdAt
        }
      }, { status: 201 })
    }

  } catch (error) {
    console.error('Create preference error:', error)
    
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
 * GET /api/preferences - 선호도 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = ListPreferencesSchema.parse({
      staffId: searchParams.get('staffId'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      shiftType: searchParams.get('shiftType'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset')
    })

    const dateRange = (() => {
      if (!query.startDate && !query.endDate) return undefined
      const range: { gte?: Date; lte?: Date } = {}
      if (query.startDate) range.gte = new Date(query.startDate)
      if (query.endDate) range.lte = new Date(query.endDate)
      return Object.keys(range).length > 0 ? range as { gte: Date; lte: Date } : undefined
    })()

    let preferences = preferenceService.findMany({
      staffId: query.staffId || undefined,
      dateRange
    })
    
    // Filter by shiftType if provided
    if (query.shiftType) {
      preferences = preferences.filter(p => p.shiftType === query.shiftType)
    }
    
    // Apply pagination
    const totalCount = preferences.length
    if (query.offset) {
      preferences = preferences.slice(query.offset)
    }
    if (query.limit) {
      preferences = preferences.slice(0, query.limit)
    }

    const formattedPreferences = preferences.map(p => ({
      id: p.id,
      staffId: p.staffId,
      date: new Date(p.date).toISOString().split('T')[0],
      shiftType: p.shiftType,
      score: p.score,
      reason: p.reason,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      staff: (() => {
        const staff = staffService.findFirst({ id: p.staffId })
        return staff ? { id: staff.id, name: staff.name, role: staff.role } : null
      })()
    }))

    return NextResponse.json({
      success: true,
      preferences: formattedPreferences,
      pagination: {
        total: totalCount,
        limit: query.limit,
        offset: query.offset,
        hasMore: false // TODO: implement proper pagination in preferenceService
      }
    })

  } catch (error) {
    console.error('List preferences error:', error)
    
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