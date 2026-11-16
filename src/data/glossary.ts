import type { GlossaryTerm } from './types';

/** A run of panel text: plain, or a glossary term with the id of its entry. */
export type GlossaryPiece = { text: string; id?: string };

const WORD = /[A-Za-z0-9]/;

/**
 * Splits one block of text into plain runs and glossary terms. A term (or one
 * of its aliases) matches only as a whole word, with its exact case, and an
 * "s" plural ("BMCs", "PSUs") is part of the match. Each entry is marked at
 * its first occurrence in the block only; overlapping matches keep the
 * earliest (then the longest).
 */
export function splitGlossary(text: string, entries: readonly GlossaryTerm[]): GlossaryPiece[] {
  type Hit = { start: number; end: number; id: string };
  const hits: Hit[] = [];
  for (const e of entries) {
    let best: Hit | undefined;
    for (const word of [e.term, ...(e.aliases ?? [])]) {
      let from = 0;
      while (from <= text.length) {
        const at = text.indexOf(word, from);
        if (at < 0) break;
        let end = at + word.length;
        if (text[end] === 's' && !WORD.test(text[end + 1] ?? '')) end++;
        const before = text[at - 1] ?? '';
        const after = text[end] ?? '';
        if (!WORD.test(before) && !WORD.test(after)) {
          if (!best || at < best.start) best = { start: at, end, id: e.id };
          break;
        }
        from = at + 1;
      }
    }
    if (best) hits.push(best);
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const pieces: GlossaryPiece[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start < pos) continue;
    if (h.start > pos) pieces.push({ text: text.slice(pos, h.start) });
    pieces.push({ text: text.slice(h.start, h.end), id: h.id });
    pos = h.end;
  }
  if (pos < text.length || pieces.length === 0) pieces.push({ text: text.slice(pos) });
  return pieces;
}
