# MCP server build log

How the server was built, including what went wrong, on 2026-11-15.

1. **Language and SDK.** The site is TypeScript and the server reuses its
   data model (`src/data/model.ts`), so TypeScript. The v1 package
   `@modelcontextprotocol/sdk` 1.32.2 only speaks 2025-11-25; the v2 packages
   (`@modelcontextprotocol/server`, `client`, `core`, 2.4.0, released
   2026-10-23) implement spec 2026-07-28, so v2, pinned.
2. **Transport.** The skill's default is stdio. The user asked for a public
   URL as well, without login but rate limited, so the server has both:
   `serveStdio` for local use and `createMcpHandler` (stateless, one server
   per request) behind a Vercel function at `/mcp`. The reasoning is in
   `security.md`.
3. **Tools.** Nine read-only tools, each argument an enum built from the data
   or a bounded value. `registerTool` is called with the name and annotations
   written out in each call, so scanners that read source see them.
4. **Trap: `listChanged`.** The SDK advertises `tools.listChanged: true`
   unless `capabilities: { tools: { listChanged: false } }` is set. Found by
   the raw wire test.
5. **Trap: Host in tests.** A `Request` built in Node has no `Host` header,
   so the SDK's `hostHeaderValidationResponse` answered 403 to every
   in-process test. The check now falls back to the URL's host; Vercel always
   sends `Host`.
6. **Trap: shared caller key.** The first HTTP version kept the caller's IP
   in a module variable read by the per-request factory, which races under
   concurrent requests. The factory now reads the IP from its own
   `requestInfo`.
7. **Rate limit proven by its own test.** The test that calls the tool for
   all 56 parts hit the 30-call burst, and the 31st part failed. It now uses
   its own wide limiter.
8. **Preview hosts.** The Vercel team slug is `omerfsen-3850s-projects`, not
   the guessed `omerfsens-projects`; fixed before merge. Previews sit behind
   Vercel deployment protection (401), so the endpoint was first tested on
   production after merge.
9. **Live wire test.** A raw `curl` got 400: on HTTP the spec also requires
   the `MCP-Protocol-Version` and `Mcp-Method` headers. With them, every check
   passed, and the official SDK client passed `scripts/mcp-live.mjs`.
10. **Live rate limit.** 70 sequential requests got no 429 (the bucket
    refilled at 2/s while they ran); 150 parallel requests got 27 answers of
    429. The limit works per instance; see `security.md`.
