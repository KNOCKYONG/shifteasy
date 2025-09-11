import { NextResponse } from "next/server"

export async function POST(req: Request) {
  // Placeholder validator – echoes back payload and zero warnings
  const body = await req.json().catch(() => ({}))
  return NextResponse.json({ ok: true, warnings: {}, received: body })
}

