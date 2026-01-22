/**
 * Decode HTML entities in a string.
 *
 * Drupal's JSON:API and custom API endpoints return HTML-encoded text
 * (e.g., &#039; for apostrophes, &quot; for quotes, &amp; for ampersands).
 * This utility decodes them back to their original characters.
 *
 * @param text - The text with HTML entities to decode
 * @returns The decoded text
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;

  // Use textarea trick for safe HTML entity decoding
  // This is secure because we only extract the text value, never render HTML
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Decode HTML entities in a string, with null/undefined safety.
 * Returns the original value if it's null or undefined.
 */
export function decodeHtmlEntitiesSafe(text: string | null | undefined): string | null | undefined {
  if (text === null || text === undefined) return text;
  return decodeHtmlEntities(text);
}
