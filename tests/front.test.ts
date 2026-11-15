import { describe, expect, it } from 'vitest';
import { facePlates, managementLinks } from '../src/scenes/FrontScene';

describe('rack front detail', () => {
  it('draws front-face detail for every unit type, and slides it with the selected unit', () => {
    const plates = facePlates(null);
    const units = new Set(plates.map((p) => p.unitKey.split('.')[0]));
    expect([...units].sort()).toEqual(['compute-tray', 'power-shelf', 'switch-tray', 'tor-switch']);
    expect(plates.filter((p) => p.unitKey === 'tor-switch.1' && p.component === 'tor-rj45-port')).toHaveLength(48);
    expect(plates.filter((p) => p.unitKey === 'power-shelf.2' && p.component === 'psu')).toHaveLength(6);
    expect(plates.filter((p) => p.unitKey === 'power-shelf.2' && p.component === 'psu:led')).toHaveLength(6);
    const slid = facePlates('compute-tray.3').find((p) => p.unitKey === 'compute-tray.3')!;
    const still = plates.find((p) => p.unitKey === 'compute-tray.3')!;
    expect(slid.position[2]).toBeGreaterThan(still.position[2]);
  });

  it('draws the BMC links section 1.5 lists, and the switch tray links as assumed', () => {
    const { stated, assumed } = managementLinks();
    // 1.5 lists the compute trays' out-of-band BMC and BlueField-4 BMC ports.
    expect(stated).toHaveLength(18 + 18);
    // It says the switch trays are connected but not through which port.
    expect(assumed).toHaveLength(9);
  });
});
