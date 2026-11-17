import { create } from 'zustand';
import { model } from '../data';
import { DEFAULT_URL_STATE, canonicalPath, readUrlState, trayKeyOf, writeUrlState, type View } from './url';
import { trayLinkKinds } from '../data/linkFilter';
import { NO_FILTER, filterNetworks, filterTypes, toggleIn, type ListFilter } from '../data/listFilter';
import { answerFromSelection, generateQuiz, isValidSeed, newSeed, type QuizQuestion } from '../data/quiz';
import { TOUR_STEPS, showsTourStep } from '../data/tour';
import { initialLang, storeLang, storedLang, type Lang } from '../i18n/lang';
import { initialHintOpen, storeHintSeen } from './firstVisit';
import { applyTheme, darkQuery, resolveTheme, storedThemePref, storeThemePref, type Theme, type ThemePref } from '../theme';

export interface QuizState {
  seed: number;
  questions: QuizQuestion[];
  /** 0-based question being asked. */
  index: number;
  score: number;
  /** The answer to the current question, once given: a component id, total or network id. */
  answer: { given: string; correct: boolean } | null;
  done: boolean;
}

/** What the "Start here" tour puts back when it ends. */
export interface TourRestore {
  view: View;
  selected: string;
  network: string;
  page: string;
  procedure: string;
  step: number;
  compare: string;
}

interface ExplorerState {
  /** "Start here" tour in progress: its 0-based step and the state to put back on exit; null when off. */
  tour: { index: number; restore: TourRestore } | null;
  /** Start at the first step, or at `index` for a shared link; `restore` replaces what is on screen as the state to put back. */
  startTour: (index?: number, restore?: TourRestore) => void;
  /** Show a tour step; clamped to the first and last. */
  goToTourStep: (index: number) => void;
  /** End the tour and put back what was on screen before it started. */
  stopTour: () => void;
  /** Quiz round in progress, or null. */
  quiz: QuizState | null;
  /** Start a round; the same seed gives the same questions. */
  startQuiz: (seed?: number) => void;
  /** Answer the current question; ignored once it has an answer. */
  answerQuiz: (given: string) => void;
  nextQuizQuestion: () => void;
  quitQuiz: () => void;
  view: View;
  /** Selection path, "" for the rack itself. */
  selected: string;
  /** Rack unit key under the pointer, e.g. "compute-tray.3". */
  hovered: string | null;
  listOpen: boolean;
  /** Tray view layers: structure (bones), parts (muscles), connections (veins). */
  layers: { structure: boolean; parts: boolean; links: boolean };
  /** Connection kinds hidden in the tray view; empty shows every kind. */
  hiddenLinkKinds: string[];
  /** Hide a connection kind, or show it again. */
  toggleLinkKind: (kind: string) => void;
  /** Show every connection kind again. */
  showAllLinkKinds: () => void;
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
  /** Part pinned on the left of a comparison, "" when not comparing; the selection is the right side. */
  compare: string;
  /** Pin a part (the current selection by default) as the left side. */
  startCompare: (path?: string) => void;
  /** Swap the pinned part and the selection. */
  swapCompare: () => void;
  /** Drop the right side: go back to the pinned part and pick another. */
  clearCompare: () => void;
  stopCompare: () => void;
  /** Filter of the list view; does not touch the 3D network overlay. */
  listFilter: ListFilter;
  toggleListType: (type: string) => void;
  toggleListNet: (network: string) => void;
  clearListFilter: () => void;
  /** The first-visit hint card over the stage is showing. */
  hintOpen: boolean;
  /** Bring the hint back (the "?" button). */
  showHint: () => void;
  /** Close the hint and remember it in this browser. */
  dismissHint: () => void;
}

