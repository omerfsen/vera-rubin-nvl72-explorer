import { describe, expect, it } from 'vitest';
import { model } from '../src/data';
import { dotFraction, flowShouldAnimate, isFlowMember, linkFlowShouldRun, STUB_LENGTH, stubFrom } from '../src/scenes/flow';
import { flowDotPositions } from '../src/scenes/LinkFlow';
import { managementLinks, managementNetwork, networkFlowSegments } from '../src/scenes/FrontScene';
import { linkCurve, trayFlowSegments } from '../src/scenes/TrayScene';

const networks = model.topology.networks.map((n) => n.id);
const count = (componentId: string) => model.rackUnits.filter((u) => u.componentId === componentId).length;
/** Front port slots per unit type that are stated members of a network. */
const frontMembers = (network: string, unitType: string) =>
  (model.trayLayout(unitType)?.slots ?? []).filter((s) => s.face === 'front' && isFlowMember(network, s.component)).length;

describe('network flow', () => {
  it('animates only while a network is shown, the tab is visible and motion is not reduced', () => {
    expect(flowShouldAnimate({ network: networks[0]!, reducedMotion: false, hidden: false })).toBe(true);
    expect(flowShouldAnimate({ network: '', reducedMotion: false, hidden: false })).toBe(false);
    expect(flowShouldAnimate({ network: networks[0]!, reducedMotion: true, hidden: false })).toBe(false);
    expect(flowShouldAnimate({ network: networks[0]!, reducedMotion: false, hidden: true })).toBe(false);
  });

  it('flows only through stated members, not conflicting or assumed readings', () => {
    for (const network of networks) {
      for (const [id, m] of model.networkMembers(network).members) {
        expect(isFlowMember(network, id)).toBe(!m.alternative && !m.assumed);
      }
    }
    expect(isFlowMember('', networks[0]!)).toBe(false);
  });

  it('a stub leaves the port straight out of the front', () => {
    const s = stubFrom([0.1, 0.2, 0.3]);
    expect(s.from).toEqual([0.1, 0.2, 0.3]);
    expect(s.to).toEqual([0.1, 0.2, 0.3 + STUB_LENGTH]);
  });

  it('builds nothing without a network', () => {
    expect(networkFlowSegments('')).toEqual({ links: [], stubs: [] });
  });

  it('follows the stated management links for the network they are on', () => {
    const { stated } = managementLinks();
    const net = managementNetwork(stated);
    expect(networks).toContain(net);
    const { links, stubs } = networkFlowSegments(net);
    expect(links).toHaveLength(stated.length);
    // A link start gets no extra stub out of the same port.
    const starts = new Set(stated.map((l) => `${l.from}`));
    expect(stubs.filter((s) => starts.has(`${s.from}`))).toHaveLength(0);
  });

  it('gives every other stated front port on the network one stub per unit in the rack', () => {
    for (const network of networks) {
      const { links, stubs } = networkFlowSegments(network);
      const { stated, assumed } = managementLinks();
      const linked = new Set([...stated, ...assumed].map((l) => l.component));
      const expected = [...new Set(model.rackUnits.map((u) => u.componentId))].reduce((sum, type) => {
        const slots = (model.trayLayout(type)?.slots ?? []).filter(
          (s) => s.face === 'front' && isFlowMember(network, s.component) && !linked.has(s.component),
        );
        return sum + slots.length * count(type);
      }, 0);
      expect(stubs).toHaveLength(expected);
      for (const s of [...links, ...stubs]) expect(s.from).not.toEqual(s.to);
    }
    // At least one network leaves the rack through ports with no in-rack link.
    expect(networks.some((n) => networkFlowSegments(n).stubs.length > 0)).toBe(true);
  });

  it('moves stubs with the slid-out unit', () => {
    const network = networks.find((n) => networkFlowSegments(n).stubs.length > 0)!;
    const unit = model.rackUnits.find((u) => frontMembers(network, u.componentId) > 0)!;
    const still = networkFlowSegments(network).stubs;
    const slid = networkFlowSegments(network, unit.key).stubs;
    const moved = slid.filter((s, i) => s.from[2] !== still[i]!.from[2]);
    expect(moved).toHaveLength(frontMembers(network, unit.componentId));
  });

  it('builds stubs inside an open tray for its stated front ports', () => {
    for (const network of networks) {
      for (const [id, layout] of Object.entries(model.topology.trayLayouts ?? {})) {
        expect(trayFlowSegments(layout, network)).toHaveLength(frontMembers(network, id));
      }
      expect(trayFlowSegments(model.trayLayout(model.rackUnits[0]!.componentId)!, '')).toHaveLength(0);
    }
  });
});

describe('dots along tray connections', () => {
  it('run only with the connections layer on, parts at rest, the tab visible and motion allowed', () => {
    const on = { links: true, settled: 0, target: 0, reducedMotion: false, hidden: false };
    expect(linkFlowShouldRun(on)).toBe(true);
    expect(linkFlowShouldRun({ ...on, links: false })).toBe(false);
    expect(linkFlowShouldRun({ ...on, target: 1 })).toBe(false);
    expect(linkFlowShouldRun({ ...on, reducedMotion: true })).toBe(false);
    expect(linkFlowShouldRun({ ...on, hidden: true })).toBe(false);
  });

  it('start at the ends at t=0, move evenly, wrap around, and run both ways', () => {
    expect(dotFraction(0, 0, 4, 1, 1)).toBe(0);
    expect(dotFraction(0, 1, 4, 1, 1)).toBe(0.75);
    expect(dotFraction(0, 2, 4, 1, 1)).toBe(0.5);
    // Forward dots grow with time, backward ones shrink, until they wrap.
    expect(dotFraction(0.1, 0, 4, 1, 1)).toBeGreaterThan(dotFraction(0.05, 0, 4, 1, 1));
    expect(dotFraction(0.1, 1, 4, 1, 1)).toBeLessThan(dotFraction(0.05, 1, 4, 1, 1));
    expect(dotFraction(1.25, 0, 4, 1, 1)).toBeCloseTo(0.25);
    for (const t of [0, 0.3, 7.9, 1e6]) for (let k = 0; k < 4; k++) {
      const f = dotFraction(t, k, 4, 0.06, 0.3);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1.0000001);
    }
  });

  it('places the dots on the link curve, starting at its first end', () => {
    const curve = linkCurve([0, 0, 0], [0.3, 0, 0]);
    const [first, second] = flowDotPositions([curve], 0, 4);
    expect(first!.distanceTo(curve.getPoint(0))).toBeLessThan(1e-9);
    expect(flowDotPositions([curve, curve], 0.5, 4)).toHaveLength(8);
    expect(second!.distanceTo(curve.getPointAt(0.75))).toBeLessThan(1e-9);
    const moved = flowDotPositions([curve], 1, 4)[0]!;
    expect(moved.x).toBeGreaterThan(first!.x);
  });
});
