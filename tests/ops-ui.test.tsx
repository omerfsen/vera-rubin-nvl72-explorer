// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { model } from '../src/data';
import { search } from '../src/components/search';
import { readUrlState, writeUrlState } from '../src/state/url';
import { useExplorer } from '../src/state/store';
import { SidePanel } from '../src/components/SidePanel';
import { SourcesPage } from '../src/components/SourcesPage';

afterEach(() => {
  cleanup();
  useExplorer.setState({ selected: '', view: 'rack', procedure: '', step: 0, page: '', network: '' });
});

describe('operator search', () => {
  it('finds a cage by RDMA device, interface or PCIe bus', () => {
    expect(search(model, 'mlx5_4')[0]?.path).toBe('compute-tray/ct-port-cx9-osfp.2');
    expect(search(model, 'enP12p3s0f0np0')[0]?.path).toBe('compute-tray/ct-port-cx9-osfp.5');
    expect(search(model, '0002:81:00.0')[0]?.path).toBe('compute-tray/rubin-gpu.1');
  });
});

describe('host view in the panel', () => {
  it('shows the PCIe bus, interface and RDMA device of an OSFP cage', () => {
    useExplorer.setState({ selected: 'compute-tray.3/ct-port-cx9-osfp.1' });
    render(<SidePanel />);
    expect(screen.getByText('On the host')).toBeTruthy();
    expect(screen.getByText('0001:03:00.0')).toBeTruthy();
    expect(screen.getByText('enP1p3s0f0np0')).toBeTruthy();
    expect(screen.getByText('mlx5_0')).toBeTruthy();
  });
});

describe('service procedures', () => {
  it('walks a PSU replacement step by step, selecting the part each step is about', () => {
    useExplorer.setState({ selected: 'power-shelf.1/psu.1' });
    render(<SidePanel />);
    fireEvent.click(screen.getByRole('button', { name: /Walk through: Replace a power supply/ }));
    expect(useExplorer.getState().procedure).toBe('psu');
    expect(screen.getByText(/step 1 of 5/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(useExplorer.getState().step).toBe(1);
    expect(useExplorer.getState().selected).toBe('power-shelf.1');
  });

  it('keeps the procedure and step in the URL', () => {
    const search = writeUrlState('', { view: 'rack', select: '', list: false, net: '', proc: 'cache-drive', step: 2, page: '', embed: false });
    expect(search).toBe('?proc=cache-drive&step=3');
    expect(readUrlState(search, model)).toMatchObject({ proc: 'cache-drive', step: 2 });
    expect(readUrlState('?proc=nope&step=9', model)).toMatchObject({ proc: '', step: 0 });
    expect(readUrlState('?page=sources&embed=1', model)).toMatchObject({ page: 'sources', embed: true });
  });
});

describe('sources page', () => {
  it('lists the documents, the conflicts and every assumed fact, and links the dataset', () => {
    render(<SourcesPage />);
    expect(screen.getByText(/NVIDIA DGX VR NVL72 User Guide/)).toBeTruthy();
    expect(screen.getByText(/Conflicts in NVIDIA's documents \(1\)/)).toBeTruthy();
    expect(screen.getByText(/^Assumed \(\d+\)$/)).toBeTruthy();
    const json = screen.getByRole('link', { name: 'nvl72-topology.json' }) as HTMLAnchorElement;
    expect(json.getAttribute('href')).toMatch(/data\/nvl72-topology\.json$/);
  });
});
