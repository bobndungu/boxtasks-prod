/**
 * Date utilities with East Africa Time (EAT) timezone support
 * All date formatting functions use Africa/Nairobi timezone (UTC+3)
 */

export const EAT_TIMEZONE = 'Africa/Nairobi';

/**
 * Format options for different date display needs
 */
export const DATE_FORMATS = {
  short: { month: 'short', day: 'numeric' } as Intl.DateTimeFormatOptions,
  medium: { month: 'short', day: 'numeric', year: 'numeric' } as Intl.DateTimeFormatOptions,
  long: { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' } as Intl.DateTimeFormatOptions,
  time: { hour: 'numeric', minute: '2-digit', hour12: true } as Intl.DateTimeFormatOptions,
  dateTime: { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true } as Intl.DateTimeFormatOptions,
  full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true } as Intl.DateTimeFormatOptions,
};

/**
 * Format a date string or Date object to EAT timezone
 */
export function formatDate(
  date: string | Date | null | undefined,
  format: keyof typeof DATE_FORMATS | Intl.DateTimeFormatOptions = 'medium'
): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return '';

  const options: Intl.DateTimeFormatOptions = typeof format === 'string'
    ? { ...DATE_FORMATS[format], timeZone: EAT_TIMEZONE }
    : { ...format, timeZone: EAT_TIMEZONE };

  return dateObj.toLocaleString('en-US', options);
}

/**
 * Format a date for display (short format: "Jan 15")
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  return formatDate(date, 'short');
}

/**
 * Format a date for display (medium format: "Jan 15, 2026")
 */
export function formatDateMedium(date: string | Date | null | undefined): string {
  return formatDate(date, 'medium');
}

/**
 * Format a date with time (dateTime format: "Jan 15, 2026, 3:30 PM")
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, 'dateTime');
}

/**
 * Format time only (time format: "3:30 PM")
 */
export function formatTime(date: string | Date | null | undefined): string {
  return formatDate(date, 'time');
}

/**
 * Format a date for full display (full format: "Wednesday, January 15, 2026, 3:30 PM")
 */
export function formatDateFull(date: string | Date | null | undefined): string {
  return formatDate(date, 'full');
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 0) {
    // Future date
    const absDiffDays = Math.abs(diffDays);
    const absDiffHours = Math.abs(diffHours);
    const absDiffMinutes = Math.abs(diffMinutes);

    if (absDiffDays > 0) return `in ${absDiffDays}d`;
    if (absDiffHours > 0) return `in ${absDiffHours}h`;
    if (absDiffMinutes > 0) return `in ${absDiffMinutes}m`;
    return 'now';
  }

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return 'just now';
}

/**
 * Check if a date is today (in EAT timezone)
 */
export function isToday(date: string | Date | null | undefined): boolean {
  if (!date) return false;

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return false;

  const today = new Date();
  const dateInEAT = new Date(dateObj.toLocaleString('en-US', { timeZone: EAT_TIMEZONE }));
  const todayInEAT = new Date(today.toLocaleString('en-US', { timeZone: EAT_TIMEZONE }));

  return dateInEAT.toDateString() === todayInEAT.toDateString();
}

/**
 * Check if a date is in the past (in EAT timezone)
 */
export function isPast(date: string | Date | null | undefined): boolean {
  if (!date) return false;

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return false;

  return dateObj.getTime() < new Date().getTime();
}

/**
 * Check if a date is overdue (past and not today)
 */
export function isOverdue(date: string | Date | null | undefined): boolean {
  return isPast(date) && !isToday(date);
}

/**
 * Format a date for API submission (ISO string)
 * Note: This keeps the date in UTC for API consistency
 */
