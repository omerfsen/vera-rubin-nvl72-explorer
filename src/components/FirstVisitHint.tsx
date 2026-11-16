import { useEffect, useState, type KeyboardEvent } from 'react';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';

export const HINT_ID = 'first-visit-hint';

const STEPS = ['select', 'open', 'network'] as const;
type Step = (typeof STEPS)[number];
const NONE: Record<Step, boolean> = { select: false, open: false, network: false };

/**
 * A small card over the stage with three first steps. It never takes focus by
 * itself; "Got it" or Escape closes it, and so does opening a unit, which
 * means the viewer has done the first two steps.
 */
export function FirstVisitHint() {
  const open = useExplorer((s) => s.hintOpen);
  const dismiss = useExplorer((s) => s.dismissHint);
  const { t } = useI18n();
  const [done, setDone] = useState(NONE);

  useEffect(() => {
    if (!open) return;
    setDone(NONE);
    return useExplorer.subscribe((s, prev) => {
      if (s.view === 'tray' && prev.view !== 'tray') {
        s.dismissHint();
        return;
      }
      if (s.selected !== '' && s.selected !== prev.selected) setDone((d) => ({ ...d, select: true }));
      if (s.network !== '' && s.network !== prev.network) setDone((d) => ({ ...d, network: true }));
    });
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape') return;
    // Keep the global Escape (up one level) from also running.
    e.preventDefault();
    e.stopPropagation();
    dismiss();
    document.getElementById('rack-stage')?.focus();
  };

  return (
    <section
      className="first-visit"
      id={HINT_ID}
      tabIndex={-1}
      aria-labelledby={`${HINT_ID}-heading`}
      onKeyDown={onKeyDown}
    >
      <h3 id={`${HINT_ID}-heading`}>{t('firstVisit.heading')}</h3>
      <ol>
        {STEPS.map((step) => (
          <li key={step} className={done[step] ? 'done' : undefined}>
            {t(`firstVisit.${step}`)}
            {done[step] && <span className="sr-only"> ({t('firstVisit.done')})</span>}
          </li>
        ))}
      </ol>
      <button type="button" onClick={dismiss}>
        {t('firstVisit.gotIt')}
      </button>
    </section>
  );
}

/** The "?" button in the top bar: brings the hint back, or closes it. */
export function HintButton() {
  const open = useExplorer((s) => s.hintOpen);
  const { t } = useI18n();
  const onClick = () => {
    const s = useExplorer.getState();
    if (open) {
      s.dismissHint();
      return;
    }
    s.showHint();
    // Asked for, so move focus to it (but never on page load).
    setTimeout(() => document.getElementById(HINT_ID)?.focus(), 0);
  };
  return (
    <button
      type="button"
      className="toggle hint-button"
      aria-expanded={open}
      aria-controls={open ? HINT_ID : undefined}
      aria-label={t('firstVisit.show')}
      title={t('firstVisit.show')}
      onClick={onClick}
    >
      <span aria-hidden="true">?</span>
    </button>
  );
}
