// server.json goes stale silently: check its settings against the code.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { SERVER_NAME, SERVER_VERSION, SITE } from '../mcp/server';

it('server.json matches the server', () => {
  const s = JSON.parse(readFileSync('server.json', 'utf8'));
  expect(s.name).toBe(SERVER_NAME);
  expect(s.version).toBe(SERVER_VERSION);
  expect(s.websiteUrl).toBe(SITE);
  expect(s.remotes).toEqual([{ type: 'streamable-http', url: `${SITE}mcp` }]);
  expect(s.description.length).toBeLessThanOrEqual(100);
  expect(s.repository.url).toBe('https://github.com/omerfsen/vera-rubin-nvl72-explorer');
});
