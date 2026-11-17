import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../data/nvl72-topology.schema.json';
import data from '../data/nvl72-topology.json';
import fingerprints from '../data/doc-fingerprints.json';
import { topology } from '../src/data';
import { changelogGap, documentOf, newestFor, sortedChangelog } from '../src/data/changelog';
import type { ChangelogEntry, Source } from '../src/data/types';

const changelog = topology.changelog ?? [];

const UG = 'user-guide 2026-11-05 a80572227a6175d85a5f8209acfcf8b6ab573da3e5d50f9f29f946ec9627986e';
const SM = 'service-manual 2026-10-07 9e7cef3fa7ee2767f3dacc5350d393cdefe0f30045303bd23976ce380618bf50';

/**
 * The log is append-only. Every entry that has shipped is listed here, newest
 * first, with its date and the document versions it reflects. A shipped entry
 * must keep both, so a new fingerprint needs a NEW entry on top, not an edit
 * of an old one. When you add an entry to the data, add its line here too.
 */
const SHIPPED: readonly { id: string; date: string; reflects: readonly string[] }[] = [
  { id: 'glossary', date: '2026-11-16', reflects: [UG, SM] },
  { id: 'numbering-and-inferred-facts', date: '2026-11-15', reflects: [UG, SM] },
  { id: 'guide-software-commands-operations-safety', date: '2026-11-15', reflects: [UG] },
  { id: 'open-questions-and-references', date: '2026-11-15', reflects: [UG, SM] },
  { id: 'service-procedures', date: '2026-11-15', reflects: [SM] },
  { id: 'pcie-devices', date: '2026-11-15', reflects: [UG] },
  { id: 'power-shelf-and-tor-fronts', date: '2026-11-15', reflects: [UG, SM] },
  { id: 'service-manual-first-import', date: '2026-11-15', reflects: [SM] },
  { id: 'user-guide-first-import', date: '2026-11-15', reflects: [UG] },
];

const reflectsOf = (e: ChangelogEntry) => e.reflects.map((r) => `${r.document} ${r.date} ${r.sha256 ?? ''}`.trim());

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

/** Every (url, section) the rest of the data cites. */
function citedSections(): Set<string> {
  const out = new Set<string>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      const s = node as Partial<Source>;
      if (typeof s.url === 'string' && typeof s.section === 'string') out.add(`${s.url}|${s.section}`);
      Object.values(node).forEach(walk);
    }
  };
  walk({ ...data, changelog: undefined });
  return out;
}

describe('changelog and the document fingerprints', () => {
  it('has a fingerprint and a changelog entry for both NVIDIA documents', () => {
    expect(fingerprints.documents.map((d) => documentOf(d.url)).sort()).toEqual(['service-manual', 'user-guide']);
    for (const d of ['user-guide', 'service-manual'] as const) expect(newestFor(changelog, d), d).toBeDefined();
  });

  // The rule that keeps the page honest: a document update cannot land without an entry.
  it.each(fingerprints.documents)('the newest entry for $title reflects its fingerprint', (fp) => {
    expect(changelogGap(changelog, fp)).toBeNull();
  });

  it('fails when a fingerprint has a newer date or another hash than the newest entry', () => {
    const fp = fingerprints.documents[0]!;
    expect(changelogGap(changelog, { ...fp, lastModified: 'Fri, 01 Jan 2027 00:00:00 GMT' })).toMatch(/was modified on 2027-01-01/);
    expect(changelogGap(changelog, { ...fp, sha256: '0'.repeat(64) })).toMatch(/new fingerprint/);
    expect(changelogGap([], fp)).toMatch(/no changelog entry/);
    expect(changelogGap(changelog, { ...fp, lastModified: 'someday' })).toMatch(/unreadable/);
    // An entry about the other document, or an app-data entry, does not cover it.
    const others = changelog.filter((e) => e.document !== documentOf(fp.url));
    expect(changelogGap(others, fp)).toMatch(/no changelog entry/);
  });

  // One date rule. An entry's document date is the date NVIDIA prints, which is
  // what meta holds and the footer shows, so the newest entry must equal meta
  // exactly (next test). The Last-Modified header is a second clock, read in
  // UTC, and can land on the neighbouring day; it only fails the check when the
  // PDF is two or more days newer than the entry says. The hash is the strict part.
  it('allows the Last-Modified header to be one day off the printed date, and no more', () => {
    const fp = fingerprints.documents[0]!;
    const printed = newestFor(changelog, 'user-guide')!.reflects.find((r) => r.document === 'user-guide')!.date;
    const at = (days: number, time: string) => {
      const d = new Date(Date.parse(`${printed}T${time}Z`) + days * 86_400_000);
      return { ...fp, lastModified: d.toUTCString() };
    };
    expect(changelogGap(changelog, at(-1, '23:30:00'))).toBeNull();
    expect(changelogGap(changelog, at(1, '00:30:00'))).toBeNull();
    expect(changelogGap(changelog, at(1, '23:59:59'))).toBeNull();
    expect(changelogGap(changelog, at(2, '00:00:00'))).toMatch(/was modified on/);
  });

  it('reflects exactly the document dates the footer and the Sources page show', () => {
    const dates = { 'user-guide': topology.meta.document.date, 'service-manual': topology.meta.serviceManual!.date };
    for (const d of ['user-guide', 'service-manual'] as const)
      expect(newestFor(changelog, d)?.reflects.find((r) => r.document === d)?.date, d).toBe(dates[d]);
    // No entry, of any kind, reflects a version newer than the one the app shows.
    for (const e of changelog) for (const r of e.reflects) expect(r.date <= dates[r.document], `${e.id} ${r.document}`).toBe(true);
  });

  it('accepts a document update once a new entry is added on top', () => {
    const fp = { ...fingerprints.documents[0]!, lastModified: 'Fri, 01 Jan 2027 00:00:00 GMT', sha256: 'a'.repeat(64) };
    const entry: ChangelogEntry = {
      id: 'next',
      date: '2027-01-04',
      document: 'user-guide',
      reflects: [{ document: 'user-guide', date: '2027-01-01', sha256: fp.sha256 }],
      sections: [],
      summary: 'x',
    };
    expect(changelogGap([entry, ...changelog], fp)).toBeNull();
  });
});

