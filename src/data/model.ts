import type { Component, Connection, LinkEnd, Network, Topology, TrayLink } from './types';

/** One physical unit in the rack, e.g. compute tray 7. */
export interface RackUnit {
  /** Path segment, e.g. "compute-tray.7". */
  key: string;
  componentId: string;
  /** 1-based number within its component type, top to bottom. */
  index: number;
  /** Position from the top of the stack, in rack units (0 = top edge). */
  topRU: number;
  heightRU: number;
  /** Index of the layout group this unit belongs to. */
  group: number;
}

/** One segment of a selection path: a component and, optionally, which one. */
export interface PathSegment {
  id: string;
  index?: number;
}

export const ROOT_ID = 'rack';
const DEFAULT_HEIGHT_RU = 1;

export function createModel(topology: Topology) {
  const byId = new Map<string, Component>(topology.components.map((c) => [c.id, c]));
  const networksById = new Map<string, Network>(topology.networks.map((n) => [n.id, n]));

  const childrenById = new Map<string, Component[]>();
  for (const c of topology.components) {
    if (c.parent === null) continue;
    const list = childrenById.get(c.parent) ?? [];
    list.push(c);
    childrenById.set(c.parent, list);
  }

  function getComponent(id: string): Component | undefined {
    return byId.get(id);
  }

  function getNetwork(id: string): Network | undefined {
    return networksById.get(id);
  }

  function childrenOf(id: string): Component[] {
    return childrenById.get(id) ?? [];
  }

  /** Ancestor ids from the root down, not including the component itself. */
  function ancestorsOf(id: string): string[] {
    const chain: string[] = [];
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current && current.parent !== null) {
      if (seen.has(current.parent)) throw new Error(`Parent cycle at ${current.id}`);
      seen.add(current.parent);
      chain.unshift(current.parent);
      current = byId.get(current.parent);
    }
    return chain;
  }

  /**
   * How many of this component a whole rack has: the product of the counts
   * along its parent chain. null when any count on the way is unknown.
   */
  function totalPerRack(id: string): number | null {
    let total = 1;
    for (const cid of [...ancestorsOf(id), id]) {
      const c = byId.get(cid);
      if (!c || c.count === null) return null;
      total *= c.count;
    }
    return total;
  }

  function heightRU(componentId: string): number {
    return topology.rackLayout.heightsRU?.[componentId]?.value ?? DEFAULT_HEIGHT_RU;
  }

  const rackUnits: RackUnit[] = [];
  {
    // Lay the units out top to bottom, then number each type in its own order.
    let top = 0;
    topology.rackLayout.groups.forEach((g, groupIndex) => {
      for (let i = 0; i < g.count; i++) {
        const h = heightRU(g.component);
        rackUnits.push({ key: '', componentId: g.component, index: 0, topRU: top, heightRU: h, group: groupIndex });
        top += h;
      }
    });
    const overrides = topology.rackLayout.numbering?.overrides ?? {};
    for (const id of new Set(rackUnits.map((u) => u.componentId))) {
      const ofType = rackUnits.filter((u) => u.componentId === id);
      if (overrides[id]?.order === 'bottom-to-top') ofType.reverse();
      ofType.forEach((u, i) => {
        u.index = i + 1;
        u.key = `${id}.${i + 1}`;
      });
    }
  }
  const totalRU = rackUnits.reduce((sum, u) => sum + u.heightRU, 0);
  const rackUnitByKey = new Map(rackUnits.map((u) => [u.key, u]));
  const rackUnitCounts = new Map<string, number>();
  for (const u of rackUnits) rackUnitCounts.set(u.componentId, (rackUnitCounts.get(u.componentId) ?? 0) + 1);

  /** Components drawn as front units of the rack. */
  function isRackUnitType(componentId: string): boolean {
    return rackUnitCounts.has(componentId);
  }

  function connectionsOf(id: string): Connection[] {
    return topology.connections.filter((c) => c.from === id || c.to === id);
  }

  /** Networks of a component and every part inside it, in guide order. */
  function networksWithin(id: string): Network[] {
    const ids = new Set<string>();
    const visit = (cid: string) => {
      byId.get(cid)?.networks.forEach((n) => ids.add(n));
      childrenOf(cid).forEach((c) => visit(c.id));
    };
    visit(id);
    return topology.networks.filter((n) => ids.has(n.id));
  }

  // ---- selection paths -------------------------------------------------
  // A path names a component through its parents, below the rack:
  //   "compute-tray.7"            compute tray 7
  //   "compute-tray.7/rubin-gpu"  the Rubin GPUs of compute tray 7
  //   "compute-tray/rubin-gpu.2"  GPU 2 of any compute tray
  // An empty path is the rack itself.

  function parsePath(path: string | null | undefined): PathSegment[] | null {
    if (path === null || path === undefined || path === '') return [];
    const segments: PathSegment[] = [];
    let parent = ROOT_ID;
    for (const raw of path.split('/')) {
      const m = /^([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.([1-9][0-9]*))?$/.exec(raw);
      if (!m) return null;
      const id = m[1]!;
      const c = byId.get(id);
      if (!c || c.parent !== parent) return null;
      const segment: PathSegment = { id };
      if (m[2] !== undefined) {
        const index = Number(m[2]);
        const max = parent === ROOT_ID && isRackUnitType(id) ? rackUnitCounts.get(id)! : c.count;
        if (max === null || max === undefined || index > max) return null;
        segment.index = index;
      }
      segments.push(segment);
      parent = id;
    }
    return segments;
  }

  function formatPath(segments: PathSegment[]): string {
    return segments.map((s) => (s.index === undefined ? s.id : `${s.id}.${s.index}`)).join('/');
  }

  /** Path that names a component in general (no instance numbers). */
  function pathForComponent(id: string): string {
    if (id === ROOT_ID) return '';
    return [...ancestorsOf(id).filter((a) => a !== ROOT_ID), id].join('/');
  }

  function segmentLabel(segment: PathSegment): string {
    const c = byId.get(segment.id);
    const name = c?.name ?? segment.id;
    return segment.index === undefined ? name : `${name} ${segment.index}`;
  }

  // ---- tray interiors ---------------------------------------------------

  function trayLayout(componentId: string) {
    return topology.trayLayouts?.[componentId];
  }

  /** Path of a slot's part inside a tray, e.g. "connectx-9/ct-port-cx9-osfp" or "rubin-gpu.2". */
  function slotPathWithin(trayId: string, slot: { component: string; index?: number }): string {
    const chain = [...ancestorsOf(slot.component), slot.component];
    const below = chain.slice(chain.indexOf(trayId) + 1);
    const path = below.join('/');
    return slot.index === undefined ? path : `${path}.${slot.index}`;
  }

  /** The slot drawn for a path inside a tray, if any. */
  function slotFor(trayId: string, within: string) {
    return trayLayout(trayId)?.slots.find((s) => slotPathWithin(trayId, s) === within);
  }

  /** Path inside a tray for a link end, or null for a named point. */
  function linkEndPath(trayId: string, end: LinkEnd): string | null {
    if (end.point !== undefined) return null;
    return slotPathWithin(trayId, { component: end.component, index: end.index });
  }

  /** Links touching a path inside a tray (an instance, or every instance of a general path). */
  function linksAt(trayId: string, within: string): TrayLink[] {
    const general = within.replace(/\.\d+$/, '') === within;
    const matches = (end: LinkEnd) => {
      const p = linkEndPath(trayId, end);
      return p !== null && (p === within || (general && p.replace(/\.\d+$/, '') === within));
    };
    return (trayLayout(trayId)?.links ?? []).filter((l) => matches(l.from) || matches(l.to));
  }

  /** Display name of a link end: NVIDIA's slot label, the part name and number, or the point label. */
  function linkEndLabel(trayId: string, end: LinkEnd): string {
    const layout = trayLayout(trayId);
    if (end.point !== undefined) return layout?.points?.find((p) => p.id === end.point)?.label ?? end.point;
    const slot = layout?.slots.find((s) => s.component === end.component && s.index === end.index);
    if (slot?.label) return slot.label;
    const name = byId.get(end.component)?.name ?? end.component;
    return end.index === undefined ? name : `${name} ${end.index}`;
  }

  return {
    topology,
    trayLayout,
    linkEndPath,
    linksAt,
    linkEndLabel,
    slotPathWithin,
    slotFor,
    getComponent,
    getNetwork,
    childrenOf,
    ancestorsOf,
    totalPerRack,
    heightRU,
    rackUnits,
    rackUnitByKey,
    totalRU,
    isRackUnitType,
    connectionsOf,
    networksWithin,
    parsePath,
    formatPath,
    pathForComponent,
    segmentLabel,
  };
}

export type Model = ReturnType<typeof createModel>;
