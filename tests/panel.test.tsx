// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SidePanel } from '../src/components/SidePanel';
import { Breadcrumb } from '../src/components/Breadcrumb';
import { useExplorer } from '../src/state/store';

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
