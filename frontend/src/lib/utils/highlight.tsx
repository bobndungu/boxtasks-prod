import React from 'react';

/**
 * Highlights matching text within a string.
 * Returns a React node with the matching parts wrapped in <mark> tags.
 */
export function highlightText(
  text: string,
  query: string,
  highlightClass: string = 'bg-yellow-200 text-yellow-900 rounded px-0.5'
): React.ReactNode {
  if (!query.trim()) {
    return text;
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);

  if (parts.length === 1) {
    return text;
  }

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === query.toLowerCase();
        return isMatch ? (
          <mark key={index} className={highlightClass}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        );
      })}
    </>
  );
}

/**
 * Component for rendering highlighted text.
 */
export function HighlightedText({
  text,
  query,
  className,
  highlightClass,
}: {
  text: string;
  query: string;
  className?: string;
  highlightClass?: string;
}) {
  return (
    <span className={className}>
      {highlightText(text, query, highlightClass)}
    </span>
  );
}

/**
 * Renders text with @mentions highlighted.
 * Mentions are styled with a blue background to make them stand out.
 *
 * @param text - The text containing @mentions
 * @param mentionClass - CSS class for the mention highlight (default: blue pill style)
 * @returns React node with mentions highlighted
 */
export function renderTextWithMentions(
  text: string,
  mentionClass: string = 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1 py-0.5 rounded font-medium'
): React.ReactNode {
  if (!text) {
    return text;
  }

  // Match @mentions (e.g., @Brian Muuo, @John)
  // This regex matches @ followed by one or more words (name parts)
  const mentionRegex = /(@[\w]+(?:\s+[\w]+)*)/g;
  const parts = text.split(mentionRegex);

  if (parts.length === 1) {
    return text;
  }

  return (
    <>
      {parts.map((part, index) => {
        const isMention = part.startsWith('@');
        return isMention ? (
          <span key={index} className={mentionClass}>
            {part}
          </span>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        );
      })}
    </>
  );
}

/**
 * Component for rendering text with @mentions highlighted.
 */
export function TextWithMentions({
  text,
  className,
  mentionClass,
}: {
  text: string;
  className?: string;
  mentionClass?: string;
}) {
  return (
    <span className={className}>
      {renderTextWithMentions(text, mentionClass)}
    </span>
  );
}
