import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const GOOD = '2026-01-01';
const EMPTY = '2026-01-02';
const BAD = '2026-01-03';
const MISSING = '2026-01-04';

const l = (o: object) => JSON.stringify(o);
const goodLines = [
  l({ at: '2026-01-01T01:00:00+01:00', job: 'zeta', status: 'ok', owner: 'ana' }),
  l({ at: '2026-01-01T01:05:00+01:00', job: 'alpha', status: 'retry', owner: null }),
  l({ at: '2026-01-01T01:10:00+01:00', job: 'alpha', status: 'fail', owner: null, error: 'boom' }),
  l({ at: '2026-01-01T02:00:00+01:00', job: 'mid', status: 'ok', owner: 'bo' }),
];
const badLines = [
  l({ at: '2026-01-03T01:00:00+01:00', job: 'b-job', status: 'ok', owner: 'cy' }),
  'this is not json',
  l({ at: '2026-01-03T02:00:00+01:00', job: 'a-job', status: 'ok', owner: null }),
];

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-runs-'));
  fs.writeFileSync(path.join(dir, `${GOOD}.jsonl`), goodLines.join('\n') + '\n');
  fs.writeFileSync(path.join(dir, `${EMPTY}.jsonl`), '');
  fs.writeFileSync(path.join(dir, `${BAD}.jsonl`), badLines.join('\n') + '\n');
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  });
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const page = async (night: string) => {
  const res = await app.request(`/digest/${night}`);
  return { res, html: await res.text() };
};
const api = async (night: string) => {
  const res = await app.request(`/api/digest/${night}`);
  return { res, json: (await res.json()) as Night };
};

describe('GET /digest/:night', () => {
  it('200 for a good night, with the fail row and a dash for null owner', async () => {
    const { res, html } = await page(GOOD);
    expect(res.status).toBe(200);
    expect(html).toContain('boom');
    expect(html).toContain('—');
    expect(html).not.toContain('did not parse');
  });

  it('404 for a night with no file', async () => {
    expect((await page(MISSING)).res.status).toBe(404);
  });

  it('shows "nothing ran" for the empty night', async () => {
    const { res, html } = await page(EMPTY);
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('still 200 with a did-not-parse line for the bad-line night', async () => {
    const { res, html } = await page(BAD);
    expect(res.status).toBe(200);
    expect(html).toContain('1 line(s) did not parse');
    expect(html).toContain('a-job');
    expect(html).toContain('b-job');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 for a good night', async () => {
    const { res, json } = await api(GOOD);
    expect(res.status).toBe(200);
    expect(json.night).toBe(GOOD);
    expect(json.badLines).toBe(0);
    expect(json.rows.map((r) => r.job)).toEqual(['alpha', 'mid', 'zeta']);
    const alpha = json.rows[0];
    expect(alpha?.owner).toBeNull();
    expect(alpha?.lastStatus).toBe('fail');
    expect(alpha?.retries).toBe(1);
  });

  it('404 for a night with no file', async () => {
    const { res } = await api(MISSING);
    expect(res.status).toBe(404);
  });

  it('empty night gives rows []', async () => {
    const { res, json } = await api(EMPTY);
    expect(res.status).toBe(200);
    expect(json.rows).toEqual([]);
  });

  it('bad-line night is 200 with badLines 1', async () => {
    const { res, json } = await api(BAD);
    expect(res.status).toBe(200);
    expect(json.badLines).toBe(1);
    expect(json.rows).toHaveLength(2);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order for the good night', async () => {
    const { html } = await page(GOOD);
    const { json } = await api(GOOD);
    const fromPage = [...html.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => m[1]);
    expect(fromPage).toEqual(json.rows.map((r) => r.job));
    expect(fromPage).toHaveLength(3);
  });
});
