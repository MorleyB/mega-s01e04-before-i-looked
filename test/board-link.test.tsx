import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Reads the real runs/ fixtures (read-only). Counts checked against the files:
// 2026-10-28 has 16 lines, one unparseable, so 15 counted; 2026-10-27 has 7 ok lines.
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

function listItems(html: string): string[] {
  return [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1] ?? '');
}

function textOf(fragment: string): string {
  return fragment.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

describe('board link', () => {
  it('links each night to its digest with counts', async () => {
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);

    const items = listItems(html);
    const item28 = items.find((i) => i.includes('/digest/2026-10-28'));
    const item27 = items.find((i) => i.includes('/digest/2026-10-27'));
    expect(item28).toBeDefined();
    expect(item27).toBeDefined();
    expect(textOf(item28 ?? '')).toBe('2026-10-28 · ok 10 · retry 4 · fail 1');
    expect(textOf(item27 ?? '')).toBe('2026-10-27 · ok 7 · retry 0 · fail 0');
    expect(item28).toContain('<span class="warn">fail 1</span>');
    expect(item27).not.toContain('class="warn"');
  });

  it('every linked digest renders with 200', async () => {
    const app = createApp(config);
    const html = await (await app.request('/')).text();
    const hrefs = [...html.matchAll(/href="(\/digest\/\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1] ?? '');
    expect(hrefs.sort()).toEqual(['/digest/2026-10-27', '/digest/2026-10-28']);
    for (const href of hrefs) {
      const res = await app.request(href);
      expect(res.status).toBe(200);
    }
  });
});
