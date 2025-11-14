import { NextRequest, NextResponse } from 'next/server';
import { uploadBase64ToR2 } from '@/lib/storage/r2-client';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout

/**
 * POST /api/upload-consulting-file
 *
 * Upload a consulting file to Cloudflare R2
 *
 * Body:
 * - dataUrl: Base64 data URL of the file
 * - fileName: Original file name
 * - fileSize: File size in bytes
 * - fileType: MIME type
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataUrl, fileName, fileSize, fileType } = body;

    // Validation
    if (!dataUrl || !fileName || !fileSize || !fileType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // File size limit: 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Allowed file types
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];

    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: xlsx, xls, csv, pdf, jpg, png' },
        { status: 400 }
      );
    }

    // Upload to R2
    const url = await uploadBase64ToR2(dataUrl, fileName);

    return NextResponse.json({
      success: true,
      url,
      name: fileName,
      size: fileSize,
      type: fileType,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
