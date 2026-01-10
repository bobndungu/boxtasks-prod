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
