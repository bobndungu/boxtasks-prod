import React from 'react';

interface DiffPart {
  type: 'unchanged' | 'removed' | 'added';
  value: string;
}

/**
 * Compute a word-level diff between two strings.
 * Uses LCS algorithm to find common words and identify changes.
 */
export function computeWordDiff(oldText: string, newText: string): DiffPart[] {
  // Split into words (non-whitespace sequences)
  const oldWords = oldText.split(/\s+/).filter(w => w.length > 0);
  const newWords = newText.split(/\s+/).filter(w => w.length > 0);

  // Build LCS table
  const m = oldWords.length;
  const n = newWords.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffPart[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      // Common word
      result.unshift({ type: 'unchanged', value: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // Word added in new
      result.unshift({ type: 'added', value: newWords[j - 1] });
      j--;
    } else if (i > 0) {
      // Word removed from old
      result.unshift({ type: 'removed', value: oldWords[i - 1] });
      i--;
    }
  }

  return mergeConsecutive(result);
}

/**
 * Merge consecutive parts of the same type.
 */
function mergeConsecutive(parts: DiffPart[]): DiffPart[] {
  if (parts.length === 0) return parts;

  const result: DiffPart[] = [{ ...parts[0] }];

  for (let i = 1; i < parts.length; i++) {
    const last = result[result.length - 1];
    if (last.type === parts[i].type) {
      last.value += ' ' + parts[i].value;
    } else {
      result.push({ ...parts[i] });
    }
  }

  return result;
}

/**
 * Render a word diff as React elements with proper spacing.
 */
export function renderWordDiff(oldText: string, newText: string): React.ReactNode {
  const parts = computeWordDiff(oldText, newText);

  return (
    <>
      {parts.map((part, index) => {
        const needsSpaceBefore = index > 0;

        if (part.type === 'removed') {
          return (
            <React.Fragment key={index}>
              {needsSpaceBefore && ' '}
              <span className="bg-red-100 text-red-700 line-through">{part.value}</span>
            </React.Fragment>
          );
        } else if (part.type === 'added') {
          return (
            <React.Fragment key={index}>
              {needsSpaceBefore && ' '}
              <span className="bg-green-100 text-green-700">{part.value}</span>
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={index}>
              {needsSpaceBefore && ' '}
              <span>{part.value}</span>
            </React.Fragment>
          );
        }
      })}
    </>
  );
}