/** What a tour opened from a shared link puts back: the rack as it first loads. */
export const TOUR_HOME: TourRestore = { view: DEFAULT_URL_STATE.view, selected: '', network: '', page: '', procedure: '', step: 0, compare: '' };

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
  tour: null,
  startTour: (index = 0, restoreTo) => {
    if (TOUR_STEPS.length === 0) return;
    const { view, selected, network, page, procedure, step, compare } = get();
    const restore = restoreTo ?? get().tour?.restore ?? { view, selected, network, page, procedure, step, compare };
    set({ tour: { index: 0, restore }, quiz: null, procedure: '', step: 0, compare: '', panelOpen: true, hintOpen: false });
    get().goToTourStep(index);
  },
  goToTourStep: (index) => {
    const tour = get().tour;
    if (!tour) return;
    const n = Math.min(TOUR_STEPS.length - 1, Math.max(0, Math.trunc(index) || 0));
    const s = TOUR_STEPS[n]!;
    set({ tour: { ...tour, index: n }, page: s.page ?? '', network: s.network ?? '', hovered: null });
    get().select(s.target);
    // select() already moves to the rear for a rear part; open the unit when the step asks for its interior.
    const view = s.view === 'tray' && trayKeyOf(get().selected, model) === null ? 'rack' : s.view;
    set({ view });
  },
  stopTour: () => {
    const tour = get().tour;
    if (!tour) return;
    const r = tour.restore;
    set({ tour: null, page: r.page, network: r.network, procedure: r.procedure, step: r.step, compare: r.compare, hovered: null });
    get().select(r.selected);
    set({ view: r.view === 'tray' && trayKeyOf(get().selected, model) === null ? 'rack' : r.view });
  },
  quiz: null,
  startQuiz: (seed) => {
    const s = isValidSeed(seed) ? seed : newSeed();
    const questions = generateQuiz(model, s);
    if (questions.length === 0) return;
    // A fresh view so the panel does not already show an answer; the panel shows the question.
    set({
      quiz: { seed: s, questions, index: 0, score: 0, answer: null, done: false },
      tour: null,
      procedure: '',
      step: 0,
      page: '',
      network: '',
      selected: '',
      view: 'rack',
      hovered: null,
      panelOpen: true,
    });
  },
  answerQuiz: (given) => {
    const quiz = get().quiz;
    if (!quiz || quiz.done || quiz.answer) return;
    const q = quiz.questions[quiz.index]!;
    const correct = given === q.answer;
    set({ quiz: { ...quiz, answer: { given, correct }, score: quiz.score + (correct ? 1 : 0) } });
  },
  nextQuizQuestion: () => {
    const quiz = get().quiz;
    if (!quiz || quiz.done || !quiz.answer) return;
    const index = quiz.index + 1;
    set({ quiz: index >= quiz.questions.length ? { ...quiz, done: true } : { ...quiz, index, answer: null } });
  },
  quitQuiz: () => set({ quiz: null }),
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
  hiddenLinkKinds: initial.lk ?? [],
  toggleLinkKind: (kind) => {
    const all = trayLinkKinds(model);
    if (!all.includes(kind)) return;
    set({ hiddenLinkKinds: toggleIn(get().hiddenLinkKinds, kind, all) });
  },
  showAllLinkKinds: () => set({ hiddenLinkKinds: [] }),
  exploded: false,
  toggleExploded: () => set({ exploded: !get().exploded }),
  network: initial.net ?? '',
  setNetwork: (id) => set({ network: get().network === id ? '' : id }),
  procedure: initial.proc ?? '',
  step: initial.step ?? 0,
  startProcedure: (id) => {
    set({ procedure: id, step: 0, page: '', tour: null });
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
    // While a quiz asks for a part, picking one answers it.
    const quiz = get().quiz;
    const q = quiz && !quiz.done && !quiz.answer ? quiz.questions[quiz.index] : undefined;
    if (q) {
      const given = answerFromSelection(model, q, selected);
      if (given !== null) get().answerQuiz(given);
    }
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
  compare: initial.cmp ?? '',
  startCompare: (path) => {
    const pinned = canonicalPath(path ?? get().selected, model);
    if (pinned !== '') set({ compare: pinned });
  },
  swapCompare: () => {
    const { compare, selected } = get();
    if (compare === '' || selected === '' || compare === selected) return;
    set({ compare: selected });
    get().select(compare);
  },
  clearCompare: () => {
    const { compare } = get();
    if (compare !== '') get().select(compare);
  },
  stopCompare: () => set({ compare: '' }),
  hintOpen: typeof window !== 'undefined' && initialHintOpen(initial),
  // The tour card and the tips box share the bottom left corner, so the tips wait until the tour ends.
  showHint: () => {
    if (get().tour === null) set({ hintOpen: true });
  },
  dismissHint: () => {
    storeHintSeen();
    set({ hintOpen: false });
  },
  setHovered: (key) => set({ hovered: key }),
  setListOpen: (open) => set({ listOpen: open }),
  listFilter: { types: initial.ft ?? [], nets: initial.fn ?? [] },
  toggleListType: (type) => {
    const f = get().listFilter;
    set({ listFilter: { ...f, types: toggleIn(f.types, type, filterTypes(model)) } });
  },
  toggleListNet: (network) => {
    const f = get().listFilter;
    set({ listFilter: { ...f, nets: toggleIn(f.nets, network, filterNetworks(model)) } });
  },
  clearListFilter: () => set({ listFilter: NO_FILTER }),
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
// A shared quiz link replays the same round.
if (initial.quiz !== undefined) useExplorer.getState().startQuiz(initial.quiz);
// A shared tour link opens that step. The view and selection in the link are the
// step's own, so leaving the tour goes back to the plain rack.
if (initial.tour !== undefined) useExplorer.getState().startTour(initial.tour, TOUR_HOME);

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
      cmp: s.compare,
      quiz: s.quiz && !s.quiz.done ? s.quiz.seed : undefined,
      // Only while the step is still on screen: once the viewer picks something
      // else, a copied link shows that, not the step.
      tour: s.tour && showsTourStep(TOUR_STEPS[s.tour.index]!, s, model) ? s.tour.index : undefined,
      ft: s.listFilter.types,
      fn: s.listFilter.nets,
      lk: s.hiddenLinkKinds,
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
