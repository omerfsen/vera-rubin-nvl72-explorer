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
  /** Move the selection up or down the rack. */
  stepRackUnit: (delta: number) => void;
}

const initial =
  typeof window === 'undefined' ? DEFAULT_URL_STATE : readUrlState(window.location.search, model);

export const useExplorer = create<ExplorerState>((set, get) => ({
  view: initial.view,
  selected: initial.select,
  hovered: null,
  listOpen: false,
  select: (path) => {
    const segments = model.parsePath(path);
    set({ selected: segments === null ? '' : model.formatPath(segments) });
  },
  setHovered: (key) => set({ hovered: key }),
  setListOpen: (open) => set({ listOpen: open }),
  stepRackUnit: (delta) => {
    const units = model.rackUnits;
    if (units.length === 0) return;
    const first = get().selected.split('/')[0] ?? '';
    const current = units.findIndex((u) => u.key === first);
    const next =
      current === -1
        ? delta > 0
          ? 0
          : units.length - 1
        : Math.min(units.length - 1, Math.max(0, current + delta));
    set({ selected: units[next]!.key });
  },
}));

/** Keep the address bar in step with the store, and follow back/forward. */
export function syncUrl(): () => void {
  let last = '';
  const unsubscribe = useExplorer.subscribe((s) => {
    const search = writeUrlState(window.location.search, { view: s.view, select: s.selected });
    if (search === last) return;
    last = search;
    const url = `${window.location.pathname}${search}${window.location.hash}`;
    window.history.replaceState(null, '', url);
  });
  const onPop = () => {
    const state = readUrlState(window.location.search, model);
    useExplorer.setState({ view: state.view, selected: state.select });
  };
  window.addEventListener('popstate', onPop);
  return () => {
    unsubscribe();
    window.removeEventListener('popstate', onPop);
  };
}
