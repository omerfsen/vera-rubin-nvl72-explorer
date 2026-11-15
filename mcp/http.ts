/**
 * Public HTTP entry, mounted by api/mcp.ts on Vercel. Stateless: a fresh
 * server per request. Checks run before the SDK sees the request: method,
 * Host, Origin, body size and a per-IP rate limit.
 */
import { createMcpHandler, originValidationResponse } from '@modelcontextprotocol/server';
import { RateLimiter } from './ratelimit.js';
import { createServer } from './server.js';

export const ALLOWED_HOSTS = ['verarubin-nvl72.faruk.net', 'vr-nvl72.faruk.net', 'vera-rubin-nvl72-explorer.vercel.app', 'localhost', '127.0.0.1'];
/** Vercel preview URLs of this project only. */
const PREVIEW = /^vera-rubin-nvl72-explorer-[a-z0-9-]+-omerfsen-3850s-projects\.vercel\.app$/;
export const MAX_BODY = 64 * 1024;

/** Per-IP request limit at the edge of the handler: 60 at once, then 2 per second. */
const requests = new RateLimiter({ capacity: 60, refillPerSecond: 2 });
/** Per-IP tool-call limit, shared by every per-request server. */
const tools = new RateLimiter({ capacity: 30, refillPerSecond: 1 });

const handler = createMcpHandler(({ requestInfo }) => createServer({ limiter: tools, rateKey: requestInfo ? clientIp(requestInfo) : 'unknown' }), {
  responseMode: 'json',
  maxRequestBodySize: MAX_BODY,
  onerror: (e) => console.error('mcp error:', e.message),
});

const text = (status: number, body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...headers } });

/** Client IP as Vercel reports it. */
export function clientIp(req: Request): string {
  return (req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown').trim().slice(0, 64);
}

export async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return text(405, 'This MCP endpoint takes POST only. Add https://verarubin-nvl72.faruk.net/mcp to an MCP client as a Streamable HTTP server.', { allow: 'POST' });
  }
  // Vercel always sends Host; a Request built in process may not, so fall back to the URL.
  const host = (req.headers.get('host') ?? new URL(req.url).host).split(':')[0]!.toLowerCase();
  const hosts = PREVIEW.test(host) ? [...ALLOWED_HOSTS, host] : ALLOWED_HOSTS;
  if (!hosts.includes(host)) return text(403, 'Unknown host.');
  const badOrigin = originValidationResponse(req, hosts);
  if (badOrigin) return badOrigin;
  const length = Number(req.headers.get('content-length') ?? '0');
  if (length > MAX_BODY) return text(413, `Request body over ${MAX_BODY} bytes.`);
  const ip = clientIp(req);
  const wait = requests.take(ip);
  if (wait > 0) return text(429, 'Too many requests.', { 'retry-after': String(Math.ceil(wait / 1000)) });
  return handler.fetch(req);
}
