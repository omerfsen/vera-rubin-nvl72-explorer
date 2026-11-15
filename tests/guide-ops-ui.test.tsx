// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useExplorer } from '../src/state/store';
import { SidePanel } from '../src/components/SidePanel';

afterEach(() => {
  cleanup();
  useExplorer.setState({ selected: '', view: 'rack', procedure: '', step: 0 });
});

describe('operations in the panel', () => {
  it('lists the five operations walkthroughs on the rack', () => {
    render(<SidePanel />);
    expect(screen.getByText('Operations')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Walk through:/ })).toHaveLength(5);
  });

  it('walks the cold reboot, lighting up every power shelf at once', () => {
    render(<SidePanel />);
    fireEvent.click(screen.getByRole('button', { name: /Cold reboot the rack/ }));
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(useExplorer.getState().selected).toBe('power-shelf');
    expect(screen.getByText(/wait three to five minutes/)).toBeTruthy();
  });

  it('shows the warm reboot command for its step', () => {
    useExplorer.setState({ selected: '' });
    render(<SidePanel />);
    fireEvent.click(screen.getByRole('button', { name: /Warm reboot the rack/ }));
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('nv action stop cluster app nmx-controller')).toBeTruthy();
  });

  it('shows the guide commands, software and safety on the right parts', () => {
    useExplorer.setState({ selected: 'compute-tray.1/host-bmc.1' });
    render(<SidePanel />);
    expect(screen.getByText(/^Commands \(30\)$/)).toBeTruthy();
    expect(screen.getAllByText('NVDEBUG', { exact: false }).length).toBeGreaterThan(0);
    cleanup();
    useExplorer.setState({ selected: 'switch-tray.2' });
    render(<SidePanel />);
    expect(screen.getByText('NVIDIA Switch OS (NVOS)')).toBeTruthy();
    expect(screen.getByText('Working in the rack.')).toBeTruthy();
  });
});

describe('safety in walkthroughs', () => {
  it('keeps the safety notes on a later step opened from a shared link', () => {
    useExplorer.setState({ procedure: 'psu', step: 0, selected: '' });
    useExplorer.getState().goToStep(2);
    render(<SidePanel />);
    expect(screen.getAllByText('Power supplies.').length).toBeGreaterThan(0);
  });
});

describe('the NVIDIA numbering of GPUs and CPUs', () => {
  it('titles the third GPU in the URL GPU 2, as NVIDIA labels it', () => {
    useExplorer.setState({ selected: 'compute-tray.7/rubin-gpu.3' });
    render(<SidePanel />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Rubin GPU 2');
    expect(screen.getByText('This is number 2.')).toBeTruthy();
    expect(screen.getByText(/NVIDIA numbers these from 0/)).toBeTruthy();
  });
});

describe('assumed network membership', () => {
  it('marks the power shelf management port ipminet chip as assumed', () => {
    useExplorer.setState({ selected: 'power-shelf.1/power-shelf-mgmt-module.1/ps-mgmt-rj45.1' });
    render(<SidePanel />);
    const chip = screen.getByText('ipminet', { selector: 'li.chip *, li.chip' }).closest('li')!;
    expect(chip.textContent).toContain('assumed');
  });
});

describe('walkthrough links', () => {
  it('select the step target when a step is opened directly', () => {
    useExplorer.setState({ procedure: 'cold-reboot', step: 0, selected: '' });
    useExplorer.getState().goToStep(1);
    expect(useExplorer.getState().selected).toBe('power-shelf');
  });
});
