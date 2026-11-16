import type { Model, PathSegment } from './model';
import { ROOT_ID } from './model';
import type { Component, Network, Spec } from './types';

/** One side of a comparison: a selection path and what the data says about it. */
export interface CompareSide {
  path: string;
  /** Last path segment, or undefined for the rack itself. */
  segment: PathSegment | undefined;
  component: Component;
  /** How many a whole rack has; null when the documents do not say. */
  totalPerRack: number | null;
  /** Networks of the part and everything inside it, in guide order. */
  networks: Network[];
}

/** Specs lined up by label; `differs` when only one side has it or the values differ. */
export interface CompareSpecRow {
  label: string;
  left?: Spec;
  right?: Spec;
  differs: boolean;
}

export interface Comparison {
  left: CompareSide;
  right: CompareSide;
  specs: CompareSpecRow[];
  /** Every network on either side, in guide order, with which side has it. */
  networks: { network: Network; left: boolean; right: boolean }[];
}

/** The side for a path, or null when the path names nothing in the data. */
export function compareSide(model: Model, path: string): CompareSide | null {
  const segments = model.parsePath(path);
  if (segments === null) return null;
  const segment = segments[segments.length - 1];
  const component = model.getComponent(segment?.id ?? ROOT_ID);
  if (!component) return null;
  return {
    path: model.formatPath(segments),
    segment,
    component,
    totalPerRack: model.totalPerRack(component.id),
    networks: model.networksWithin(component.id),
  };
}

export function specText(spec: Spec | undefined): string {
  return spec === undefined ? '' : `${spec.value}${spec.unit ? ` ${spec.unit}` : ''}`;
}

/** Line up two parts: specs by label (left order first, then the right's extras) and networks. */
export function buildComparison(model: Model, leftPath: string, rightPath: string): Comparison | null {
  const left = compareSide(model, leftPath);
  const right = compareSide(model, rightPath);
  if (!left || !right) return null;
  const labels = [...new Set([...left.component.specs, ...right.component.specs].map((s) => s.label))];
  const specs = labels.map((label) => {
    const l = left.component.specs.find((s) => s.label === label);
    const r = right.component.specs.find((s) => s.label === label);
    return { label, left: l, right: r, differs: l === undefined || r === undefined || specText(l) !== specText(r) };
  });
  const leftIds = new Set(left.networks.map((n) => n.id));
  const rightIds = new Set(right.networks.map((n) => n.id));
  const networks = model.topology.networks
    .filter((n) => leftIds.has(n.id) || rightIds.has(n.id))
    .map((network) => ({ network, left: leftIds.has(network.id), right: rightIds.has(network.id) }));
  return { left, right, specs, networks };
}
