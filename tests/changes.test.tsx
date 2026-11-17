// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import fingerprints from '../data/doc-fingerprints.json';
import site from '../data/site.json';
import tr from '../data/i18n/tr.json';
import App from '../src/App';
import { model } from '../src/data';
import { readUrlState, writeUrlState } from '../src/state/url';
import { useExplorer } from '../src/state/store';
import { ChangesPage } from '../src/components/ChangesPage';
import { SourcesPage } from '../src/components/SourcesPage';
import { paletteActions } from '../src/components/palette';
import { i18nFor } from '../src/i18n';

const changelog = model.topology.changelog!;

afterEach(() => {
  cleanup();
  useExplorer.setState({ page: '', lang: 'en', selected: '' });
});

describe('page=changes in the URL', () => {
  it('reads and writes the page, and ignores a page it does not have', () => {
    expect(readUrlState('?page=changes', model).page).toBe('changes');
    expect(readUrlState('?page=sources', model).page).toBe('sources');
    expect(readUrlState('?page=admin', model).page).toBe('');
    expect(writeUrlState('', { view: 'rack', select: '', list: false, page: 'changes' })).toBe('?page=changes');
  });
});

describe('What changed page', () => {
  it('lists every entry newest first with its document, versions and summary', () => {
    render(<ChangesPage />);
    expect(screen.getByRole('heading', { name: 'What changed' })).toBeTruthy();
    expect(screen.getByText(`Changes to the data (${changelog.length})`)).toBeTruthy();
    const items = [...document.querySelectorAll('.changes-list > li')] as HTMLElement[];
    expect(items.map((li) => li.querySelector('time')!.getAttribute('datetime'))).toEqual(changelog.map((e) => e.date));
    items.forEach((li, i) => {
      const e = changelog[i]!;
      expect(within(li).getByText(e.summary)).toBeTruthy();
      expect(li.dataset.document).toBe(e.document);
      for (const r of e.reflects) {
        expect(li.textContent).toContain(r.date);
        if (r.note) expect(within(li).getByText(r.note)).toBeTruthy();
      }
    });
    // The inferred hash of the two first imports is said on the page.
    expect(screen.getAllByText(/The SHA-256 is inferred/)).toHaveLength(2);
    const dates = items.map((li) => li.querySelector('time')!.getAttribute('datetime')!);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('links each entry to the NVIDIA sections it touched and to its commit or pull request', () => {
    render(<ChangesPage />);
    const items = [...document.querySelectorAll('.changes-list > li')] as HTMLElement[];
    items.forEach((li, i) => {
      const e = changelog[i]!;
      const nvidia = [...li.querySelectorAll('details a')] as HTMLAnchorElement[];
      expect(nvidia.map((a) => a.getAttribute('href'))).toEqual(e.sections.map((s) => s.url));
      expect(nvidia.map((a) => a.textContent)).toEqual(e.sections.map((s) => s.section));
      for (const a of nvidia) {
        expect(a.href).toMatch(/^https:\/\/docs\.nvidia\.com\/dgx\/dgxvr-(user-guide|service-manual)\//);
        expect(a.rel).toBe('noopener noreferrer');
      }
      if (e.commit) expect(li.querySelector(`a[href="${site.repository}/commit/${e.commit}"]`)).toBeTruthy();
      if (e.pr) expect(within(li).getByRole('link', { name: `Pull request #${e.pr}` }).getAttribute('href')).toBe(`${site.repository}/pull/${e.pr}`);
    });
  });

  it('shows the fingerprint of each PDF and says what the weekly check does', () => {
    render(<ChangesPage />);
    for (const d of fingerprints.documents) {
      expect((screen.getByRole('link', { name: d.title }) as HTMLAnchorElement).href).toBe(d.url);
      expect(screen.getByText(d.sha256.slice(0, 12))).toBeTruthy();
    }
    expect(screen.getByText(/PDF last modified on 2026-11-05/)).toBeTruthy();
    expect(screen.getByText(/PDF last modified on 2026-10-07/)).toBeTruthy();
    expect(screen.getByText(/A weekly check compares these fingerprints/)).toBeTruthy();
  });

  it('shows translated summaries and keeps NVIDIA section titles as they are', () => {
    useExplorer.setState({ lang: 'tr' });
    render(<ChangesPage />);
    expect(screen.getByRole('heading', { name: tr.ui.changes.title })).toBeTruthy();
    expect(screen.getByText(tr.content.changelog['user-guide-first-import'].summary)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: '1.1 Rack Configuration' }).length).toBeGreaterThan(0);
  });

  it('opens from the Sources page, and goes back to it or to the rack', () => {
    render(<SourcesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'What changed in these documents and in the data' }));
    expect(useExplorer.getState().page).toBe('changes');
    cleanup();
    render(<ChangesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sources and open questions' }));
    expect(useExplorer.getState().page).toBe('sources');
    fireEvent.click(screen.getByRole('button', { name: '← Back to the rack' }));
    expect(useExplorer.getState().page).toBe('');
  });

  it('opens from the footer next to the document dates, and from the command palette', () => {
    render(<App />);
    const footer = document.querySelector('footer')!;
    expect(footer.textContent).toContain(model.topology.meta.document.date);
    fireEvent.click(within(footer as HTMLElement).getByRole('button', { name: 'What changed' }));
    expect(useExplorer.getState().page).toBe('changes');
    expect(screen.getByRole('heading', { name: 'What changed' })).toBeTruthy();
    const list = (page: string) => paletteActions(model, { ...useExplorer.getState(), page }, i18nFor('en'), true).map((a) => a.id);
    expect(list('')).toEqual(expect.arrayContaining(['page:sources', 'page:changes']));
    expect(list('changes')).toContain('page:close');
    expect(list('changes')).not.toContain('page:changes');
  });
});
