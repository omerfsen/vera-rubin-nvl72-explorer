import { lazy, Suspense, useEffect, useState } from 'react';
import { Breadcrumb } from './components/Breadcrumb';
import { NetworkBar } from './components/NetworkBar';
import { Credits } from './components/Credits';
import { SourcesPage } from './components/SourcesPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RackList } from './components/RackList';
import { Search } from './components/Search';
import { CommandPalette } from './components/CommandPalette';
import { SidePanel } from './components/SidePanel';
import { hasWebGL } from './lib/webgl';
import { model } from './data';
import { CONFLICT_COLOR, DIM_COLORS, LINK_COLORS, NETWORK_COLORS, REAR_COLORS, TYPE_COLORS } from './scenes/geometry';
import { trayLegend } from './scenes/colors';
import { trayKeyOf } from './state/url';
import { syncTheme, syncUrl, useExplorer } from './state/store';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { Recorder } from './components/Recorder';
import { Screenshot } from './components/Screenshot';
import { screenshotAvailable } from './lib/screenshot';
import { QuizButton } from './components/Quiz';
import { TourBox, TourButton } from './components/Tour';
import { SHOW_RECORDER, SHOW_SCREENSHOT } from './config/flags';
import { useI18n } from './i18n';
import { FirstVisitHint, HintButton } from './components/FirstVisitHint';

