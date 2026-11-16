import type { Model } from '../data/model';
import { isValidSeed } from '../data/quiz';
import { TOUR_STEPS } from '../data/tour';
import { filterNetworks, filterTypes, parseFilterList } from '../data/listFilter';
import { DEFAULT_LANG, isLang, type Lang } from '../i18n/lang';

export type View = 'rack' | 'rear' | 'tray';
export const VIEWS: readonly View[] = ['rack', 'rear', 'tray'];

export interface UrlState {
  view: View;
  /** Selection path, "" for the rack itself. */
  select: string;
  /** The 2D list pane is open. */
  list: boolean;
  /** Network highlighted by the overlay, or "" for none. */
  net?: string;
  /** Service procedure in progress and its 0-based step, or "" for none. */
  proc?: string;
  step?: number;
  /** "sources" shows the sources page. */
  page?: string;
  /** Embedded in another page: no header, network bar or footer. */
  embed?: boolean;
  /** Interface language; left out of the URL for English. */
  lang?: Lang;
  /** Part pinned on the left of a comparison; left out when not comparing. */
  cmp?: string;
  /** Seed of the quiz round in progress, so a round can be shared and replayed. */
  quiz?: number;
  /** 0-based step of the "Start here" tour in progress; `tour=` in the URL is 1-based. */
  tour?: number;
  /** List filter: rack unit types and networks; left out when empty. */
  ft?: string[];
  fn?: string[];
}

export const DEFAULT_URL_STATE: UrlState = { view: 'rack', select: '', list: false };

/** The query keys this app owns. Everything else in the query is left alone. */
const OWN_KEYS = new Set(['view', 'select', 'list', 'net', 'proc', 'step', 'page', 'embed', 'lang', 'cmp', 'quiz', 'tour', 'ft', 'fn']);

/**
 * The rack unit whose interior can be opened for this selection, e.g.
 * "compute-tray.7" for "compute-tray.7/rubin-gpu.2". null if there is none.
 */
export function trayKeyOf(select: string, model: Model): string | null {
  const first = model.parsePath(select)?.[0];
  if (!first || first.index === undefined || !model.trayLayout(first.id)) return null;
  return `${first.id}.${first.index}`;
}

/** Read view, selection and list state from a query string. Unknown values fall back to defaults. */
export function readUrlState(search: string, model: Model): UrlState {
  const params = new URLSearchParams(search);
  const viewParam = params.get('view');
  const view = VIEWS.find((v) => v === viewParam) ?? DEFAULT_URL_STATE.view;
  const selectParam = params.get('select') ?? '';
  const segments = model.parsePath(selectParam);
  const select = segments === null ? '' : model.formatPath(segments);
  const cmp = canonicalPath(params.get('cmp'), model);
  return {
    view: view === 'tray' && trayKeyOf(select, model) === null ? 'rack' : view,
    select,
    list: params.get('list') === '1',
    net: model.getNetwork(params.get('net') ?? '') ? (params.get('net') as string) : '',
    ...procState(params, model),
    page: params.get('page') === 'sources' ? 'sources' : '',
    embed: params.get('embed') === '1',
    // Only a language named in the URL; the store falls back to the saved one.
    ...(isLang(params.get('lang')) ? { lang: params.get('lang') as Lang } : {}),
    ...(cmp ? { cmp } : {}),
    ...quizState(params),
    // The tour card is not shown in an embed, so a tour link does nothing there.
    ...(params.get('embed') === '1' ? {} : tourState(params)),
    ...filterState(params, model),
  };
}

/** A selection path in its canonical form, or "" when it names nothing. */
export function canonicalPath(path: string | null | undefined, model: Model): string {
  const segments = model.parsePath(path);
  return segments === null ? '' : model.formatPath(segments);
}

function filterState(params: URLSearchParams, model: Model): { ft?: string[]; fn?: string[] } {
  const ft = parseFilterList(params.get('ft'), filterTypes(model));
  const fn = parseFilterList(params.get('fn'), filterNetworks(model));
  return { ...(ft.length ? { ft } : {}), ...(fn.length ? { fn } : {}) };
}

function quizState(params: URLSearchParams): { quiz?: number } {
  const raw = params.get('quiz') ?? '';
  const seed = /^[1-9][0-9]{0,9}$/.test(raw) ? Number(raw) : NaN;
  return isValidSeed(seed) ? { quiz: seed } : {};
}

