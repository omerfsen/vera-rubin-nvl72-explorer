import { create } from 'zustand';
import { model } from '../data';
import { DEFAULT_URL_STATE, readUrlState, trayKeyOf, writeUrlState, type View } from './url';

interface ExplorerState {
  view: View;
  /** Selection path, "" for the rack itself. */
  selected: string;
  /** Rack unit key under the pointer, e.g. "compute-tray.3". */
  hovered: string | null;
  listOpen: boolean;
  /** Tray view layers: structure (bones), parts (muscles), connections (veins). */
  layers: { structure: boolean; parts: boolean; links: boolean };
  toggleLayer: (layer: 'structure' | 'parts' | 'links') => void;
  select: (path: string) => void;
  setHovered: (key: string | null) => void;
  setListOpen: (open: boolean) => void;
  /** Move the selection up or down the rack by whole units. */
  stepRackUnit: (delta: number) => void;
  /** Open the interior of the selected unit, if it has one. */
  openTray: () => void;
  /** Go back to the rack, keeping the unit selected. */
  closeTray: () => void;
  /** In the tray view: move to the next or previous drawn part. */
  stepTrayPart: (delta: number) => void;
  /** Escape: up one level, and out of the tray view at its top. */
  goUp: () => void;
}

const initial =
  typeof window === 'undefined' ? DEFAULT_URL_STATE : readUrlState(window.location.search, model);

export const useExplorer = create<ExplorerState>((set, get) => ({
  view: initial.view,
  selected: initial.select,
  hovered: null,
  listOpen: initial.list,
  layers: { structure: true, parts: true, links: true },
  toggleLayer: (layer) => set({ layers: { ...get().layers, [layer]: !get().layers[layer] } }),
  select: (path) => {
    const segments = model.parsePath(path);
    const selected = segments === null ? '' : model.formatPath(segments);
    // The tray view only makes sense while something inside an openable unit is selected.
    const view = get().view === 'tray' && trayKeyOf(selected, model) === null ? 'rack' : get().view;
    set({ selected, view });
  },
  openTray: () => {
    const key = trayKeyOf(get().selected, model);
    if (key) set({ view: 'tray', hovered: null });
  },
  closeTray: () => {
    const key = trayKeyOf(get().selected, model);
    set({ view: 'rack', hovered: null, selected: key ?? get().selected });
  },
  goUp: () => {
    const { selected, view } = get();
    const key = trayKeyOf(selected, model);
    if (view === 'tray' && selected === key) {
      set({ view: 'rack', hovered: null });
      return;
    }
    if (selected === '') return;
    get().select(selected.split('/').slice(0, -1).join('/'));
  },
  stepTrayPart: (delta) => {
    const step = Math.trunc(delta);
    const key = trayKeyOf(get().selected, model);
    if (!key || step === 0) return;
    const trayId = key.split('.')[0]!;
    // One stop per distinct part path, in layout order.
    const paths = [...new Set((model.trayLayout(trayId)?.slots ?? []).map((s) => `${key}/${model.slotPathWithin(trayId, s)}`))];
    if (paths.length === 0) return;
    const current = paths.indexOf(get().selected);
    const next = current === -1 ? (step > 0 ? 0 : paths.length - 1) : Math.min(paths.length - 1, Math.max(0, current + step));
    set({ selected: paths[next]! });
  },
  setHovered: (key) => set({ hovered: key }),
  setListOpen: (open) => set({ listOpen: open }),
  stepRackUnit: (delta) => {
    const step = Math.trunc(delta);
    const units = model.rackUnits;
    if (step === 0 || !Number.isFinite(step) || units.length === 0) return;
    const segments = model.parsePath(get().selected) ?? [];
    const first = segments[0];
    let next: number;
    if (first && first.index !== undefined && model.isRackUnitType(first.id)) {
      const current = units.findIndex((u) => u.key === `${first.id}.${first.index}`);
      next = Math.min(units.length - 1, Math.max(0, current + step));
      // At either end, keep the selection (including any part inside the unit).
      if (next === current) return;
    } else if (first && model.isRackUnitType(first.id)) {
      // A unit type in general: start from its first or last unit.
      const ofType = units.map((u, i) => [u, i] as const).filter(([u]) => u.componentId === first.id);
      next = (step > 0 ? ofType[0] : ofType[ofType.length - 1])![1];
    } else {
      next = step > 0 ? 0 : units.length - 1;
    }
    set({ selected: units[next]!.key });
  },
}));

/** Keep the address bar in step with the store. */
export function syncUrl(): () => void {
  const write = (s: ExplorerState) => {
    const search = writeUrlState(window.location.search, { view: s.view, select: s.selected, list: s.listOpen });
    if (search === window.location.search) return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
  };
  // Canonicalize once at start, e.g. drop an invalid ?select= from a shared link.
  write(useExplorer.getState());
  return useExplorer.subscribe(write);
}
