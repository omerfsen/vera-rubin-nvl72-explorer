import { describe, expect, it } from 'vitest';
import { model, topology } from '../src/data';

describe('Table 2.4 PCIe devices', () => {
  const rows = topology.pcieDevices ?? [];

  it('keeps all 24 rows of the two tables', () => {
    expect(rows).toHaveLength(24);
  });

  it('maps every row to a real part, and every numbered part to an instance within its count', () => {
    for (const r of rows) {
      const c = model.getComponent(r.component);
      expect(c, r.label).toBeDefined();
      if (r.index !== undefined) expect(r.index, r.label).toBeLessThanOrEqual(c!.count ?? 0);
      const path = model.pathForComponent(r.component).replace(/^compute-tray/, 'compute-tray.1') + (r.index ? `.${r.index}` : '');
      expect(model.parsePath(path), path).not.toBeNull();
    }
  });

  it('gives each OSFP cage the label the PCIe table uses for it', () => {
    const slots = topology.trayLayouts!['compute-tray']!.slots.filter((s) => s.component === 'ct-port-cx9-osfp');
    for (const s of slots) {
      const row = rows.find((r) => r.component === 'ct-port-cx9-osfp' && r.index === s.index)!;
      expect(row.label, `cage ${s.index}`).toBe(s.label);
    }
    expect(rows.find((r) => r.rdma === 'mlx5_0')?.interface).toBe('enP1p3s0f0np0');
  });
});

describe('service procedures', () => {
  const procs = topology.procedures ?? [];

  it('covers all five customer-replaceable units from the service manual', () => {
    expect(procs.filter((p) => p.kind === 'service').map((p) => p.component).sort()).toEqual(
      ['compute-tray-battery', 'e1s-cache-drive', 'power-shelf-mgmt-module', 'psu', 'switch-tray-battery'].sort(),
    );
    for (const p of procs.filter((x) => x.kind === 'service')) {
      const cru = model.getComponent(p.component)?.specs.find((s) => s.label === 'Customer-replaceable unit (CRU)');
      expect(cru?.value, p.id).toBe('Yes');
    }
  });

  it('points every step at a part the app can select, and cites the service manual', () => {
    for (const p of procs) {
      for (const step of p.steps) {
        if (step.target) expect(model.parsePath(step.target), `${p.id}: ${step.target}`).not.toBeNull();
        expect(step.source.url, p.id).toMatch(p.kind === 'service' ? /dgxvr-service-manual/ : /dgxvr-user-guide/);
      }
    }
  });
});

describe('operations from the user guide', () => {
  it('has the bring-up, cold and warm reboot, post-reboot and NVSM health check walkthroughs', () => {
    const ops = (topology.procedures ?? []).filter((p) => p.kind === 'operation').map((p) => p.id);
    expect(ops).toEqual(['bring-up', 'cold-reboot', 'warm-reboot', 'post-reboot', 'health-check']);
  });

  it('keeps every compute tray BMC command from section 6.4.1, verbatim', () => {
    const cmds = topology.commands ?? [];
    expect(cmds).toHaveLength(30);
    const off = cmds.find((c) => c.id === 'force-power-off')!;
    expect(off.command).toContain('{"ResetType": "ForceOff"}');
    expect(off.command).toContain('/redfish/v1/Systems/System_0/Actions/ComputerSystem.Reset');
    for (const c of cmds) expect(c.source.section, c.id).toMatch(/^6\.4\.1\.\d+/);
  });

  it('puts software on real parts and safety notes on real parts and walkthroughs', () => {
    const ids = new Set(topology.components.map((c) => c.id));
    const procs = new Set((topology.procedures ?? []).map((p) => p.id));
    for (const s of topology.software ?? []) for (const id of s.runsOn) expect(ids, s.id).toContain(id);
    for (const s of topology.safety ?? []) {
      for (const id of s.components) expect(ids, s.id).toContain(id);
      for (const id of s.procedures) expect(procs, s.id).toContain(id);
    }
  });
});
