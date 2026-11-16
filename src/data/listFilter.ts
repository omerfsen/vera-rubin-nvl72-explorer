import type { Model, RackUnit } from './model';

/** Filter of the rack list: OR within each row, AND across rows. Empty row = no filter on it. */
export interface ListFilter {
  /** Rack unit component ids, e.g. "compute-tray". */
  types: string[];
  /** Network ids. */
  nets: string[];
}

export const NO_FILTER: ListFilter = { types: [], nets: [] };

/** The rack unit types in the order they first appear, top to bottom. */
export function filterTypes(model: Model): string[] {
  return [...new Set(model.rackUnits.map((u) => u.componentId))];
}

/**
 * Rack unit types on each network, from the same membership the 3D overlay
 * uses: a unit type is on a network when it, or any part inside it, has a
 * connection to it. Stated, assumed and alternative readings all count, so
 * the list shows exactly the units the overlay lights up.
 */
export function unitTypesByNetwork(model: Model): Map<string, Set<string>> {
  return new Map(model.topology.networks.map((n) => [n.id, model.networkMembers(n.id).unitTypes]));
}

/** Networks with at least one rack unit on them, in guide order. */
export function filterNetworks(model: Model): string[] {
  const byNet = unitTypesByNetwork(model);
  return model.topology.networks.filter((n) => (byNet.get(n.id)?.size ?? 0) > 0).map((n) => n.id);
}

export function isFiltering(filter: ListFilter): boolean {
  return filter.types.length > 0 || filter.nets.length > 0;
}

/** Whether a unit passes the filter. */
export function unitMatches(unit: RackUnit, filter: ListFilter, byNet: Map<string, Set<string>>): boolean {
  if (filter.types.length > 0 && !filter.types.includes(unit.componentId)) return false;
  if (filter.nets.length > 0 && !filter.nets.some((n) => byNet.get(n)?.has(unit.componentId))) return false;
  return true;
}

export function filterUnits(model: Model, filter: ListFilter): RackUnit[] {
  const byNet = unitTypesByNetwork(model);
  return model.rackUnits.filter((u) => unitMatches(u, filter, byNet));
}

/** Add the value if missing, remove it if present, keeping the order of `all`. */
export function toggleIn(list: string[], value: string, all: string[]): string[] {
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  return all.filter((v) => next.includes(v));
}

/** Read a comma-separated list from the URL, keeping only allowed values, once each, in their canonical order. */
export function parseFilterList(raw: string | null | undefined, allowed: string[]): string[] {
  const given = new Set((raw ?? '').split(',').map((s) => s.trim()));
  return allowed.filter((v) => given.has(v));
}
