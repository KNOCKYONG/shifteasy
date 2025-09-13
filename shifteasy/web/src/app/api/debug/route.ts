import { NextResponse } from 'next/server'
import { testStaff, testWards } from '@/lib/testdata'

export async function GET() {
  return NextResponse.json({
    testStaffCount: testStaff.length,
    testWardsCount: testWards.length,
    sampleStaff: testStaff.slice(0, 3),
    sampleWards: testWards
  })
}