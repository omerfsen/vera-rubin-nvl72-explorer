import type { UrlState } from './url';

/** localStorage key set once the viewer has dismissed the first-visit hint. */
export const HINT_STORAGE_KEY = 'nvl72-explorer.hint';

/**
 * A shared link that already shows something: a selection, another view, a
 * network, a walkthrough step, a comparison, a quiz round or the sources page.
 * The viewer is being shown that, so the hint stays out of the way.
 */
export function isDeepLink(state: UrlState): boolean {
  return (
    state.select !== '' ||
    state.view !== 'rack' ||
    !!state.net ||
    !!state.proc ||
    !!state.cmp ||
    !!state.page ||
    state.quiz !== undefined
  );
}

export function storedHintSeen(): boolean {
  try {
    return typeof window === 'undefined' || window.localStorage.getItem(HINT_STORAGE_KEY) === 'seen';
  } catch {
    // Blocked storage: treat it as a first visit; the card is small and closes with one click.
    return false;
  }
}

export function storeHintSeen(): void {
  try {
    window.localStorage.setItem(HINT_STORAGE_KEY, 'seen');
  } catch {
    // Private mode or blocked storage: the hint stays closed for this page only.
  }
}

/** Show the hint on a plain first visit: not embedded, not a deep link, not dismissed before. */
export function initialHintOpen(state: UrlState): boolean {
  return !state.embed && !isDeepLink(state) && !storedHintSeen();
}
