// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { model } from '../src/data';
import { readUrlState, writeUrlState } from '../src/state/url';
import { useExplorer } from '../src/state/store';
import { NetworkInfo } from '../src/components/NetworkInfo';

afterEach(() => {
  cleanup();
  useExplorer.setState({ network: '', selected: '' });
});

describe('network overlay members', () => {
  const ids = (net: string) => [...model.networkMembers(net).members.keys()].sort();
  const units = (net: string) => [...model.networkMembers(net).unitTypes].sort();

  it('computenet: the ConnectX-9 OSFP ports of every compute tray', () => {
    expect(ids('computenet')).toEqual(['ct-port-cx9-osfp']);
    expect(units('computenet')).toEqual(['compute-tray']);
  });

  it('ipminet: BMC and BlueField-4 RJ45 ports, switch tray management ports, power shelves and ToR switches', () => {
    expect(ids('ipminet')).toEqual(
      ['ct-port-bf4-rj45', 'ct-port-bmc-1gbe', 'power-shelf', 'ps-mgmt-rj45', 'st-port-bmc-eth', 'st-port-switch-mgmt', 'tor-switch'].sort(),
    );
    expect(units('ipminet')).toEqual(['compute-tray', 'power-shelf', 'switch-tray', 'tor-switch']);
  });

  it('storagenet: the right QSFP port, plus the left one as a conflicting reading', () => {
    const m = model.networkMembers('storagenet').members;
    expect(m.get('ct-port-bf4-right')).toEqual({ alternative: false });
    expect(m.get('ct-port-bf4-left')).toEqual({ alternative: true });
    expect(model.networkMembers('dgxnet').members.get('ct-port-bf4-left')).toEqual({ alternative: false });
  });

  it('externalnet, internalnet and failovernet reach no port in the rack', () => {
    for (const n of ['externalnet', 'internalnet', 'failovernet']) expect(ids(n), n).toEqual([]);
  });
});

describe('network overlay state and URL', () => {
  it('toggles the overlay on and off', () => {
    useExplorer.getState().setNetwork('dgxnet');
    expect(useExplorer.getState().network).toBe('dgxnet');
    useExplorer.getState().setNetwork('dgxnet');
    expect(useExplorer.getState().network).toBe('');
  });

  it('round-trips net= and ignores unknown networks', () => {
    const search = writeUrlState('', { view: 'tray', select: 'compute-tray.2', list: false, net: 'storagenet' });
    expect(search).toBe('?view=tray&select=compute-tray.2&net=storagenet');
    expect(readUrlState(search, model).net).toBe('storagenet');
    expect(readUrlState('?net=moonnet', model).net).toBe('');
  });
});

describe('network info panel', () => {
  it('lists what is on the network with per-rack counts and the conflict', () => {
    useExplorer.setState({ network: 'storagenet' });
    render(<NetworkInfo />);
    expect(screen.getByText('Network 6: storagenet · Ethernet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'BlueField-4 right port' })).toBeTruthy();
    expect(screen.getAllByText(/18 per rack/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Conflict: the guide's figure puts this port on storagenet/)).toBeTruthy();
  });

  it('says so when a network has no port in the rack', () => {
    useExplorer.setState({ network: 'failovernet' });
    render(<NetworkInfo />);
    expect(screen.getByText(/No port in this rack is on failovernet/)).toBeTruthy();
  });
});
