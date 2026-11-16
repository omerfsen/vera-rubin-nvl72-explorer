// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { topology } from '../src/data';
import { splitGlossary } from '../src/data/glossary';
import type { GlossaryTerm } from '../src/data/types';
import { GlossaryText } from '../src/components/Glossary';
import { SidePanel } from '../src/components/SidePanel';
import { SourcesPage } from '../src/components/SourcesPage';
import { useExplorer } from '../src/state/store';

const src = { url: 'https://docs.nvidia.com/dgx/dgxvr-user-guide/hardware.html#compute-trays', section: '1.2 Compute Trays' };
const BMC: GlossaryTerm = { id: 'bmc', term: 'BMC', expansion: 'Board Management Controller', definition: 'x', source: src };
const TOR: GlossaryTerm = { id: 'tor', term: 'TOR', aliases: ['ToR'], definition: 'y', source: src };
const NVLINK: GlossaryTerm = { id: 'nvlink', term: 'NVLink', definition: 'z', source: src };

afterEach(() => {
  cleanup();
  useExplorer.setState({ selected: '', page: '', lang: 'en' });
});

describe('glossary data', () => {
  const g = topology.glossary ?? [];

  it('has unique ids and terms, and every entry has a definition and a source', () => {
    expect(g.length).toBeGreaterThan(10);
    expect(new Set(g.map((e) => e.id)).size).toBe(g.length);
    const words = g.flatMap((e) => [e.term, ...(e.aliases ?? [])]);
    expect(new Set(words).size).toBe(words.length);
    for (const e of g) {
      expect(e.definition.trim()).not.toBe('');
      expect(e.source.url).toMatch(/^https:\/\/docs\.nvidia\.com\/dgx\/dgxvr-(user-guide|service-manual)\//);
    }
  });
});

describe('splitGlossary', () => {
  const join = (text: string, entries: GlossaryTerm[]) =>
    splitGlossary(text, entries)
      .map((p) => (p.id ? `[${p.text}]` : p.text))
      .join('');

  it('marks only the first occurrence of each term in a block', () => {
    expect(join('The BMC talks to the BMC.', [BMC])).toBe('The [BMC] talks to the BMC.');
  });

  it('matches whole words only, with an s plural', () => {
    expect(join('HMCBMC and BMC2 are not terms; BMCs are.', [BMC])).toBe('HMCBMC and BMC2 are not terms; [BMCs] are.');
    expect(join('NVLinks and NVLink', [NVLINK])).toBe('[NVLinks] and NVLink');
  });

  it('is case-sensitive and matches aliases', () => {
    expect(join('bmc and Bmc', [BMC])).toBe('bmc and Bmc');
    expect(join('two ToR switches', [TOR])).toBe('two [ToR] switches');
    expect(join('tor', [TOR])).toBe('tor');
  });

  it('keeps several terms in order and the text intact', () => {
    const text = 'NVLink joins trays; the BMC sits on the ToR network.';
    const pieces = splitGlossary(text, [BMC, TOR, NVLINK]);
    expect(pieces.map((p) => p.text).join('')).toBe(text);
    expect(pieces.filter((p) => p.id).map((p) => p.id)).toEqual(['nvlink', 'bmc', 'tor']);
  });

  it('returns the text unchanged when nothing matches', () => {
    expect(splitGlossary('nothing here', [BMC])).toEqual([{ text: 'nothing here' }]);
    expect(splitGlossary('', [BMC])).toEqual([{ text: '' }]);
  });
});

describe('glossary popover', () => {
  it('opens on click with the definition and source, and closes on Escape', () => {
    render(<GlossaryText text="The BMC and the BMC again." />);
    const button = screen.getByRole('button', { name: 'BMC' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const dialog = screen.getByRole('dialog', { name: 'Definition of BMC' });
    expect(button.getAttribute('aria-describedby')).toBe(dialog.id);
    expect(dialog.textContent).toContain('Board Management Controller');
    const link = screen.getByRole('link', { name: '1.2 Compute Trays' }) as HTMLAnchorElement;
    expect(link.href).toBe('https://docs.nvidia.com/dgx/dgxvr-user-guide/hardware.html#compute-trays');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('opens on hover and keyboard focus, and closes on an outside click', () => {
    render(
      <>
        <p>
          <GlossaryText text="Ports connect to the ToR switches." />
        </p>
        <button type="button">elsewhere</button>
      </>,
    );
    const button = screen.getByRole('button', { name: 'ToR' });
    fireEvent.mouseEnter(button.parentElement!);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.mouseLeave(button.parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => button.focus());
    expect(screen.getByRole('dialog', { name: 'Definition of TOR' })).toBeTruthy();
    fireEvent.click(button);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the definition in the chosen language', () => {
    useExplorer.setState({ lang: 'tr' });
    render(<GlossaryText text="BMC" />);
    fireEvent.click(screen.getByRole('button', { name: 'BMC' }));
    expect(screen.getByRole('dialog').textContent).toContain('Kart Yönetim Denetleyicisi');
  });

  it('marks terms in the details panel text', () => {
    render(<SidePanel />);
    expect(screen.getAllByRole('button', { name: 'NVLink' }).length).toBeGreaterThan(0);
  });

  it('lists the glossary on the Sources page', () => {
    render(<SourcesPage />);
    const count = topology.glossary?.length ?? 0;
    expect(screen.getByRole('heading', { name: `Glossary (${count})` })).toBeTruthy();
    expect(document.getElementById('glossary-cru')?.textContent).toContain('Customer-replaceable unit');
  });
});
