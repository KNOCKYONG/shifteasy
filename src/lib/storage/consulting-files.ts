/**
 * Consulting Files Storage Helper
 *
 * This module handles file uploads for consulting requests.
 * Files are stored temporarily in the browser and uploaded to a storage service.
 *
 * For production, integrate with:
 * - Supabase Storage
 * - AWS S3
 * - Cloudflare R2
 * - Or any other cloud storage provider
 */

export interface FileUploadResult {
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}

/**
 * Mock file upload function
 * In production, this should upload to actual storage (Supabase Storage, S3, etc.)
 *
 * @param file - File to upload
 * @returns Upload result with file metadata
 */
export async function uploadConsultingFile(file: File): Promise<FileUploadResult> {
  // For now, convert to data URL for demonstration
  // In production, upload to Supabase Storage or similar

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result as string;

      resolve({
        name: file.name,
        size: file.size,
        type: file.type,
        url: dataUrl, // In production, this would be the actual storage URL
        uploadedAt: new Date().toISOString(),
      });
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${file.name}`));
    };

    // Read file as data URL (base64)
    reader.readAsDataURL(file);
  });
}

/**
 * Upload multiple files in parallel
 *
 * @param files - Array of files to upload
 * @returns Array of upload results
 */
export async function uploadMultipleConsultingFiles(
  files: File[]
): Promise<FileUploadResult[]> {
  try {
    const uploads = files.map(file => uploadConsultingFile(file));
    return await Promise.all(uploads);
  } catch (error) {
    console.error('Error uploading files:', error);
    throw error;
  }
}

/**
 * Validate file before upload
 *
 * @param file - File to validate
 * @param maxSize - Maximum file size in bytes (default: 10MB)
 * @returns Validation result
 */
export function validateFile(file: File, maxSize: number = 10 * 1024 * 1024): {
  valid: boolean;
  error?: string;
} {
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${maxSize / 1024 / 1024}MB`,
    };
  }

  // Check file type
  const allowedTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Allowed: xlsx, xls, csv, pdf, jpg, png',
    };
  }

  return { valid: true };
}

// TODO: Production implementation with Supabase Storage
/*
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export async function uploadConsultingFile(file: File): Promise<FileUploadResult> {
  const supabase = createClientComponentClient();
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `consulting-requests/${fileName}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('consulting-files')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('consulting-files')
    .getPublicUrl(filePath);

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    url: publicUrl,
    uploadedAt: new Date().toISOString(),
  };
}
*/
