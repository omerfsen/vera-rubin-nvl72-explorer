import type { Model } from '../data/model';

export type View = 'rack';
export const VIEWS: readonly View[] = ['rack'];

export interface UrlState {
  view: View;
  /** Selection path, "" for the rack itself. */
  select: string;
}

export const DEFAULT_URL_STATE: UrlState = { view: 'rack', select: '' };

/** Read view and selection from a query string. Unknown values fall back to defaults. */
export function readUrlState(search: string, model: Model): UrlState {
  const params = new URLSearchParams(search);
  const viewParam = params.get('view');
  const view = VIEWS.find((v) => v === viewParam) ?? DEFAULT_URL_STATE.view;
  const selectParam = params.get('select') ?? '';
  const segments = model.parsePath(selectParam);
  return { view, select: segments === null ? '' : model.formatPath(segments) };
}

/** Write view and selection into a query string, keeping unrelated params. */
export function writeUrlState(search: string, state: UrlState): string {
  const params = new URLSearchParams(search);
  if (state.view === DEFAULT_URL_STATE.view) params.delete('view');
  else params.set('view', state.view);
  if (state.select === '') params.delete('select');
  else params.set('select', state.select);
  const out = params.toString().replace(/%2F/g, '/');
  return out === '' ? '' : `?${out}`;
}
