import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface EmailTemplate {
  type: string;
  subject: string;
  body: string;
  is_custom: boolean;
}

export interface EmailTemplatesResponse {
  templates: Record<string, EmailTemplate>;
  tokens: Record<string, string>;
}

export interface TemplatePreview {
  subject: string;
  body: string;
}

// Template type labels for UI display
export const EMAIL_TEMPLATE_LABELS: Record<string, { label: string; description: string }> = {
  welcome: {
    label: 'Welcome Email',
    description: 'Sent when a new user registers',
  },
  member_assigned: {
    label: 'Card Assignment',
    description: 'Sent when a user is assigned to a card',
  },
  mentioned: {
    label: 'Mention Notification',
    description: 'Sent when a user is @mentioned in a comment',
  },
  comment_added: {
    label: 'New Comment',
    description: 'Sent when someone comments on a card the user follows',
  },
  card_due: {
    label: 'Card Due',
    description: 'Sent when a card is due',
  },
  due_date_approaching: {
    label: 'Due Date Reminder',
    description: 'Sent as a reminder before a card is due',
  },
  card_completed: {
    label: 'Card Completed',
    description: 'Sent when a card is marked as completed',
  },
  member_removed: {
    label: 'Member Removed',
    description: 'Sent when a user is removed from a card',
  },
  card_moved: {
    label: 'Card Moved',
    description: 'Sent when a card is moved to a different list',
  },
};

/**
 * Fetch all email templates.
 */
export async function fetchEmailTemplates(): Promise<EmailTemplatesResponse> {
  const response = await fetch(`${API_URL}/api/email-templates`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch email templates');
  }

  return response.json();
}

/**
 * Update an email template.
 */
export async function updateEmailTemplate(
  type: string,
  data: { subject?: string; body?: string }
): Promise<EmailTemplate> {
  const response = await fetchWithCsrf(`${API_URL}/api/email-templates/${type}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update email template');
  }

  const result = await response.json();
  return result.template;
}

/**
 * Reset a template to default.
 */
export async function resetEmailTemplate(type: string): Promise<EmailTemplate> {
  const response = await fetchWithCsrf(`${API_URL}/api/email-templates/${type}/reset`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to reset email template');
  }

  const result = await response.json();
  return result.template;
}

/**
 * Preview a template with sample data.
 */
export async function previewEmailTemplate(data: {
  subject: string;
  body: string;
}): Promise<TemplatePreview> {
  const response = await fetchWithCsrf(`${API_URL}/api/email-templates/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to preview template');
  }

  const result = await response.json();
  return result.preview;
}
