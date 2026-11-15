# Security

Please report a security problem privately through GitHub's
[private vulnerability reporting](https://github.com/omerfsen/vera-rubin-nvl72-explorer/security/advisories/new),
or by email to omerfsen@gmail.com. Do not open a public issue for it.

The site is static. The MCP server at `/mcp` is read-only over public data,
with no login and per-IP rate limits; its threat model and controls are in
[docs/mcp/security.md](docs/mcp/security.md).

Wrong facts are not security issues: open a normal issue with the NVIDIA
document section that disagrees.
