// Colour theme: the viewer's choice (light, dark or follow the system) and
// the theme that choice resolves to. No store or React here.

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';
export const THEME_PREFS: readonly ThemePref[] = ['light', 'dark', 'system'];
export const THEME_STORAGE_KEY = 'nvl72-explorer.theme';

export function isThemePref(value: unknown): value is ThemePref {
  return typeof value === 'string' && (THEME_PREFS as readonly string[]).includes(value);
}

/** The saved choice, or System when there is none or storage is blocked. */
export function storedThemePref(): ThemePref {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePref(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function storeThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Blocked storage: the choice lasts for this page only.
  }
}

/** The media query System follows; null outside a browser. */
export function darkQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
}

/** Dark when chosen, or when System is chosen and the OS prefers dark (dark also when it cannot tell). */
export function resolveTheme(pref: ThemePref, systemDark: boolean | null): Theme {
  if (pref !== 'system') return pref;
  return systemDark === false ? 'light' : 'dark';
}

/** Put the theme on the page root, for CSS and native controls. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
