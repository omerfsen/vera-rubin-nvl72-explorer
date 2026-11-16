import type { Model } from './model';
import type { Component, ComponentType } from './types';

/** One bar of the "how many in the rack" chart. */
export interface RackTotal {
  component: Component;
  /** Count per rack (product of counts up the parent chain); null when the documents do not say. */
  total: number | null;
  /** The component or one of its parents is marked assumed in the data. */
  assumed: boolean;
  /** The first assumed component on the chain, whose note explains why. */
  assumedBy?: Component;
}

/**
 * Rack-wide totals for every component of the chosen types (from
 * data/display.json), in the order the types are listed and, within a type,
 * the order of the data. The rack itself is never a row.
 */
export function rackTotals(model: Model, types: readonly string[]): RackTotal[] {
  const order = new Map(types.map((t, i) => [t, i]));
  return model.topology.components
    .filter((c) => c.parent !== null && order.has(c.type as ComponentType))
    .map((c, dataIndex) => ({ c, dataIndex }))
    .sort((a, b) => order.get(a.c.type)! - order.get(b.c.type)! || a.dataIndex - b.dataIndex)
    .map(({ c }) => {
      const chain = [...model.ancestorsOf(c.id), c.id].map((id) => model.getComponent(id)!);
      const assumedBy = chain.find((x) => x.assumed);
      const row: RackTotal = { component: c, total: model.totalPerRack(c.id), assumed: assumedBy !== undefined };
      if (assumedBy) row.assumedBy = assumedBy;
      return row;
    });
}
