// Languages the explorer is translated into, and how the first one is picked.
// No store or React here, so the URL code and the store can both use it.

export type Lang = 'en' | 'tr' | 'zh';
export const LANGS: readonly Lang[] = ['en', 'tr', 'zh'];
export const DEFAULT_LANG: Lang = 'en';
export const LANG_STORAGE_KEY = 'nvl72-explorer.lang';

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** "tr-TR" -> "tr", "zh-Hans-CN" -> "zh"; anything else is English. */
export function langFromNavigator(language: string | undefined | null): Lang {
  const tag = (language ?? '').toLowerCase();
  if (tag.startsWith('tr')) return 'tr';
  if (tag.startsWith('zh')) return 'zh';
  return DEFAULT_LANG;
}

/** The saved choice, or null when there is none or storage is blocked. */
export function storedLang(): Lang | null {
  try {
    const value = window.localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Private mode or blocked storage: the URL still carries the choice.
  }
}

/** URL first, then the saved choice, then the browser language, then English. */
export function initialLang(urlLang: Lang | undefined, saved: Lang | null, navigatorLanguage: string | undefined): Lang {
  return urlLang ?? saved ?? langFromNavigator(navigatorLanguage);
}
