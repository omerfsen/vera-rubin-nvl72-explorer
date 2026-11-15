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

describe('walkthrough links', () => {
  it('select the step target when a step is opened directly', () => {
    useExplorer.setState({ procedure: 'cold-reboot', step: 0, selected: '' });
    useExplorer.getState().goToStep(1);
    expect(useExplorer.getState().selected).toBe('power-shelf');
  });
});