describe('changelog is append-only', () => {
  it('keeps every shipped entry with its date and the versions it reflects', () => {
    const byId = new Map(changelog.map((e) => [e.id, e]));
    for (const s of SHIPPED) {
      const e = byId.get(s.id);
      expect(e, `shipped entry "${s.id}" was removed`).toBeDefined();
      expect(e!.date, `${s.id}: date`).toBe(s.date);
      expect(reflectsOf(e!), `${s.id}: reflects`).toEqual(s.reflects);
    }
  });

  it('lists every entry of the data, in the same order, so a new one is added here on purpose', () => {
    expect(changelog.map((e) => e.id)).toEqual(SHIPPED.map((s) => s.id));
  });

  it('would catch an old entry edited to carry a new fingerprint', () => {
    const edited = structuredClone(changelog) as ChangelogEntry[];
    const first = edited.find((e) => e.id === 'user-guide-first-import')!;
    first.reflects[0]!.sha256 = 'b'.repeat(64);
    const shipped = SHIPPED.find((s) => s.id === first.id)!;
    expect(reflectsOf(first)).not.toEqual(shipped.reflects);
  });
});

describe('changelog entries', () => {
  it('are kept newest first, with unique ids, and never dated before the document they reflect', () => {
    expect(changelog.length).toBeGreaterThan(0);
    expect(sortedChangelog(changelog)).toEqual(changelog);
    expect(new Set(changelog.map((e) => e.id)).size).toBe(changelog.length);
    for (const e of changelog) {
      for (const r of e.reflects) expect(e.date >= r.date, e.id).toBe(true);
      // An entry about one document says which version of it the data reflects.
      if (e.document !== 'app-data') expect(e.reflects.map((r) => r.document)).toContain(e.document);
    }
  });

  // Only the newest entry of each kind must name sections the data cites today.
  // Older entries are history: when NVIDIA renames or drops a section the data
  // moves on, and an old entry must keep the title and anchor it had (the log
  // is append-only), so it is held only to the schema's rule for source URLs.
  it('the newest entry of each kind names only sections the data cites today', () => {
    const cited = citedSections();
    for (const kind of ['user-guide', 'service-manual', 'app-data'] as const) {
      const newest = sortedChangelog(changelog).find((e) => e.document === kind);
      for (const s of newest?.sections ?? []) expect(cited.has(`${s.url}|${s.section}`), `${newest!.id}: ${s.section}`).toBe(true);
    }
  });

  it('every entry about one document names at least one section, all in that document', () => {
    for (const e of changelog) {
      if (e.document === 'app-data') continue;
      expect(e.sections.length, e.id).toBeGreaterThan(0);
      for (const s of e.sections) expect(documentOf(s.url), `${e.id}: ${s.url}`).toBe(e.document);
    }
  });

  it('sorts by date and keeps the file order within a day', () => {
    const e = (id: string, date: string) => ({ id, date }) as ChangelogEntry;
    expect(sortedChangelog([e('a', '2026-01-01'), e('b', '2026-03-01'), e('c', '2026-03-01'), e('d', '2026-02-01')]).map((x) => x.id)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('are rejected by the schema with a source outside NVIDIA\'s two documents, a bad date or an unknown document', () => {
    const validate = validator();
    expect(validate(data)).toBe(true);
    type Loose = { changelog: Record<string, any>[] };
    const broken = (change: (log: Loose['changelog']) => void) => {
      const copy = structuredClone(data) as unknown as Loose;
      change(copy.changelog);
      return validate(copy);
    };
    expect(broken((log) => (log.at(-1)!.sections[0].url = 'https://example.com/hardware.html#rack'))).toBe(false);
    expect(broken((log) => (log.at(-1)!.sections[0].url = 'https://docs.nvidia.com/dgx/dgx-other/hardware.html'))).toBe(false);
    expect(broken((log) => (log[0]!.date = 'last week'))).toBe(false);
    expect(broken((log) => (log[0]!.document = 'release-notes'))).toBe(false);
    expect(broken((log) => (log[0]!.summary = '  '))).toBe(false);
    expect(broken((log) => (log[0]!.reflects[0].sha256 = 'abc'))).toBe(false);
    expect(broken((log) => (log[0]!.reflects[0].note = ' '))).toBe(false);
    expect(broken((log) => (log[0]!.reflects[0].note = 'Read from the PDF.'))).toBe(true);
  });
});
