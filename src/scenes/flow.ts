// Pure helpers for the network overlay's animated flow. No three.js here, so
// they can be tested without a WebGL context.
import { model } from '../data';
import type { Segment, Vec } from './Rods';

/** How far a port's flow stub reaches out of the front face, in metres. */
export const STUB_LENGTH = 0.09;

/**
 * The flow animates only while a network is shown, the tab is visible and the
 * viewer has not asked for reduced motion; otherwise the static highlight stays.
 */
export function flowShouldAnimate(o: { network: string; reducedMotion: boolean; hidden: boolean }): boolean {
  return o.network !== '' && !o.reducedMotion && !o.hidden;
}

/**
 * True when a part is a stated member of the network in its own right: not
 * only through a conflicting figure (`alternative`), not only this app's
 * reading (`assumed`), and not just a part of a member unit. Only these get a
 * moving flow; the rest keep the static highlight.
 */
export function isFlowMember(networkId: string, componentId: string): boolean {
  if (!networkId) return false;
  const m = model.networkMembers(networkId).members.get(componentId);
  return m !== undefined && !m.alternative && !m.assumed;
}

/**
 * A short segment straight out of a front port. The documents say which
 * network a port is on but not how its cable is routed outside the rack, so
 * the flow only shows that it leaves the port, not where it goes.
 */
export function stubFrom(at: Vec, length = STUB_LENGTH): Segment {
  return { from: at, to: [at[0], at[1], at[2] + length] };
}
