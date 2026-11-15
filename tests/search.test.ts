import { describe, expect, it } from 'vitest';
import { model } from '../src/data';
import { search } from '../src/components/search';

const paths = (q: string) => search(model, q).map((h) => h.path);

describe('search', () => {
  it('finds parts by name, type and network', () => {
    expect(paths('gpu')).toContain('compute-tray/rubin-gpu');
    expect(paths('bluefield')).toContain('compute-tray/bluefield-4');
    expect(paths('storagenet')).toContain('compute-tray/bluefield-4/ct-port-bf4-right');
  });

  it('finds numbered rack units in rack order', () => {
    expect(paths('compute tray 7')[0]).toBe('compute-tray.7');
    expect(paths('tray 7')).toEqual(['compute-tray.7', 'switch-tray.7']);
    expect(paths('switch tray 3')).toEqual(['switch-tray.3']);
    expect(paths('tray 1')).not.toContain('compute-tray.10');
  });

  it('finds numbered parts, with GPUs and CPUs numbered from 0 as in NVIDIA Fig. 4', () => {
    // NVIDIA's GPU2 (HPM_R GPU_2) is the third GPU in the URL.
    expect(paths('gpu 2')).toEqual(['compute-tray/rubin-gpu.3']);
    expect(paths('gpu 0')).toEqual(['compute-tray/rubin-gpu.1']);
    expect(paths('gpu 4')).toEqual([]);
    expect(paths('cpu 0')).toEqual(['compute-tray/vera-cpu.1']);
    expect(search(model, 'gpu 2')[0]!.label).toBe('Rubin GPU 2');
    expect(paths('psu 3')).toEqual(['power-shelf/psu.3']);
    expect(paths('gpu 9')).toEqual([]);
  });

  it('reaches switch tray 6 although 6 is in its name', () => {
    expect(paths('switch tray 6')).toEqual(['switch-tray.6']);
    expect(paths('nvlink 6 switch tray 6')).toEqual(['switch-tray.6']);
    expect(paths('nvlink 6')[0]).toBe('switch-tray');
  });

  it('matches Latin words at the start of a word and network names whole', () => {
    expect(paths('tor 2')).not.toContain('compute-tray.2');
    expect(paths('tor 2')[0]).toBe('tor-switch.2');
    expect(paths('tor')).not.toContain('compute-tray/ct-nvlink-connectors');
  });

  it('finds the labels NVIDIA prints in its figures and the service manual', () => {
    expect(paths('c7/c3_1')).toEqual(['compute-tray/ct-port-cx9-osfp.7']);
    expect(paths('Bay_B_R_E1.s_Top')).toEqual(['compute-tray/e1s-cache-drive.3']);
    expect(paths('bf_1')).toContain('compute-tray/bluefield-4/ct-port-bf4-left.1');
  });

  it('keeps one row per bus when two Table 2.4 rows name the same part', () => {
    expect(search(model, 'mac_addr1').map((h) => h.detail).sort()).toEqual(['0005:41:00.0', '000d:41:00.0']);
    expect(search(model, '0002:a').map((h) => h.detail).sort()).toEqual(['0002:a1:00.0', '0002:a2:00.0']);
  });

  it('treats a number in a name as part of the name', () => {
    expect(paths('nvlink 6')[0]).toBe('switch-tray');
    expect(paths('bluefield 4')).toContain('compute-tray/bluefield-4');
    expect(paths('nvlink 6 switch tray 3')).toEqual(['switch-tray.3']);
  });

  it('returns nothing for an empty query', () => {
    expect(search(model, '   ')).toEqual([]);
  });
});
