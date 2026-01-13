import { useMemo } from 'react';

interface ActivityDiffProps {
  oldText: string;
  newText: string;
  fieldName?: string;
  showInline?: boolean;
}

interface DiffSegment {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
}

// Simple diff algorithm that finds common subsequences
function computeDiff(oldText: string, newText: string): DiffSegment[] {
  const segments: DiffSegment[] = [];

  // If one is empty, the whole other is added/removed
  if (!oldText && newText) {
    return [{ type: 'added', text: newText }];
  }
  if (oldText && !newText) {
    return [{ type: 'removed', text: oldText }];
  }
  if (!oldText && !newText) {
    return [];
  }

  // Word-based diff
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  // LCS-based diff algorithm
  const lcs = computeLCS(oldWords, newWords);

  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldWords.length || newIdx < newWords.length) {
    // If we've used all LCS items
    if (lcsIdx >= lcs.length) {
      // Everything remaining in old is removed
      if (oldIdx < oldWords.length) {
        segments.push({
          type: 'removed',
          text: oldWords.slice(oldIdx).join(''),
        });
      }
      // Everything remaining in new is added
      if (newIdx < newWords.length) {
        segments.push({
          type: 'added',
          text: newWords.slice(newIdx).join(''),
        });
      }
      break;
    }

    const lcsWord = lcs[lcsIdx];

    // Skip removed words (in old but not in LCS at current position)
    const removedWords: string[] = [];
    while (oldIdx < oldWords.length && oldWords[oldIdx] !== lcsWord) {
      removedWords.push(oldWords[oldIdx]);
      oldIdx++;
    }
    if (removedWords.length > 0) {
      segments.push({ type: 'removed', text: removedWords.join('') });
    }

    // Skip added words (in new but not in LCS at current position)
    const addedWords: string[] = [];
    while (newIdx < newWords.length && newWords[newIdx] !== lcsWord) {
      addedWords.push(newWords[newIdx]);
      newIdx++;
    }
    if (addedWords.length > 0) {
      segments.push({ type: 'added', text: addedWords.join('') });
    }

    // Add the common word
    if (oldIdx < oldWords.length && newIdx < newWords.length) {
      segments.push({ type: 'unchanged', text: oldWords[oldIdx] });
      oldIdx++;
      newIdx++;
      lcsIdx++;
    }
  }

  // Merge consecutive segments of same type
  return mergeSegments(segments);
}

// Compute Longest Common Subsequence
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

// Merge consecutive segments of the same type
function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  if (segments.length === 0) return [];

  const merged: DiffSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    if (segments[i].type === current.type) {
      current.text += segments[i].text;
    } else {
      merged.push(current);
      current = { ...segments[i] };
    }
  }
  merged.push(current);

  return merged;
}

export default function ActivityDiff({
  oldText,
  newText,
  fieldName,
  showInline = true,
}: ActivityDiffProps) {
  const diffSegments = useMemo(
    () => computeDiff(oldText || '', newText || ''),
    [oldText, newText]
  );

  // No changes
  if (diffSegments.length === 0) {
    return null;
  }

  // All same type means complete replacement
  const isCompleteReplacement =
    diffSegments.length === 2 &&
    diffSegments[0].type === 'removed' &&
    diffSegments[1].type === 'added';

  if (showInline) {
    return (
      <div className="mt-2 text-sm">
        {fieldName && (
          <span className="text-gray-500 dark:text-gray-400 font-medium mr-2">
            {fieldName}:
          </span>
        )}
        <div className="inline-flex flex-wrap gap-1 items-baseline">
          {isCompleteReplacement ? (
            <>
              <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded line-through">
                {diffSegments[0].text}
              </span>
              <span className="text-gray-400 dark:text-gray-500 mx-1">→</span>
              <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
                {diffSegments[1].text}
              </span>
            </>
          ) : (
            diffSegments.map((segment, index) => {
              if (segment.type === 'unchanged') {
                return (
                  <span key={index} className="text-gray-700 dark:text-gray-300">
                    {segment.text}
                  </span>
                );
              }
              if (segment.type === 'removed') {
                return (
                  <span
                    key={index}
                    className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through"
                  >
                    {segment.text}
                  </span>
                );
              }
              if (segment.type === 'added') {
                return (
                  <span
                    key={index}
                    className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  >
                    {segment.text}
                  </span>
                );
              }
              return null;
            })
          )}
        </div>
      </div>
    );
  }

  // Side-by-side view for longer content
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
      {fieldName && (
        <div className="col-span-2 text-gray-500 dark:text-gray-400 font-medium">
          {fieldName}
        </div>
      )}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
        <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">
          Before
        </div>
        <div className="text-red-700 dark:text-red-300">
          {oldText || <span className="italic text-gray-400">(empty)</span>}
        </div>
      </div>
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2">
        <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
          After
        </div>
        <div className="text-green-700 dark:text-green-300">
          {newText || <span className="italic text-gray-400">(empty)</span>}
        </div>
      </div>
    </div>
  );
}

// Export for use in activity descriptions
export function formatDiffDescription(
  oldValue: string | null | undefined,
  newValue: string | null | undefined,
  fieldName: string
): string {
  const old = oldValue || '(empty)';
  const newVal = newValue || '(empty)';
  return `Changed ${fieldName} from "${old}" to "${newVal}"`;
}
