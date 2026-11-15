import { describe, expect, it } from 'vitest';
import { facePlates, managementLinks } from '../src/scenes/FrontScene';

describe('rack front detail', () => {
  it('draws front-face detail for every unit type, and slides it with the selected unit', () => {
    const plates = facePlates(null);
    const units = new Set(plates.map((p) => p.unitKey.split('.')[0]));
    expect([...units].sort()).toEqual(['compute-tray', 'power-shelf', 'switch-tray', 'tor-switch']);
    expect(plates.filter((p) => p.unitKey === 'tor-switch.1' && p.component === 'tor-rj45-port')).toHaveLength(48);
    expect(plates.filter((p) => p.unitKey === 'power-shelf.2' && p.component === 'psu')).toHaveLength(6);
    expect(plates.filter((p) => p.unitKey === 'power-shelf.2' && p.component === 'psu:led')).toHaveLength(12);
    const slid = facePlates('compute-tray.3').find((p) => p.unitKey === 'compute-tray.3')!;
    const still = plates.find((p) => p.unitKey === 'compute-tray.3')!;
    expect(slid.position[2]).toBeGreaterThan(still.position[2]);
  });

  it('draws the 45 BMC links of section 1.5 to the ToR switches', () => {
    expect(managementLinks()).toHaveLength(18 + 18 + 9);
  });
});
