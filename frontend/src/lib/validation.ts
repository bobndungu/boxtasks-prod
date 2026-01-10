/**
 * Input validation and sanitization utilities for BoxTasks frontend.
 */

// Validation result type
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Validator function type
export type Validator = (value: string) => string | null;

/**
 * Sanitize a string to prevent XSS attacks.
 */
export function sanitizeString(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Sanitize HTML while allowing basic formatting tags.
 */
export function sanitizeHtml(input: string, allowedTags: string[] = []): string {
  const defaultAllowed = ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li', 'a'];
  const tags = allowedTags.length > 0 ? allowedTags : defaultAllowed;

  // Create a regex pattern for allowed tags
  const tagPattern = tags.join('|');
  const regex = new RegExp(`<(?!\/?(${tagPattern})(?:\s|>|\/|$))[^>]*>`, 'gi');

  // Remove disallowed tags
  let sanitized = input.replace(regex, '');

  // Remove dangerous attributes from allowed tags
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*javascript\s*:/gi, '');

  return sanitized;
}

/**
 * Validate email address format.
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!email) {
    errors.push('Email is required');
    return { valid: false, errors };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Please enter a valid email address');
  }

  if (email.length > 254) {
    errors.push('Email address is too long');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate password strength.
 */
export function validatePassword(password: string, options: {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumber?: boolean;
  requireSpecial?: boolean;
} = {}): ValidationResult {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSpecial = false,
  } = options;

  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (requireNumber && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (requireSpecial && !/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate username format.
 */
export function validateUsername(username: string): ValidationResult {
  const errors: string[] = [];

  if (!username) {
    errors.push('Username is required');
    return { valid: false, errors };
  }

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters');
  }

  if (username.length > 30) {
    errors.push('Username cannot exceed 30 characters');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  if (/^[_-]/.test(username) || /[_-]$/.test(username)) {
    errors.push('Username cannot start or end with underscore or hyphen');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate URL format.
 */
export function validateUrl(url: string, options: {
  requireProtocol?: boolean;
  allowedProtocols?: string[];
} = {}): ValidationResult {
  const {
    requireProtocol = true,
    allowedProtocols = ['http', 'https'],
  } = options;

  const errors: string[] = [];

  if (!url) {
    return { valid: true, errors }; // Empty URL is valid (not required)
  }

  try {
    const urlObj = new URL(url);

    if (requireProtocol && !allowedProtocols.includes(urlObj.protocol.replace(':', ''))) {
      errors.push(`URL must use ${allowedProtocols.join(' or ')} protocol`);
    }
  } catch {
    errors.push('Please enter a valid URL');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate text length.
 */
export function validateLength(text: string, options: {
  minLength?: number;
  maxLength?: number;
  fieldName?: string;
} = {}): ValidationResult {
  const {
    minLength = 0,
    maxLength = Infinity,
    fieldName = 'Field',
  } = options;

  const errors: string[] = [];
  const length = text.length;

  if (minLength > 0 && length < minLength) {
    errors.push(`${fieldName} must be at least ${minLength} characters`);
  }

  if (length > maxLength) {
    errors.push(`${fieldName} cannot exceed ${maxLength} characters`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate required field.
 */
export function validateRequired(value: unknown, fieldName: string = 'Field'): ValidationResult {
  const errors: string[] = [];

  if (value === null || value === undefined || value === '') {
    errors.push(`${fieldName} is required`);
  }

  if (Array.isArray(value) && value.length === 0) {
    errors.push(`${fieldName} is required`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Compose multiple validators.
 */
export function composeValidators(...validators: Validator[]): Validator {
  return (value: string) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) {
        return error;
      }
    }
    return null;
  };
}

/**
 * Create a required validator.
 */
export function required(fieldName: string = 'Field'): Validator {
  return (value: string) => {
    if (!value || value.trim() === '') {
      return `${fieldName} is required`;
    }
    return null;
  };
}

/**
 * Create a min length validator.
 */
export function minLength(length: number, fieldName: string = 'Field'): Validator {
  return (value: string) => {
    if (value && value.length < length) {
      return `${fieldName} must be at least ${length} characters`;
    }
    return null;
  };
}

/**
 * Create a max length validator.
 */
export function maxLength(length: number, fieldName: string = 'Field'): Validator {
  return (value: string) => {
    if (value && value.length > length) {
      return `${fieldName} cannot exceed ${length} characters`;
    }
    return null;
  };
}

/**
 * Create a pattern validator.
 */
export function pattern(regex: RegExp, message: string): Validator {
  return (value: string) => {
    if (value && !regex.test(value)) {
      return message;
    }
    return null;
  };
}

/**
 * Create an email validator.
 */
export function email(): Validator {
  return (value: string) => {
    if (value) {
      const result = validateEmail(value);
      return result.errors[0] || null;
    }
    return null;
  };
}

/**
 * Detect potential XSS in input.
 */
export function detectXss(input: string): boolean {
  const patterns = [
    /<script[^>]*>.*<\/script>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /data:\s*text\/html/i,
  ];

  return patterns.some(pattern => pattern.test(input));
}

/**
 * Validate file upload.
 */
export function validateFile(file: File, options: {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  allowedExtensions?: string[];
} = {}): ValidationResult {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [],
    allowedExtensions = [],
  } = options;

  const errors: string[] = [];

  if (file.size > maxSize) {
    const sizeMB = Math.round(maxSize / (1024 * 1024));
    errors.push(`File size cannot exceed ${sizeMB}MB`);
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }

  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExtensions.includes(extension)) {
      errors.push(`File extension .${extension} is not allowed`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize filename for safe storage.
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  let sanitized = filename.split(/[\\/]/).pop() || 'unnamed';

  // Remove dangerous characters
  sanitized = sanitized.replace(/[^\w.\-]/g, '_');

  // Prevent double extensions
  sanitized = sanitized.replace(/\.+/g, '.');

  // Remove leading dots
  sanitized = sanitized.replace(/^\.+/, '');

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() || '';
    const name = sanitized.substring(0, 250 - ext.length);
    sanitized = `${name}.${ext}`;
  }

  return sanitized || 'unnamed';
}
