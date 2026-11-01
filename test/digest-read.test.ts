import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const temps: string[] = [];
function tempRuns(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl into one row per job', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    if (night === null) return;
    expect(night.night).toBe('2026-10-28');
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const byJob = Object.fromEntries(night.rows.map((r) => [r.job, r]));

    expect(byJob['fixtures/refresh']).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(byJob['notes/backup']?.lastStatus).toBe('fail');
    expect(byJob['notes/backup']?.lastError).toBe('quota exceeded');
    expect(byJob['digest/render']?.owner).toBeNull();
    expect(byJob['lane/sync']).toMatchObject({
      runs: 8,
      retries: 1,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });

  it('returns null for a night with no file', () => {
    expect(readNight(tempRuns(), '2026-01-01')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    const dir = tempRuns();
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts wrong-shaped lines and ignores blank lines', () => {
    const dir = tempRuns();
    const lines = [
      '{"at":"t1","job":"a","status":"ok","owner":"x"}',
      '',
      '{"at":"t2","job":"a","status":"maybe","owner":"x"}',
      '{"at":"t3","job":"a","owner":"x"}',
      '[1,2]',
      'null',
      '{"at":"t4","job":"a","status":"retry","owner":5}',
    ];
    writeFileSync(join(dir, '2026-01-03.jsonl'), lines.join('\n') + '\n');
    const night = readNight(dir, '2026-01-03');
    expect(night?.badLines).toBe(5);
    expect(night?.rows).toHaveLength(1);
  });
});
