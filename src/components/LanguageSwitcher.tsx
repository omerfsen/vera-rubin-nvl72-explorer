import { i18nFor, LANGS, useI18n } from '../i18n';
import { useExplorer } from '../state/store';

/** EN / TR / 中文 toggle buttons; each label comes from its own language file. */
export function LanguageSwitcher() {
  const lang = useExplorer((s) => s.lang);
  const setLang = useExplorer((s) => s.setLang);
  const { t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t('language.label')}>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {i18nFor(l).t('language.self')}
        </button>
      ))}
    </div>
  );
}
