/**
 * Cloudflare R2 Storage Client
 *
 * Handles file uploads to Cloudflare R2 for consulting requests
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;
const CONSULTING_BUCKET = 'consulting-files';

// Initialize R2 Client (R2 is S3-compatible)
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a file to R2
 * @param file - File buffer to upload
 * @param fileName - Target file name
 * @param contentType - MIME type
 * @returns Public URL of uploaded file
 */
export async function uploadToR2(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const key = `consulting/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: CONSULTING_BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await r2Client.send(command);

  // Return public URL
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Upload a file from base64 data URL
 * @param dataUrl - Base64 data URL
 * @param fileName - Original file name
 * @returns Public URL of uploaded file
 */
export async function uploadBase64ToR2(
  dataUrl: string,
  fileName: string
): Promise<string> {
  // Extract base64 data and content type
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

  if (!matches || matches.length !== 3) {
    throw new Error('Invalid data URL format');
  }

  const contentType = matches[1]!;
  const base64Data = matches[2]!;
  const buffer = Buffer.from(base64Data, 'base64');

  return uploadToR2(buffer, fileName, contentType);
}

/**
 * Get a presigned URL for downloading a file
 * @param key - File key in R2
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Presigned URL
 */
export async function getDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: CONSULTING_BUCKET,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Delete a file from R2
 * @param key - File key to delete
 */
export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: CONSULTING_BUCKET,
    Key: key,
  });

  await r2Client.send(command);
}

/**
 * Extract R2 key from URL
 * @param url - Full R2 URL
 * @returns File key
 */
export function extractR2Key(url: string): string {
  const urlObj = new URL(url);
  return urlObj.pathname.slice(1); // Remove leading slash
}
