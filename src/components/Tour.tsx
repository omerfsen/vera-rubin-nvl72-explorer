import { useEffect, useRef } from 'react';
import { model } from '../data';
import { TOUR_STEPS, tourComponentId, type TourStep } from '../data/tour';
import { useExplorer } from '../state/store';
import { useI18n, type I18n } from '../i18n';

/** "Start here" in the top bar: starts the guided tour. */
export function TourButton() {
  const on = useExplorer((s) => s.tour !== null);
  const startTour = useExplorer((s) => s.startTour);
  const { t } = useI18n();
  if (TOUR_STEPS.length === 0) return null;
  return (
    <button type="button" className="toggle tour-start" aria-pressed={on} title={t('guidedTour.startHint')} onClick={startTour}>
      {t('guidedTour.start')}
    </button>
  );
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/** What a step shows from the data: a network, or a part with its count and source. */
function StepFacts({ step, i18n }: { step: TourStep; i18n: I18n }) {
  const { t } = i18n;
  if (step.page) return null;
  if (step.network) {
    const net = model.getNetwork(step.network);
    if (!net) return null;
    return (
      <div className="tour-facts">
        <p className="tour-name">{t('panel.networkItem', { number: net.number, name: net.name })}</p>
        <p>{i18n.network(net.id, 'description', net.description)}</p>
        <p className="spec-source">
          {t('panel.sourceLabel')}{' '}
          <a href={net.source.url} target="_blank" rel="noopener noreferrer">
            {net.source.section}
          </a>
        </p>
      </div>
    );
  }
  const comp = model.getComponent(tourComponentId(step, model));
  if (!comp) return null;
  const total = model.totalPerRack(comp.id);
  const isRack = comp.parent === null;
  return (
    <div className="tour-facts">
      <p className="tour-name">{isRack ? t('guidedTour.whole') : i18n.name(comp.id)}</p>
      {comp.description && <p>{i18n.component(comp, 'description')}</p>}
      {!isRack && <p className="muted small">{total === null ? t('count.notStated') : t('count.perRack', { total })}</p>}
      <p className="spec-source">
        {t('panel.sourceLabel')}{' '}
        <a href={comp.source.url} target="_blank" rel="noopener noreferrer">
          {comp.source.section}
        </a>
      </p>
    </div>
  );
}

/** The tour in progress: a card at the bottom of the window, on every view and page. */
export function TourBox() {
  const tour = useExplorer((s) => s.tour);
  const goTo = useExplorer((s) => s.goToTourStep);
  const stop = useExplorer((s) => s.stopTour);
  const i18n = useI18n();
  const { t } = i18n;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const active = tour !== null;

  // Move focus to the card when the tour starts, so keyboard users land on it.
  useEffect(() => {
    if (active) headingRef.current?.focus();
  }, [active]);

  // Capture phase, so the tour gets its keys before the rack's own shortcuts.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
      const s = useExplorer.getState();
      if (!s.tour) return;
      const target = e.target as HTMLElement | null;
      // Enter on a button or link activates it; elsewhere it moves on.
      const onControl = target instanceof HTMLElement && /^(BUTTON|A)$/.test(target.tagName);
      let handled = true;
      if (e.key === 'ArrowRight' || (e.key === 'Enter' && !onControl)) {
        if (s.tour.index < TOUR_STEPS.length - 1) s.goToTourStep(s.tour.index + 1);
        else s.stopTour();
      } else if (e.key === 'ArrowLeft') s.goToTourStep(s.tour.index - 1);
      else if (e.key === 'Escape') s.stopTour();
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);

  if (!tour) return null;
  const step = TOUR_STEPS[tour.index]!;
  const last = tour.index === TOUR_STEPS.length - 1;
  return (
    <section className="tour-box" aria-label={t('guidedTour.aria')} aria-describedby="tour-keys">
      <h2 ref={headingRef} tabIndex={-1}>
        {t('guidedTour.heading', { step: tour.index + 1, total: TOUR_STEPS.length })}
      </h2>
      <p className="tour-caption" aria-live="polite">
        {t(`guidedTour.steps.${step.id}`)}
      </p>
      <StepFacts step={step} i18n={i18n} />
      <div className="procedure-nav">
        <button type="button" disabled={tour.index === 0} onClick={() => goTo(tour.index - 1)}>
          {t('guidedTour.back')}
        </button>
        <button type="button" onClick={() => (last ? stop() : goTo(tour.index + 1))}>
          {last ? t('guidedTour.finish') : t('guidedTour.next')}
        </button>
        <button type="button" onClick={stop}>
          {t('guidedTour.exit')}
        </button>
      </div>
      <p className="muted small hint-long" id="tour-keys">
        {t('guidedTour.keys')}
      </p>
    </section>
  );
}
