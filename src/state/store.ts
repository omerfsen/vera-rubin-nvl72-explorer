import { create } from 'zustand';
import { model } from '../data';
import { DEFAULT_URL_STATE, readUrlState, writeUrlState, type View } from './url';

interface ExplorerState {
  view: View;
  /** Selection path, "" for the rack itself. */
  selected: string;
  /** Rack unit key under the pointer, e.g. "compute-tray.3". */
  hovered: string | null;
  listOpen: boolean;
  select: (path: string) => void;
  setHovered: (key: string | null) => void;
  setListOpen: (open: boolean) => void;
  /** Move the selection up or down the rack by whole units. */
  stepRackUnit: (delta: number) => void;
}

const initial =
  typeof window === 'undefined' ? DEFAULT_URL_STATE : readUrlState(window.location.search, model);

export const useExplorer = create<ExplorerState>((set, get) => ({
  view: initial.view,
  selected: initial.select,
  hovered: null,
  listOpen: initial.list,
  select: (path) => {
    const segments = model.parsePath(path);
    set({ selected: segments === null ? '' : model.formatPath(segments) });
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
