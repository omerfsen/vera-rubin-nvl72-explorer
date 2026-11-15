import { describe, expect, it } from 'vitest';
import { normalizeBase } from '../vite.config';
import { SHOW_OFFICIAL_FIGURES, officialFigureUrl } from '../src/config/flags';

describe('base path', () => {
  it('normalizes VITE_BASE_PATH to a slash-wrapped path', () => {
    expect(normalizeBase(undefined)).toBe('/');
    expect(normalizeBase('')).toBe('/');
    expect(normalizeBase('/')).toBe('/');
    expect(normalizeBase('vera-rubin-nvl72-explorer')).toBe('/vera-rubin-nvl72-explorer/');
    expect(normalizeBase('/vera-rubin-nvl72-explorer')).toBe('/vera-rubin-nvl72-explorer/');
    expect(normalizeBase('/a/b/')).toBe('/a/b/');
  });
});

describe('SHOW_OFFICIAL_FIGURES', () => {
  it('is off by default', () => {
    expect(SHOW_OFFICIAL_FIGURES).toBe(false);
  });

  it('only ever links to docs.nvidia.com', () => {
    expect(officialFigureUrl('hardware-rack-configuration-VRNVL72.png')).toBe(
      'https://docs.nvidia.com/dgx/dgxvr-user-guide/_images/hardware-rack-configuration-VRNVL72.png',
    );
  });
});
