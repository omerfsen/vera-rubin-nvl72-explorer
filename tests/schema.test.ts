import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../data/nvl72-topology.schema.json';
import data from '../data/nvl72-topology.json';

function validator() {
  // strictRequired is off because the "assumed needs a note" rule lives in if/then.
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

describe('data/nvl72-topology.json', () => {
  it('matches the JSON Schema', () => {
    const validate = validator();
    const ok = validate(data);
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('rejects an assumed fact without a note', () => {
    const validate = validator();
    const broken = structuredClone(data) as { components: Record<string, unknown>[] };
    broken.components[0]!.assumed = true;
    delete broken.components[0]!.note;
    expect(validate(broken)).toBe(false);
  });

  it('rejects a component without a source', () => {
    const validate = validator();
    const broken = structuredClone(data) as { components: Record<string, unknown>[] };
    delete broken.components[1]!.source;
    expect(validate(broken)).toBe(false);
  });

  it('rejects a source outside the NVIDIA DGX VR user guide', () => {
    const validate = validator();
    const broken = structuredClone(data) as { components: { source: { url: string } }[] };
    broken.components[1]!.source.url = 'https://example.com/somewhere';
    expect(validate(broken)).toBe(false);
  });

  it('rejects a page of the docs site that is not part of this guide', () => {
    const validate = validator();
    const broken = structuredClone(data) as { components: { source: { url: string } }[] };
    broken.components[1]!.source.url = 'https://docs.nvidia.com/dgx/dgxvr-user-guide/../../other/page.html';
    expect(validate(broken)).toBe(false);
  });

  it('rejects a figure that is not one of the 13 allowed files', () => {
    const validate = validator();
    const broken = structuredClone(data) as { components: { source: { figure?: string } }[] };
    broken.components[1]!.source.figure = 'nvidia-logo.png';
    expect(validate(broken)).toBe(false);
  });

  it('rejects a blank note on an assumed fact', () => {
    const validate = validator();
    const broken = structuredClone(data) as { rackLayout: { numbering: { note: string } } };
    broken.rackLayout.numbering.note = '   ';
    expect(validate(broken)).toBe(false);
  });

  it('rejects a network connection that goes nowhere', () => {
    const validate = validator();
    const broken = structuredClone(data) as { connections: Record<string, unknown>[] };
    const link = broken.connections.find((c) => c.kind === 'network' && c.network)!;
    delete link.network;
    delete link.to;
    expect(validate(broken)).toBe(false);
  });

  it('rejects a not-connected port that names a network', () => {
    const validate = validator();
    const broken = structuredClone(data) as { connections: Record<string, unknown>[] };
    broken.connections.find((c) => c.kind === 'not-connected')!.network = 'ipminet';
    expect(validate(broken)).toBe(false);
  });

  it('requires a source for a stated fabric', () => {
    const validate = validator();
    const broken = structuredClone(data) as { networks: Record<string, unknown>[] };
    delete broken.networks.find((n) => n.fabric)!.fabricSource;
    expect(validate(broken)).toBe(false);
  });

  it('rejects unknown fields', () => {
    const validate = validator();
    const broken = structuredClone(data) as { components: Record<string, unknown>[] };
    broken.components[1]!.colour = 'green';
    expect(validate(broken)).toBe(false);
  });
});
