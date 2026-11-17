import type { ChangelogEntry } from './types';

export type NvidiaDocument = 'user-guide' | 'service-manual';

/** Which NVIDIA document a docs.nvidia.com URL belongs to. */
export function documentOf(url: string): NvidiaDocument | null {
  if (url.includes('/dgxvr-user-guide/')) return 'user-guide';
  if (url.includes('/dgxvr-service-manual/')) return 'service-manual';
  return null;
}

/** Newest first; entries of the same day keep the order of the data file. */
export function sortedChangelog(entries: readonly ChangelogEntry[]): ChangelogEntry[] {
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.date === b.e.date ? a.i - b.i : a.e.date < b.e.date ? 1 : -1))
    .map((x) => x.e);
}

/** The newest entry that followed this document, or undefined. */
export function newestFor(entries: readonly ChangelogEntry[], document: NvidiaDocument): ChangelogEntry | undefined {
  return sortedChangelog(entries).find((e) => e.document === document);
}

export interface Fingerprint {
  title: string;
  url: string;
  sha256: string;
  lastModified: string;
}

const DAY_MS = 86_400_000;

/**
 * Why the changelog is behind a fingerprint, or null when it is not. The
 * newest entry for the document must name the fingerprint's SHA-256. Its
 * document date is the one NVIDIA prints (meta.document.date), which can be a
 * day off the PDF's Last-Modified header read in UTC, so the date only fails
 * when the PDF is more than one day newer than the entry says.
 */
export function changelogGap(entries: readonly ChangelogEntry[], fp: Fingerprint): string | null {
  const document = documentOf(fp.url);
  if (!document) return `${fp.url} is not one of the two NVIDIA documents`;
  const newest = newestFor(entries, document);
  if (!newest) return `no changelog entry for ${document}`;
  const reflects = newest.reflects.find((r) => r.document === document);
  if (!reflects) return `changelog entry "${newest.id}" does not say which ${document} version it reflects`;
  const modified = new Date(fp.lastModified);
  if (Number.isNaN(modified.getTime())) return `${fp.title}: unreadable lastModified "${fp.lastModified}"`;
  const day = modified.toISOString().slice(0, 10);
  if (modified.getTime() - Date.parse(`${reflects.date}T00:00:00Z`) >= 2 * DAY_MS) return `${fp.title} was modified on ${day}, but the newest changelog entry "${newest.id}" reflects ${reflects.date}`;
  if (reflects.sha256 !== fp.sha256) return `${fp.title} has a new fingerprint, but the newest changelog entry "${newest.id}" reflects another one`;
  return null;
}
