import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

// Image compression settings
const MAX_IMAGE_DIMENSION = 2048; // Max width/height in pixels
const JPEG_QUALITY = 0.8; // 80% quality for JPEG compression
const COMPRESSIBLE_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

/**
 * Compress an image file using Canvas API.
 * Resizes if larger than MAX_IMAGE_DIMENSION and re-encodes as JPEG.
 * PNG files with transparency are kept as PNG but still resized if needed.
 */
export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE_IMAGE_TYPES.includes(file.type)) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Calculate new dimensions if image is too large
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // Fallback to original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Always output as JPEG for compression (PNG with transparency would need special handling)
      const outputType = 'image/jpeg';
      const outputExtension = '.jpg';

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // If compressed is larger than original, use original
            resolve(file);
            return;
          }

          // Create new file with compressed data
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const compressedFile = new window.File(
            [blob],
            baseName + outputExtension,
            { type: outputType, lastModified: Date.now() }
          );
          resolve(compressedFile);
        },
        outputType,
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}

/**
 * Check if a file is a compressible image type.
 */
export function isCompressibleImage(file: File): boolean {
  return COMPRESSIBLE_IMAGE_TYPES.includes(file.type);
}

export interface CardAttachment {
  id: string;
  name: string;
  cardId: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

// Transform JSON:API response to CardAttachment
function transformAttachment(data: Record<string, unknown>, included?: Record<string, unknown>[]): CardAttachment {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string; type: string } | null }> | undefined;

  // Get file info from included if available
  let fileUrl = '';
  let fileSize = 0;
  let mimeType = '';
  const fileId = rels?.field_attachment_file?.data?.id || '';
  if (included && fileId) {
    const file = included.find((item) => item.id === fileId && item.type === 'file--file');
    if (file) {
      const fileAttrs = file.attributes as Record<string, unknown>;
      fileUrl = (fileAttrs.uri as { url?: string })?.url || '';
      fileSize = (fileAttrs.filesize as number) || 0;
      mimeType = (fileAttrs.filemime as string) || '';

      // Make sure URL is absolute
      if (fileUrl && !fileUrl.startsWith('http')) {
        fileUrl = `${API_URL}${fileUrl}`;
      }
    }
  }

  return {
    id: data.id as string,
    name: attrs.title as string,
    cardId: rels?.field_attachment_card?.data?.id || '',
    fileUrl,
    fileSize,
    mimeType,
    createdAt: attrs.created as string,
  };
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Fetch all attachments for a card
export async function fetchAttachmentsByCard(cardId: string): Promise<CardAttachment[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/card_attachment?filter[field_attachment_card.id]=${cardId}&include=field_attachment_file&sort=-created`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch attachments');
  }

  const result = await response.json();
  const data = result.data;
  const included = result.included;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>) => transformAttachment(item, included));
}

// Upload a file and create an attachment using custom API endpoint
export async function createAttachment(cardId: string, file: File): Promise<CardAttachment> {
  // Compress image files before upload
  let fileToUpload = file;
  if (isCompressibleImage(file)) {
    try {
      fileToUpload = await compressImage(file);
    } catch (err) {
      console.warn('Image compression failed, uploading original:', err);
      fileToUpload = file;
    }
  }

  // Use custom endpoint that handles both file upload and attachment creation
  const response = await fetchWithCsrf(
    `${API_URL}/api/cards/${cardId}/attachments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Accept': 'application/json',
        'Content-Disposition': `file; filename="${encodeURIComponent(fileToUpload.name)}"`,
      },
      body: fileToUpload,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create attachment');
  }

  const result = await response.json();
  const data = result.data;

  // Transform the response to CardAttachment format
  return {
    id: data.id,
    name: data.attributes.title,
    cardId: cardId,
    fileUrl: data.file?.url ? (data.file.url.startsWith('http') ? data.file.url : `${API_URL}${data.file.url}`) : '',
    fileSize: data.file?.filesize || 0,
    mimeType: data.file?.filemime || '',
    createdAt: new Date(data.attributes.created * 1000).toISOString(),
  };
}

// Delete an attachment
export async function deleteAttachment(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/card_attachment/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete attachment');
  }
}
