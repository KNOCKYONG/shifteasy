import { NextResponse } from 'next/server';

export async function GET() {
  const svg = `<svg width="240" height="60" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="240" height="60" fill="#2563eb" rx="8"/>

  <!-- Text -->
  <text x="120" y="38" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">
    ShiftEasy
  </text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
