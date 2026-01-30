/**
 * Diff Utility Module
 *
 * Provides unified diff generation for comparing text content.
 * Used by both the diff tool (comparing two files) and the edit_file tool
 * (showing what changed after an edit).
 */

export interface DiffHunk {
  header: string;
  lines: string[];
}

/**
 * Compute Longest Common Subsequence table for two arrays of lines.
 * Returns the DP table used by generateDiffHunks to backtrack changes.
 */
export function computeLCS(lines1: string[], lines2: string[]): number[][] {
  const m = lines1.length;
  const n = lines2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0) as number[]);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (lines1[i - 1] === lines2[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  return dp;
}

/**
 * Generate diff hunks from two sets of lines using LCS backtracking.
 */
export function generateDiffHunks(
  lines1: string[],
  lines2: string[],
  dp: number[][],
  contextLines: number
): DiffHunk[] {
  // Backtrack to find differences
  const changes: Array<{ type: 'equal' | 'delete' | 'insert'; line1?: number; line2?: number }> =
    [];

  let i = lines1.length;
  let j = lines2.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && lines1[i - 1] === lines2[j - 1]) {
      changes.unshift({ type: 'equal', line1: i - 1, line2: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      changes.unshift({ type: 'insert', line2: j - 1 });
      j--;
    } else {
      changes.unshift({ type: 'delete', line1: i - 1 });
      i--;
    }
  }

  // Group changes into hunks with context
  const hunks: DiffHunk[] = [];
  let hunkStart = -1;
  let hunkLines: string[] = [];
  let line1Start = 0;
  let line2Start = 0;
  let line1Count = 0;
  let line2Count = 0;
  let lastChangeIdx = -contextLines - 1;

  for (let idx = 0; idx < changes.length; idx++) {
    const change = changes[idx]!;
    const isChange = change.type !== 'equal';
    const distanceFromLastChange = idx - lastChangeIdx;

    if (isChange) {
      // Helper to find line numbers by scanning changes from a start index
      const findLineNumbers = (startIdx: number): { line1: number; line2: number } => {
        let foundLine1: number | undefined;
        let foundLine2: number | undefined;
        for (let i = startIdx; i < changes.length && (foundLine1 === undefined || foundLine2 === undefined); i++) {
          const c = changes[i]!;
          if (foundLine1 === undefined && c.line1 !== undefined) {
            foundLine1 = c.line1;
          }
          if (foundLine2 === undefined && c.line2 !== undefined) {
            foundLine2 = c.line2;
          }
        }
        return { line1: foundLine1 ?? 0, line2: foundLine2 ?? 0 };
      };

      if (hunkStart === -1) {
        // Start new hunk with context
        hunkStart = Math.max(0, idx - contextLines);
        const lineNums = findLineNumbers(hunkStart);
        line1Start = lineNums.line1;
        line2Start = lineNums.line2;

        // Add leading context
        for (let c = hunkStart; c < idx; c++) {
          const ctx = changes[c]!;
          if (ctx.type === 'equal' && ctx.line1 !== undefined) {
            hunkLines.push(' ' + lines1[ctx.line1]);
            line1Count++;
            line2Count++;
          }
        }
      } else if (distanceFromLastChange > contextLines * 2) {
        // End current hunk and start new one
        // Add trailing context to current hunk
        for (let c = lastChangeIdx + 1; c <= Math.min(lastChangeIdx + contextLines, idx - 1); c++) {
          const ctx = changes[c]!;
          if (ctx.type === 'equal' && ctx.line1 !== undefined) {
            hunkLines.push(' ' + lines1[ctx.line1]);
            line1Count++;
            line2Count++;
          }
        }

        hunks.push({
          header: `@@ -${line1Start + 1},${line1Count} +${line2Start + 1},${line2Count} @@`,
          lines: hunkLines,
        });

        // Start new hunk
        hunkStart = idx - contextLines;
        hunkLines = [];
        const safeStart = Math.max(0, hunkStart);
        const lineNums = findLineNumbers(safeStart);
        line1Start = lineNums.line1;
        line2Start = lineNums.line2;
        line1Count = 0;
        line2Count = 0;

        // Add leading context
        for (let c = safeStart; c < idx; c++) {
          const ctx = changes[c]!;
          if (ctx.type === 'equal' && ctx.line1 !== undefined) {
            hunkLines.push(' ' + lines1[ctx.line1]);
            line1Count++;
            line2Count++;
          }
        }
      } else {
        // Fill gap with context
        for (let c = lastChangeIdx + 1; c < idx; c++) {
          const ctx = changes[c]!;
          if (ctx.type === 'equal' && ctx.line1 !== undefined) {
            hunkLines.push(' ' + lines1[ctx.line1]);
            line1Count++;
            line2Count++;
          }
        }
      }

      // Add the change
      if (change.type === 'delete' && change.line1 !== undefined) {
        hunkLines.push('-' + lines1[change.line1]);
        line1Count++;
      } else if (change.type === 'insert' && change.line2 !== undefined) {
        hunkLines.push('+' + lines2[change.line2]);
        line2Count++;
      }

      lastChangeIdx = idx;
    }
  }

  // Finalize last hunk
  if (hunkStart !== -1) {
    // Add trailing context
    for (
      let c = lastChangeIdx + 1;
      c <= Math.min(lastChangeIdx + contextLines, changes.length - 1);
      c++
    ) {
      const ctx = changes[c]!;
      if (ctx.type === 'equal' && ctx.line1 !== undefined) {
        hunkLines.push(' ' + lines1[ctx.line1]);
        line1Count++;
        line2Count++;
      }
    }

    hunks.push({
      header: `@@ -${line1Start + 1},${line1Count} +${line2Start + 1},${line2Count} @@`,
      lines: hunkLines,
    });
  }

  return hunks;
}

/**
 * Generate a unified diff string from two content strings.
 *
 * This is a convenience function for comparing content before/after an edit.
 * The label parameters are used in the diff header (e.g., file path).
 */
export function generateUnifiedDiff(
  oldContent: string,
  newContent: string,
  options: {
    oldLabel?: string;
    newLabel?: string;
    contextLines?: number;
  } = {}
): { diff: string; hunks: DiffHunk[]; hasChanges: boolean } {
  const { oldLabel = 'a', newLabel = 'b', contextLines = 3 } = options;

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const lcs = computeLCS(oldLines, newLines);
  const hunks = generateDiffHunks(oldLines, newLines, lcs, contextLines);

  if (hunks.length === 0) {
    return { diff: '', hunks: [], hasChanges: false };
  }

  const diffLines: string[] = [];
  diffLines.push(`--- ${oldLabel}`);
  diffLines.push(`+++ ${newLabel}`);

  for (const hunk of hunks) {
    diffLines.push(hunk.header);
    diffLines.push(...hunk.lines);
  }

  return {
    diff: diffLines.join('\n'),
    hunks,
    hasChanges: true,
  };
}
