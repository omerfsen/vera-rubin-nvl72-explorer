# MCP server security

The server answers questions from `data/nvl72-topology.json`, the same public
file the site serves at `/data/nvl72-topology.json`. It reads nothing else,
writes nothing, calls no other service and holds no secrets or user data.

## Threat model

| Asset | Threat | Path |
| --- | --- | --- |
| Availability of `/mcp` and the Vercel bill | Floods of requests or tool calls | Public URL, no login |
| The host it runs on | Path traversal or code execution through tool arguments | A prompt-injected model calling tools with hostile values |
| Users' browsers | DNS rebinding or a hostile page driving the endpoint | Browser `fetch` from another origin |
| Answers people trust | Wrong facts presented as NVIDIA's | Data errors; hostile text in the data |
| The build | A compromised dependency | npm, GitHub Actions |

A prompt-injected model is the main attacker: it can call any tool, in any
order, with any arguments. The answer to "how little can it do when it goes
wrong" is: read public JSON that is already on the site.

## Transport and authentication

The skill's default is stdio, and HTTP only with real authentication. This
server breaks that default on purpose, and the conditions below are what make
that safe:

- every tool is read-only and returns only public data;
- there is no user data, session, token or secret to protect;
- the endpoint is stateless (a fresh server per request);
- requests and tool calls are rate limited per IP, Host and Origin are
  checked, and the body is capped.

If a tool ever needs private data or can change something, this decision no
longer holds: such a tool needs authentication, and stdio stays the default.

## Controls and the tests that prove them

| Control | Where | Proof |
| --- | --- | --- |
| Every argument is an enum built from the data, a bounded integer or a string of at most 80 characters; unknown fields refused (`.strict()`) | `mcp/server.ts` | `tests/mcp.test.ts` "hostile arguments are refused" (path traversal, extra keys, empty, too long, out of range); `scripts/mcp-wire.mjs` on the bundle |
| No file paths, shell, network calls or writes in any tool | `mcp/server.ts` | Code review; the only input file is bundled at build time |
| Read and write separated; all nine tools carry `readOnlyHint: true`, `destructiveHint: false` | `mcp/server.ts` | `tests/mcp.test.ts` "lists nine read-only tools" |
| Rate limit on tool calls, per caller (stdio: 30 then 5/s; HTTP: 30 then 1/s per IP) | `mcp/ratelimit.ts`, `createServer` | `tests/mcp.test.ts` "a tool call over the limit comes back as an error" |
| Rate limit on HTTP requests per IP (60 then 2/s), 429 with `Retry-After` | `mcp/http.ts` | `tests/mcp.test.ts` "answers 429"; live burst in `test-results/` |
| Host allowlist (the two domains, this project's Vercel URLs, localhost) | `mcp/http.ts` | `tests/mcp.test.ts` "refuses a foreign Host or Origin" |
| Origin must be one of the same hosts when present (non-browser clients send none) | `mcp/http.ts` via the SDK's `originValidationResponse` | Same test; live `403` in `test-results/` |
| Body capped at 64 KiB, and at most 16 argument elements per call | `mcp/http.ts`, `maxToolInputElements` | `tests/mcp.test.ts` "refuses a body over 64 KiB" |
| POST only; GET and DELETE answer 405 | `mcp/http.ts` | `tests/mcp.test.ts` "takes POST only"; live check |
| SDK errors are logged on the server, not returned; tool errors name the next step | `onerror`, `fail()` | `tests/mcp.test.ts` |
| stdout carries only JSON-RPC; the process exits when stdin closes | `mcp/stdio.ts` | `scripts/mcp-wire.mjs` |
| Dependencies pinned to exact versions, lockfile committed, SDK at least two weeks old when chosen | `package.json` | `npm ci` in CI |

## Hostile text

The data is written in this repo from NVIDIA's documents and reviewed in pull
requests; no tool returns text from a third party or from another caller. So
answers are not fenced with per-call markers, as a server that relays logs or
events would need. Wrong facts are the real risk to answers, and every fact
carries its NVIDIA source, and `"assumed": true` where the documents do not
state it, so a reader can check it.

## Known limits

- **The rate limit is per instance on Vercel.** Buckets live in memory, and
  Vercel spreads a burst over several instances: a live burst of 150 parallel
  requests got 27 answers of 429, not 90. A Vercel Firewall rate-limit rule
  on `/mcp` would enforce one limit across instances. It is not set up, as it
  is a project setting with its own cost.
- **Client IP comes from Vercel's `x-real-ip` / `x-forwarded-for`**, which
  Vercel sets; it is trusted only because the function runs behind Vercel.
- **Preview deployments are behind Vercel's deployment protection**, so
  `/mcp` on a preview URL answers 401 to anyone not signed in to Vercel.
