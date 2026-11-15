import { useI18n } from '../i18n';
import { useExplorer } from '../state/store';
import { THEME_PREFS } from '../theme';

/** Light / Dark / System toggle; System follows the operating system. */
export function ThemeSwitcher() {
  const pref = useExplorer((s) => s.themePref);
  const setPref = useExplorer((s) => s.setThemePref);
  const { t } = useI18n();
  return (
    <div className="lang-switch theme-switch" role="group" aria-label={t('theme.label')}>
      {THEME_PREFS.map((p) => (
        <button key={p} type="button" data-theme-pref={p} aria-pressed={pref === p} onClick={() => setPref(p)}>
          {t(`theme.${p}`)}
        </button>
      ))}
    </div>
  );
}