export function toAPIDate(date: Date | null | undefined): string | null {
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Format a date for Drupal datetime field (RFC 3339 format with EAT timezone)
 */
export function toDrupalDateTime(date: Date | null | undefined): string | null {
  if (!date || isNaN(date.getTime())) return null;

  // Format as ISO string but with +03:00 offset for EAT
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`;
}

/**
 * Get current date/time in EAT timezone
 */
export function nowInEAT(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: EAT_TIMEZONE }));
}

/**
 * Parse a date string and return a Date object
 */
export function parseDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;

  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format a date with time first, then day and month (e.g., "9:00 PM - 15 Jan 2026")
 */
export function formatDateTimeCompact(date: string | Date | null | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';

  const timeStr = dateObj.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: EAT_TIMEZONE,
  });

  const dateStr = dateObj.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: EAT_TIMEZONE,
  });

  return `${timeStr} - ${dateStr}`;
}

/**
 * Format a date with time, without year (e.g., "9:00 PM - 15 Jan")
 * Used for board view where space is limited
 */
export function formatDateTimeCompactNoYear(date: string | Date | null | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';

  const timeStr = dateObj.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: EAT_TIMEZONE,
  });

  const dateStr = dateObj.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: EAT_TIMEZONE,
  });

  return `${timeStr} - ${dateStr}`;
}

/**
 * Format just the date portion (e.g., "15 Jan 2026")
 */
export function formatDateCompact(date: string | Date | null | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';

  return dateObj.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: EAT_TIMEZONE,
  });
}

/**
 * Format just the date portion without year (e.g., "15 Jan")
 * Used for board view where space is limited
 */
export function formatDateCompactNoYear(date: string | Date | null | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';

  return dateObj.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: EAT_TIMEZONE,
  });
}

/**
 * Check if two dates are on the same day (in EAT timezone)
 */
export function isSameDay(date1: string | Date | null | undefined, date2: string | Date | null | undefined): boolean {
  if (!date1 || !date2) return false;

  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;

  const d1Str = d1.toLocaleDateString('en-US', { timeZone: EAT_TIMEZONE });
  const d2Str = d2.toLocaleDateString('en-US', { timeZone: EAT_TIMEZONE });

  return d1Str === d2Str;
}

/**
 * Format a smart date range for cards with both start and due dates
 * - Same day: "4:00 PM - 7:00 PM on 15 Jan 2026"
 * - Different days: shows separate formatted dates
 */
export function formatDateRange(
  startDate: string | Date | null | undefined,
  dueDate: string | Date | null | undefined
): { combined: boolean; display: string } | null {
  if (!startDate || !dueDate) return null;

  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;

  if (isNaN(start.getTime()) || isNaN(due.getTime())) return null;

  // Check if same day
  if (isSameDay(start, due)) {
    const startTime = start.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: EAT_TIMEZONE,
    });

    const dueTime = due.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: EAT_TIMEZONE,
    });

    const dateStr = due.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: EAT_TIMEZONE,
    });

    return {
      combined: true,
      display: `${startTime} - ${dueTime} on ${dateStr}`,
    };
  }

  return null;
}

/**
 * Format a smart date range without year (for board view)
 * - Same day with times: "4:00 PM - 7:00 PM, 15 Jan"
 * - Different days, same month: "15 - 20 Jan" or "15 Jan 4PM - 20 Jan 7PM"
 * - Different days, different months: "15 Jan - 20 Feb"
 */
export function formatDateRangeNoYear(
  startDate: string | Date | null | undefined,
  dueDate: string | Date | null | undefined
): { combined: boolean; display: string } | null {
  if (!startDate || !dueDate) return null;

  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;

  if (isNaN(start.getTime()) || isNaN(due.getTime())) return null;

  // Check if dates have meaningful times (not midnight)
  const startHasTime = start.getHours() !== 0 || start.getMinutes() !== 0;
  const dueHasTime = due.getHours() !== 0 || due.getMinutes() !== 0;

  // Get date parts in EAT timezone
  const startDay = parseInt(start.toLocaleString('en-US', { day: 'numeric', timeZone: EAT_TIMEZONE }));
  const startMonth = start.toLocaleString('en-US', { month: 'short', timeZone: EAT_TIMEZONE });
  const dueDay = parseInt(due.toLocaleString('en-US', { day: 'numeric', timeZone: EAT_TIMEZONE }));
  const dueMonth = due.toLocaleString('en-US', { month: 'short', timeZone: EAT_TIMEZONE });

  // Check if same day
  if (isSameDay(start, due)) {
    if (startHasTime && dueHasTime) {
      const startTime = start.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: EAT_TIMEZONE,
      });

      const dueTime = due.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: EAT_TIMEZONE,
      });

      return {
        combined: true,
        display: `${startTime} - ${dueTime}, ${startDay} ${startMonth}`,
      };
    }
    // Same day but no times - just return null, will show single date
    return null;
  }

  // Different days - create a smart range
  const sameMonth = startMonth === dueMonth;

  if (startHasTime || dueHasTime) {
    // At least one has time - show compact format with times
    const startTimeStr = startHasTime
      ? start.toLocaleString('en-US', { hour: 'numeric', hour12: true, timeZone: EAT_TIMEZONE }).replace(' ', '')
      : '';
    const dueTimeStr = dueHasTime
      ? due.toLocaleString('en-US', { hour: 'numeric', hour12: true, timeZone: EAT_TIMEZONE }).replace(' ', '')
      : '';

    if (sameMonth) {
      // Same month: "15 4PM - 20 7PM Jan"
      const startPart = startHasTime ? `${startDay} ${startTimeStr}` : `${startDay}`;
      const duePart = dueHasTime ? `${dueDay} ${dueTimeStr}` : `${dueDay}`;
      return {
        combined: true,
        display: `${startPart} - ${duePart} ${startMonth}`,
      };
    } else {
      // Different months: "15 Jan 4PM - 20 Feb 7PM"
      const startPart = startHasTime ? `${startDay} ${startMonth} ${startTimeStr}` : `${startDay} ${startMonth}`;
      const duePart = dueHasTime ? `${dueDay} ${dueMonth} ${dueTimeStr}` : `${dueDay} ${dueMonth}`;
      return {
        combined: true,
        display: `${startPart} - ${duePart}`,
      };
    }
  } else {
    // No times - simple date range
    if (sameMonth) {
      // Same month: "15 - 20 Jan"
      return {
        combined: true,
        display: `${startDay} - ${dueDay} ${startMonth}`,
      };
    } else {
      // Different months: "15 Jan - 20 Feb"
      return {
        combined: true,
        display: `${startDay} ${startMonth} - ${dueDay} ${dueMonth}`,
      };
    }
  }
}
