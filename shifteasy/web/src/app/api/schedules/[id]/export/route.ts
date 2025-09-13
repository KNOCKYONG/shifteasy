import { NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return new NextResponse(`Export for ${id} not implemented`, { status: 501 })
}
