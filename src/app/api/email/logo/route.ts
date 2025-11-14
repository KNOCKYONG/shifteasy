import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const logoPath = join(process.cwd(), 'public', 'email', 'logo.png');
    const imageBuffer = await readFile(logoPath);

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error loading logo:', error);
    return new NextResponse('Logo not found', { status: 404 });
  }
}
