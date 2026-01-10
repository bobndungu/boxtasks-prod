import { getAccessToken } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

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

// Upload a file and create an attachment
export async function createAttachment(cardId: string, file: File): Promise<CardAttachment> {
  // Step 1: Upload the file
  const uploadResponse = await fetch(
    `${API_URL}/jsonapi/node/card_attachment/field_attachment_file`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${getAccessToken()}`,
        'Content-Disposition': `file; filename="${encodeURIComponent(file.name)}"`,
      },
      body: file,
    }
  );

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to upload file');
  }

  const uploadResult = await uploadResponse.json();
  const fileId = uploadResult.data.id;

  // Step 2: Create the attachment node referencing the file
  const response = await fetch(`${API_URL}/jsonapi/node/card_attachment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      data: {
        type: 'node--card_attachment',
        attributes: {
          title: file.name,
        },
        relationships: {
          field_attachment_card: {
            data: { type: 'node--card', id: cardId },
          },
          field_attachment_file: {
            data: { type: 'file--file', id: fileId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create attachment');
  }

  const result = await response.json();
  return transformAttachment(result.data, result.included);
}

// Delete an attachment
export async function deleteAttachment(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/jsonapi/node/card_attachment/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete attachment');
  }
}
