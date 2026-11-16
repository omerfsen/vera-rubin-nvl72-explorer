import { create } from 'zustand';
import { model } from '../data';
import { DEFAULT_URL_STATE, readUrlState, trayKeyOf, writeUrlState, type View } from './url';
import { initialLang, storeLang, storedLang, type Lang } from '../i18n/lang';
import { applyTheme, darkQuery, resolveTheme, storedThemePref, storeThemePref, type Theme, type ThemePref } from '../theme';

interface ExplorerState {
  view: View;
  /** Selection path, "" for the rack itself. */
  selected: string;
  /** Rack unit key under the pointer, e.g. "compute-tray.3". */
  hovered: string | null;
  listOpen: boolean;
  /** Tray view layers: structure (bones), parts (muscles), connections (veins). */
  layers: { structure: boolean; parts: boolean; links: boolean };
  /** Tray view: parts spread apart by layer so each can be seen and clicked. */
  exploded: boolean;
  toggleExploded: () => void;
  /** Network shown by the overlay, or "" for none. */
  network: string;
  setNetwork: (id: string) => void;
  /** Service procedure in progress ("" for none) and its 0-based step. */
  procedure: string;
  step: number;
  startProcedure: (id: string) => void;
  goToStep: (step: number) => void;
  stopProcedure: () => void;
  page: string;
  setPage: (page: string) => void;
  embed: boolean;
  /** Interface language. */
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Colour theme the viewer chose, and the theme it resolves to now. */
  themePref: ThemePref;
  theme: Theme;
  setThemePref: (pref: ThemePref) => void;
  /** Whether the details panel on the right is expanded; remembered per browser. */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
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
  /** Look at the rack from the front or the rear. */
  setSide: (side: 'rack' | 'rear') => void;
}

const initial =
  typeof window === 'undefined' ? DEFAULT_URL_STATE : readUrlState(window.location.search, model);
const initialLanguage: Lang =
  typeof window === 'undefined' ? 'en' : initialLang(initial.lang, storedLang(), window.navigator?.language);

export const PANEL_STORAGE_KEY = 'nvl72-explorer.panel';

function storedPanelOpen(): boolean {
  try {
    return typeof window === 'undefined' || window.localStorage.getItem(PANEL_STORAGE_KEY) !== 'closed';
  } catch {
    return true;
  }
}

function storePanelOpen(open: boolean): void {
  try {
    if (open) window.localStorage.removeItem(PANEL_STORAGE_KEY);
    else window.localStorage.setItem(PANEL_STORAGE_KEY, 'closed');
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

const initialThemePref: ThemePref = typeof window === 'undefined' ? 'system' : storedThemePref();

export const useExplorer = create<ExplorerState>((set, get) => ({
  themePref: initialThemePref,
  theme: resolveTheme(initialThemePref, darkQuery()?.matches ?? null),
  setThemePref: (pref) => {
    storeThemePref(pref);
    set({ themePref: pref, theme: resolveTheme(pref, darkQuery()?.matches ?? null) });
  },
  view: initial.view,
  selected: initial.select,
  hovered: null,
  listOpen: initial.list,
  panelOpen: storedPanelOpen(),
  setPanelOpen: (open) => {
    storePanelOpen(open);
    set({ panelOpen: open });
  },
  layers: { structure: true, parts: true, links: true },
  exploded: false,
  toggleExploded: () => set({ exploded: !get().exploded }),
  network: initial.net ?? '',
  setNetwork: (id) => set({ network: get().network === id ? '' : id }),
  procedure: initial.proc ?? '',
  step: initial.step ?? 0,
  startProcedure: (id) => {
    set({ procedure: id, step: 0, page: '' });
    get().goToStep(0);
  },
  goToStep: (step) => {
    const proc = (model.topology.procedures ?? []).find((p) => p.id === get().procedure);
    if (!proc) return;
    const n = Math.min(proc.steps.length - 1, Math.max(0, step));
    set({ step: n });
    // Show the part the step is about, opening its unit when it has an interior.
    const target = proc.steps[n]!.target;
    if (target !== undefined) {
      get().select(target);
      if (target.includes('/') && trayKeyOf(target, model)) set({ view: 'tray' });
    }
  },
  stopProcedure: () => set({ procedure: '', step: 0 }),
  page: initial.page ?? '',
  setPage: (page) => set({ page }),
  embed: initial.embed ?? false,
  lang: initialLanguage,
  setLang: (lang) => {
    storeLang(lang);
    set({ lang });
  },
  toggleLayer: (layer) => set({ layers: { ...get().layers, [layer]: !get().layers[layer] } }),
  select: (path) => {
    const segments = model.parsePath(path);
    const selected = segments === null ? '' : model.formatPath(segments);
    // The tray view only makes sense while something inside an openable unit is
    // selected; a rear part is only visible from the rear.
    let view = get().view;
    if (view === 'tray' && trayKeyOf(selected, model) === null) view = 'rack';
    const first = segments?.[0];
    if (first && model.getComponent(first.id)?.rearSide) view = 'rear';
    set({ selected, view });
  },
  setSide: (side) => set({ view: side, hovered: null }),
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

// A shared link that opens a walkthrough step also shows the part that step is about.
if (initial.proc) useExplorer.getState().goToStep(initial.step ?? 0);

/** Keep the address bar in step with the store. */
export function syncUrl(): () => void {
  const write = (s: ExplorerState) => {
    const search = writeUrlState(window.location.search, {
      view: s.view,
      select: s.selected,
      list: s.listOpen,
      net: s.network,
      proc: s.procedure,
      step: s.step,
      page: s.page,
      embed: s.embed,
      lang: s.lang,
    });
    if (document.documentElement.lang !== s.lang) document.documentElement.lang = s.lang;
    if (search === window.location.search) return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
  };
  // Canonicalize once at start, e.g. drop an invalid ?select= from a shared link.
  write(useExplorer.getState());
  return useExplorer.subscribe(write);
}

/** Keep the page root on the current theme, and follow the OS while System is chosen. */
export function syncTheme(): () => void {
  applyTheme(useExplorer.getState().theme);
  const unsubscribe = useExplorer.subscribe((s) => applyTheme(s.theme));
  const query = darkQuery();
  const onChange = () => {
    const s = useExplorer.getState();
    const theme = resolveTheme(s.themePref, query?.matches ?? null);
    if (theme !== s.theme) useExplorer.setState({ theme });
  };
  query?.addEventListener('change', onChange);
  return () => {
    unsubscribe();
    query?.removeEventListener('change', onChange);
  };
}
