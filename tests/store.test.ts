// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { syncUrl, useExplorer } from '../src/state/store';

const step = (from: string, delta: number) => {
  useExplorer.setState({ selected: from });
  useExplorer.getState().stepRackUnit(delta);
  return useExplorer.getState().selected;
};

describe('stepRackUnit', () => {
  it('moves between units and stops at the ends without dropping the selection', () => {
    expect(step('compute-tray.7', 1)).toBe('compute-tray.8');
    expect(step('compute-tray.10', 1)).toBe('switch-tray.1');
    expect(step('tor-switch.1', -1)).toBe('tor-switch.1');
    expect(step('power-shelf.1/psu.3', 1)).toBe('power-shelf.1/psu.3');
  });

  it('starts from the matching type for a general selection', () => {
    expect(step('compute-tray', 1)).toBe('compute-tray.1');
    expect(step('compute-tray/rubin-gpu.2', -1)).toBe('compute-tray.18');
    expect(step('', 1)).toBe('tor-switch.1');
    expect(step('bus-bar', -1)).toBe('power-shelf.1');
  });

  it('ignores zero and fractional steps safely', () => {
    expect(step('compute-tray.7', 0)).toBe('compute-tray.7');
    expect(step('compute-tray.7', 2.5)).toBe('compute-tray.9');
  });
});

describe('syncUrl', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));

  it('writes the selection and clears it again when going back to the rack', () => {
    window.history.replaceState(null, '', '/?select=compute-tray.7');
    useExplorer.setState({ selected: 'compute-tray.7', listOpen: false });
    const stop = syncUrl();
    useExplorer.getState().select('');
    expect(window.location.search).toBe('');
    useExplorer.getState().select('switch-tray.3');
    expect(window.location.search).toBe('?select=switch-tray.3');
    stop();
  });

  it('drops an invalid selection from a shared link at start', () => {
    window.history.replaceState(null, '', '/?select=bogus&utm=1');
    useExplorer.setState({ selected: '', listOpen: false });
    const stop = syncUrl();
    expect(window.location.search).toBe('?utm=1');
    stop();
  });
});
