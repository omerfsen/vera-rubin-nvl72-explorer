// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SidePanel } from '../src/components/SidePanel';
import { Breadcrumb } from '../src/components/Breadcrumb';
import { useExplorer } from '../src/state/store';
import { model } from '../src/data';
import { i18nFor } from '../src/i18n';

afterEach(() => {
  cleanup();
  useExplorer.setState({ selected: '' });
});

describe('side panel', () => {
  it('shows the rack when nothing is selected', () => {
    render(<SidePanel />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('DGX Vera Rubin NVL72 rack');
  });

  it('shows a numbered tray with its count, networks, source and assumed numbering', () => {
    useExplorer.setState({ selected: 'compute-tray.7' });
    render(<SidePanel />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Compute tray 7');
    expect(screen.getByText('18 per rack')).toBeTruthy();
    expect(screen.getByText('computenet')).toBeTruthy();
    expect(screen.getAllByText('assumed').length).toBeGreaterThan(0);
    const links = screen.getAllByRole('link', { name: '1.2 Compute Trays' }) as HTMLAnchorElement[];
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l.href).toBe('https://docs.nvidia.com/dgx/dgxvr-user-guide/hardware.html#compute-trays');
  });

  it('opens a part from "Parts inside" and updates the breadcrumb', () => {
    useExplorer.setState({ selected: 'compute-tray.7' });
    render(
      <>
        <Breadcrumb />
        <SidePanel />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Rubin GPU/ }));
    expect(useExplorer.getState().selected).toBe('compute-tray.7/rubin-gpu');
    expect(screen.getByText('72 per rack (computed)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compute tray 7' })).toBeTruthy();
  });

  it('never renders an official figure while the flag is off', () => {
    useExplorer.setState({ selected: 'power-shelf.1' });
    const { container } = render(<SidePanel />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('side panel accessibility and wording', () => {
  it('moves focus to the new heading after a breadcrumb step removes the focused control', () => {
    useExplorer.setState({ selected: 'compute-tray.7/rubin-gpu' });
    render(
      <>
        <Breadcrumb />
        <SidePanel />
      </>,
    );
    const crumb = screen.getByRole('button', { name: 'Compute tray 7' });
    crumb.focus();
    fireEvent.click(crumb);
    expect(document.activeElement?.id).toBe('panel-title');
    expect(document.activeElement?.textContent).toContain('Compute tray 7');
  });

  it('announces only the selected title, not the whole panel', () => {
    useExplorer.setState({ selected: 'switch-tray.2' });
    const { container } = render(<SidePanel />);
    const live = container.querySelectorAll('[aria-live]');
    expect(live.length).toBe(1);
    expect(live[0]!.textContent).toBe('Selected: NVLink 6 switch tray 2');
  });

  it('shows no empty brackets for a port that is not connected', () => {
    useExplorer.setState({ selected: 'compute-tray/ct-port-lan-1gbe' });
    const { container } = render(<SidePanel />);
    expect(container.textContent).not.toContain('()');
  });

  it('cites the service manual for power shelf numbering instead of marking it assumed', () => {
    useExplorer.setState({ selected: 'power-shelf.1' });
    render(<SidePanel />);
    expect(screen.getByText(/numbers the shelves 1 to 4 from the bottom/)).toBeTruthy();
    expect(screen.queryByText('assumed')).toBeNull();
  });
});

describe('focus on page load', () => {
  it('does not move focus when the panel first renders', () => {
    useExplorer.setState({ selected: 'compute-tray.4' });
    (document.activeElement as HTMLElement | null)?.blur();
    render(<SidePanel />);
    expect(document.activeElement).toBe(document.body);
  });
});

describe('pinned connection', () => {
  afterEach(() => useExplorer.setState({ pinnedLink: null, view: 'rack' }));
  const layout = model.trayLayout('compute-tray')!;
  const i18n = i18nFor('en');

  it('shows the pinned link: kind, both ends, note and source, and Unpin lets go', () => {
    useExplorer.setState({ selected: 'compute-tray.3', view: 'tray', pinnedLink: { tray: 'compute-tray.3', index: 7 } });
    const { container } = render(<SidePanel />);
    const link = layout.links![7]!;
    const section = container.querySelector('.pinned-connection')!;
    expect(section.querySelector('h3')!.textContent).toBe('Pinned connection');
    expect(section.textContent).toContain('PCIe');
    expect(section.textContent).toContain(`${i18n.linkEndLabel('compute-tray', link.from)} → ${i18n.linkEndLabel('compute-tray', link.to)}`);
    expect(section.textContent).toContain(link.note!);
    expect(section.querySelector('a')!.getAttribute('href')).toBe(link.source.url);
    fireEvent.click(screen.getByRole('button', { name: 'Unpin' }));
    expect(useExplorer.getState().pinnedLink).toBeNull();
    expect(container.querySelector('.pinned-connection')).toBeNull();
  });

  it('shows nothing for a pin in another tray', () => {
    useExplorer.setState({ selected: 'compute-tray.3', view: 'tray', pinnedLink: { tray: 'compute-tray.4', index: 7 } });
    const { container } = render(<SidePanel />);
    expect(container.querySelector('.pinned-connection')).toBeNull();
  });

  it('pins a row from "Inside the tray" with Show in 3D, only with WebGL', () => {
    useExplorer.setState({ selected: 'compute-tray.3/vera-cpu.1', view: 'tray' });
    const { unmount } = render(<SidePanel />);
    const buttons = screen.getAllByRole('button', { name: 'Show in 3D' });
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(buttons[0]!);
    expect(useExplorer.getState().pinnedLink).toEqual({ tray: 'compute-tray.3', index: 0 });
    expect(screen.getAllByRole('button', { name: 'Show in 3D' })[0]!.getAttribute('aria-pressed')).toBe('true');
    unmount();
    render(<SidePanel webgl={false} />);
    expect(screen.queryAllByRole('button', { name: 'Show in 3D' })).toHaveLength(0);
  });
});
