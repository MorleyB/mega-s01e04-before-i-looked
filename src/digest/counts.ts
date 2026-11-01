import { join } from 'node:path';
import { parseLine, readText } from './read.js';
import type { RunStatus } from './types.js';

export type StatusCounts = Record<RunStatus, number>;

// Counts well-formed run lines per status for one night. Bad and blank lines are skipped.
// Returns null when runs/<night>.jsonl does not exist.
export function countNight(runsDir: string, night: string): StatusCounts | null {
  const text = readText(join(runsDir, `${night}.jsonl`));
  if (text === null) return null;

  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line === null) continue;
    counts[line.status] += 1;
  }
  return counts;
}