/** Only a whole step number the tour has; anything else is no tour, not a clamped one. */
function tourState(params: URLSearchParams): { tour?: number } {
  const raw = params.get('tour') ?? '';
  const step = /^[1-9][0-9]{0,2}$/.test(raw) ? Number(raw) : NaN;
  return step >= 1 && step <= TOUR_STEPS.length ? { tour: step - 1 } : {};
}

function procState(params: URLSearchParams, model: Model): { proc: string; step: number } {
  const proc = (model.topology.procedures ?? []).find((p) => p.id === params.get('proc'));
  if (!proc) return { proc: '', step: 0 };
  const step = Number(params.get('step') ?? '1') - 1;
  return { proc: proc.id, step: Number.isInteger(step) ? Math.min(proc.steps.length - 1, Math.max(0, step)) : 0 };
}

function keyOf(piece: string): string {
  const raw = piece.split('=', 1)[0] ?? '';
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

/**
 * Write view, selection and list state into a query string. Pieces of the
 * query that belong to someone else are copied through byte for byte.
 */
export function writeUrlState(search: string, state: UrlState): string {
  const kept = search
    .replace(/^\?/, '')
    .split('&')
    .filter((piece) => piece !== '' && !OWN_KEYS.has(keyOf(piece)));
  if (state.view !== DEFAULT_URL_STATE.view) kept.push(`view=${encodeURIComponent(state.view)}`);
  if (state.select !== '') kept.push(`select=${encodeURIComponent(state.select).replace(/%2F/g, '/')}`);
  if (state.list) kept.push('list=1');
  if (state.net) kept.push(`net=${encodeURIComponent(state.net)}`);
  if (state.proc) kept.push(`proc=${encodeURIComponent(state.proc)}`, `step=${(state.step ?? 0) + 1}`);
  if (state.page) kept.push(`page=${encodeURIComponent(state.page)}`);
  if (state.embed) kept.push('embed=1');
  if (state.cmp) kept.push(`cmp=${encodeURIComponent(state.cmp).replace(/%2F/g, '/')}`);
  if (state.lang && state.lang !== DEFAULT_LANG) kept.push(`lang=${encodeURIComponent(state.lang)}`);
  if (state.quiz !== undefined && isValidSeed(state.quiz)) kept.push(`quiz=${state.quiz}`);
  if (state.tour !== undefined && Number.isInteger(state.tour) && state.tour >= 0 && state.tour < TOUR_STEPS.length) kept.push(`tour=${state.tour + 1}`);
  if (state.ft?.length) kept.push(`ft=${state.ft.map(encodeURIComponent).join(',')}`);
  if (state.fn?.length) kept.push(`fn=${state.fn.map(encodeURIComponent).join(',')}`);
  return kept.length === 0 ? '' : `?${kept.join('&')}`;
}

/**
 * The address of the current view for an embed: the same link with `embed=1`
 * and without `tour`, which an embed ignores.
 */
export function embedUrl(href: string): string {
  const hashAt = href.indexOf('#');
  const hash = hashAt < 0 ? '' : href.slice(hashAt);
  const page = hashAt < 0 ? href : href.slice(0, hashAt);
  const queryAt = page.indexOf('?');
  const base = queryAt < 0 ? page : page.slice(0, queryAt);
  const search = queryAt < 0 ? '' : page.slice(queryAt + 1);
  const kept = search.split('&').filter((piece) => piece !== '' && keyOf(piece) !== 'tour' && keyOf(piece) !== 'embed');
  return `${base}?${[...kept, 'embed=1'].join('&')}${hash}`;
}

/**
 * A clean link to one part: only what is needed to show it (selection, the
 * view when it is not the rack, the language when it is not English). The
 * quiz, tour, comparison, walkthrough, network overlay, list pane and anyone
 * else's query parameters are left out.
 */
export function partUrl(base: string, state: Pick<UrlState, 'view' | 'select' | 'lang'>): string {
  const view = state.select === '' && state.view === 'tray' ? 'rack' : state.view;
  return `${base}${writeUrlState('', { view, select: state.select, list: false, lang: state.lang })}`;
}
