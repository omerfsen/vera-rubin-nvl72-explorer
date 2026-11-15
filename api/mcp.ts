// Vercel function for /mcp (rewritten to /api/mcp in vercel.json).
import { handle } from '../mcp/http.js';

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
