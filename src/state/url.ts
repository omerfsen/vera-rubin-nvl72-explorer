import type { Model } from '../data/model';

export type View = 'rack';
export const VIEWS: readonly View[] = ['rack'];

export interface UrlState {
  view: View;
  /** Selection path, "" for the rack itself. */
  select: string;
  /** The 2D list pane is open. */
  list: boolean;
}

export const DEFAULT_URL_STATE: UrlState = { view: 'rack', select: '', list: false };

/** The query keys this app owns. Everything else in the query is left alone. */
const OWN_KEYS = new Set(['view', 'select', 'list']);

/** Read view, selection and list state from a query string. Unknown values fall back to defaults. */
export function readUrlState(search: string, model: Model): UrlState {
  const params = new URLSearchParams(search);
  const viewParam = params.get('view');
  const view = VIEWS.find((v) => v === viewParam) ?? DEFAULT_URL_STATE.view;
  const selectParam = params.get('select') ?? '';
  const segments = model.parsePath(selectParam);
  return {
    view,
    select: segments === null ? '' : model.formatPath(segments),
    list: params.get('list') === '1',
  };
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
  return kept.length === 0 ? '' : `?${kept.join('&')}`;
}
