import raw from '../../data/nvl72-topology.json';
import { createModel } from './model';
import type { Topology } from './types';

// The JSON is checked against the schema in tests; here it is only typed.
export const topology = raw as unknown as Topology;
export const model = createModel(topology);
export type { Model } from './model';