const Scene = lazy(() => import('./scenes/Scene'));

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
      const s = useExplorer.getState();
      // Arrow keys step through the rack only while the 3D view (or nothing)
      // has focus, so they still scroll the panel and the list elsewhere.
      const target = e.target as HTMLElement | null;
      const onStage = target === document.body || target?.id === 'rack-stage';
      if (onStage && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        if (s.view === 'tray') s.stepTrayPart(delta);
        else s.stepRackUnit(delta);
      } else if (onStage && e.key === 'Enter' && s.view === 'rack') {
        e.preventDefault();
        s.openTray();
      } else if (e.key === 'Escape' && (s.selected !== '' || s.view !== 'rack')) {
        s.goUp();
      } else if (e.key === 'Escape' && s.hintOpen) {
        // Nothing to go back from: Escape closes the first-visit hint.
        s.dismissHint();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Legend({ trayId }: { trayId: string | null }) {
  const network = useExplorer((s) => s.network);
  const theme = useExplorer((s) => s.theme);
  const i18n = useI18n();
  const { t } = i18n;
  const net = network ? model.getNetwork(network) : undefined;
  if (net) {
    const { members } = model.networkMembers(net.id);
    const conflict = [...members.values()].some((m) => m.alternative);
    const rows = [
      { label: t('legend.on', { name: net.name }), color: NETWORK_COLORS[net.id] ?? '#ffffff' },
      ...(conflict ? [{ label: t('legend.conflict'), color: CONFLICT_COLOR }] : []),
      { label: t('legend.notOn'), color: DIM_COLORS[theme] },
    ];
    return (
      <ul className="legend" aria-label={t('legend.label')}>
        {rows.map((r) => (
          <li key={r.label}>
            <span className="swatch" style={{ background: r.color }} aria-hidden="true" />
            {r.label}
          </li>
        ))}
      </ul>
    );
  }
  const rows = trayId
    ? trayLegend(trayId, i18n)
    : [...new Set(model.rackUnits.map((u) => u.componentId))].map((id) => {
        const c = model.getComponent(id);
        return { label: i18n.name(id), color: TYPE_COLORS[c?.type ?? 'rack'] ?? '#666666' };
      }).concat(
        [...new Set((model.topology.rearLayout?.parts ?? []).map((p) => p.component))].map((id) => {
          const c = model.getComponent(id);
          return { label: t('legend.rear', { name: i18n.name(id) }), color: REAR_COLORS[c?.type ?? ''] ?? '#666666' };
        }),
      );
  return (
    <ul className={trayId ? 'legend legend-tray' : 'legend'} aria-label={t('legend.label')}>
      {rows.map((r) => (
        <li key={r.label}>
          <span className="swatch" style={{ background: r.color }} aria-hidden="true" />
          {r.label}
        </li>
      ))}
    </ul>
  );
}

const LAYERS = ['structure', 'parts', 'links'] as const;

/** "Open tray" in the rack view; "Back to rack" and the layer toggles inside a tray. */
function StageActions({ trayKey, view }: { trayKey: string | null; view: string }) {
  const openTray = useExplorer((s) => s.openTray);
  const closeTray = useExplorer((s) => s.closeTray);
  const setSide = useExplorer((s) => s.setSide);
  const layers = useExplorer((s) => s.layers);
  const toggleLayer = useExplorer((s) => s.toggleLayer);
  const exploded = useExplorer((s) => s.exploded);
  const toggleExploded = useExplorer((s) => s.toggleExploded);
  const i18n = useI18n();
  const { t } = i18n;
  const inTray = view === 'tray' && trayKey !== null;
  const name = trayKey ? i18n.segmentLabel(model.parsePath(trayKey)![0]!) : '';
  // Link kinds shown in the legend: the tray's own links, or the rack-level connections at the rear.
  const kinds = inTray
    ? [...new Set((model.trayLayout(trayKey!.split('.')[0]!)?.links ?? []).map((l) => l.kind))]
    : [
        ...new Set(
          model.topology.connections
            .filter((c) => c.to && (model.getComponent(c.from)?.rearSide || model.getComponent(c.to)?.rearSide))
            .map((c) => c.kind),
        ),
      ];
  return (
    <div className="stage-actions">
      {inTray ? (
        <button type="button" onClick={closeTray}>
          {t('stage.backToRack')}
        </button>
      ) : (
        <div className="layer-toggles" role="group" aria-label={t('stage.side')}>
          <button type="button" aria-pressed={view !== 'rear'} onClick={() => setSide('rack')}>
            {t('stage.front')}
          </button>
          <button type="button" aria-pressed={view === 'rear'} onClick={() => setSide('rear')}>
            {t('stage.rear')}
          </button>
          {trayKey && (
            <button type="button" className="open-button" onClick={openTray}>
              {t('stage.open', { name })}
            </button>
          )}
        </div>
      )}
      <div className="layer-toggles" role="group" aria-label={t('stage.layers')}>
        {LAYERS.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={layers[l]}
            title={t('stage.showOrHide', { hint: t(`layers.${l}Hint`) })}
            onClick={() => toggleLayer(l)}
          >
            {t(`layers.${l}`)}
          </button>
        ))}
        {inTray && (
          <button type="button" aria-pressed={exploded} title={t('stage.explodedViewHint')} onClick={toggleExploded}>
            {t('stage.explodedView')}
          </button>
        )}
      </div>
      {layers.links && (inTray || view === 'rear') && (
        <ul className="link-legend" aria-label={t('stage.connectionTypes')}>
          {kinds.map((k) => (
            <li key={k}>
              <span className="line-swatch" style={{ background: LINK_COLORS[k] }} aria-hidden="true" />
              {i18n.linkName(k)}
            </li>
          ))}
          {inTray && <li className="muted">{t('stage.dashed')}</li>}
        </ul>
      )}
    </div>
  );
}

