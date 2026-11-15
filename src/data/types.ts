// TypeScript view of data/nvl72-topology.schema.json. The schema is the
// contract; tests/schema.test.ts checks the data file against it.

export interface Source {
  url: string;
  section: string;
  /** File name under the guide's _images/ folder. */
  figure?: string;
}

export interface Provenance {
  source: Source;
  assumed?: boolean;
  note?: string;
}

export interface Spec {
  label: string;
  value: string | number;
  unit?: string;
  /** Overrides the component source for this spec. */
  source?: Source;
  assumed?: boolean;
  note?: string;
}

export type Fabric = 'InfiniBand' | 'Ethernet' | null;

export interface Network extends Provenance {
  id: string;
  number: number;
  name: string;
  description: string;
  fabric: Fabric;
}

export type ComponentType =
  | 'rack'
  | 'compute-tray'
  | 'switch-tray'
  | 'power-shelf'
  | 'tor-switch'
  | 'cpu'
  | 'gpu'
  | 'nic'
  | 'dpu'
  | 'drive'
  | 'switch-asic'
  | 'psu'
  | 'bmc'
  | 'controller'
  | 'port'
  | 'cable-cartridge'
  | 'manifold'
  | 'bus-bar';

export interface Component extends Provenance {
  id: string;
  type: ComponentType;
  name: string;
  /** Instances per parent instance; null when the guide does not say. */
  count: number | null;
  parent: string | null;
  description: string;
  function: string;
  networks: string[];
  specs: Spec[];
  rearSide?: boolean;
}

export interface RackGroup {
  component: string;
  count: number;
}

export interface Height extends Provenance {
  value: number;
}

export interface RackLayout extends Provenance {
  order: 'top-to-bottom';
  groups: RackGroup[];
  heightsRU?: Record<string, Height>;
  numbering?: Provenance & { scheme: 'top-to-bottom-per-type' };
}

export type ConnectionKind = 'network' | 'not-connected' | 'nvlink' | 'power' | 'cooling';

export interface Connection extends Provenance {
  id: string;
  from: string;
  to?: string;
  network?: string;
  kind: ConnectionKind;
  description: string;
}

export interface Topology {
  $schema?: string;
  schemaVersion: 1;
  meta: {
    title: string;
    document: { title: string; date: string; urls: string[] };
    retrieved: string;
  };
  networks: Network[];
  components: Component[];
  rackLayout: RackLayout;
  connections: Connection[];
}