export default function App() {
  const [webgl] = useState(hasWebGL);
  const listOpen = useExplorer((s) => s.listOpen);
  const panelOpen = useExplorer((s) => s.panelOpen);
  const setPanelOpen = useExplorer((s) => s.setPanelOpen);
  const setListOpen = useExplorer((s) => s.setListOpen);
  const selected = useExplorer((s) => s.selected);
  const view = useExplorer((s) => s.view);
  const page = useExplorer((s) => s.page);
  const setPage = useExplorer((s) => s.setPage);
  const embed = useExplorer((s) => s.embed);
  const quizOn = useExplorer((s) => s.quiz !== null);
  const touring = useExplorer((s) => s.tour !== null);
  const { t } = useI18n();
  const trayKey = trayKeyOf(selected, model);
  const inTray = view === 'tray' && trayKey !== null;
  useKeyboard();
  useEffect(() => syncUrl(), []);
  useEffect(() => syncTheme(), []);

  const showList = !webgl || listOpen;

  return (
    <div className={(embed ? 'app embed' : 'app') + (touring && !embed ? ' touring' : '')}>
      <header className="topbar">
        <div className="brand">
          <h1>{t('site.title')}</h1>
          <p className="tagline">{t('site.tagline')}</p>
        </div>
        <Search />
        <CommandPalette webgl={webgl} />
        <LanguageSwitcher />
        <ThemeSwitcher />
        {SHOW_RECORDER && !embed && <Recorder />}
        {screenshotAvailable({ flag: SHOW_SCREENSHOT, webgl, embed }) && page !== 'sources' && <Screenshot />}
        {!embed && <TourButton />}
        {!embed && <QuizButton />}
        {webgl && !embed && <HintButton />}
        <button type="button" className="toggle" aria-pressed={page === 'sources'} onClick={() => setPage(page === 'sources' ? '' : 'sources')}>
          {t('top.sources')}
        </button>
        {webgl && (
          <button
            type="button"
            className="toggle"
            aria-expanded={listOpen}
            aria-controls="list-pane"
            onClick={() => setListOpen(!listOpen)}
          >
            {listOpen ? t('top.hideList') : t('top.listView')}
          </button>
        )}
      </header>

      <Breadcrumb />
      <NetworkBar />

      {page === 'sources' ? (
        <main className="layout-page">
          <SourcesPage />
        </main>
      ) : (
      <main
        className={
          (!webgl ? 'layout list-only' : showList ? 'layout with-list' : 'layout') +
          (webgl && !panelOpen ? ' panel-closed' : '')
        }
      >
        {showList && (
          <aside className="list-pane" id="list-pane" aria-label={t('layout.listPane')}>
            {!webgl && (
              <p className="notice" role="status">
                {t('layout.noWebgl')}
              </p>
            )}
            <RackList totals={!webgl} />
          </aside>
        )}

        {webgl && (
          <section
            className="stage"
            id="rack-stage"
            tabIndex={0}
            aria-label={t('layout.stage')}
            aria-describedby="stage-hint"
          >
            <ErrorBoundary
              fallback={
                <p className="notice" role="alert">
                  {t('layout.sceneFailed')}
                </p>
              }
            >
              <Suspense fallback={<p className="notice">{t('layout.loading')}</p>}>
                <Scene />
              </Suspense>
            </ErrorBoundary>
            <Legend trayId={inTray ? trayKey!.split('.')[0]! : null} />
            <StageActions trayKey={trayKey} view={view} />
            <p className="hint" id="stage-hint">
              {inTray ? (
                <>
                  <span className="hint-long">{t('hint.trayLong')}</span>
                  <span className="hint-short">{t('hint.trayShort')}</span>
                </>
              ) : view === 'rear' ? (
                <>
                  <span className="hint-long">{t('hint.rearLong')}</span>
                  <span className="hint-short">{t('hint.rearShort')}</span>
                </>
              ) : (
                <>
                  <span className="hint-long">{t('hint.rackLong')}</span>
                  <span className="hint-short">{t('hint.rackShort')}</span>
                </>
              )}
            </p>
            <FirstVisitHint />
          </section>
        )}

        <section
          className={(selected || quizOn ? 'panel open' : 'panel') + (webgl && !panelOpen ? ' closed' : '')}
          aria-label={t('layout.details')}
        >
          {webgl && (
            <button
              type="button"
              className="panel-toggle"
              aria-expanded={panelOpen}
              aria-controls="panel-content"
              title={panelOpen ? t('detailsToggle.collapse') : t('detailsToggle.expand')}
              onClick={() => setPanelOpen(!panelOpen)}
            >
              <span aria-hidden="true">{panelOpen ? '»' : '«'}</span>
              <span className="panel-toggle-label">{panelOpen ? t('detailsToggle.collapse') : t('detailsToggle.expand')}</span>
            </button>
          )}
          <div id="panel-content" hidden={webgl && !panelOpen}>
            <SidePanel totals={webgl} webgl={webgl} />
          </div>
        </section>
      </main>
      )}

      {!embed && <TourBox />}

      <footer className="footer">
        {t('site.footer', {
          userGuide: model.topology.meta.document.title,
          userGuideDate: model.topology.meta.document.date,
          serviceManual: model.topology.meta.serviceManual?.title ?? '',
          serviceManualDate: model.topology.meta.serviceManual?.date ?? '',
          trademarks: t('site.trademarks'),
        })}{' '}
        <Credits />
      </footer>
    </div>
  );
}
