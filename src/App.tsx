import { lazy, Suspense, useEffect, useState } from 'react';
import { Breadcrumb } from './components/Breadcrumb';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RackList } from './components/RackList';
import { Search } from './components/Search';
import { SidePanel } from './components/SidePanel';
import { hasWebGL } from './lib/webgl';
import { model } from './data';
import { LINK_COLORS, LINK_NAMES, REAR_COLORS, TYPE_COLORS } from './scenes/geometry';
import { trayLegend } from './scenes/colors';
import { trayKeyOf } from './state/url';
import { syncUrl, useExplorer } from './state/store';

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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Legend({ trayId }: { trayId: string | null }) {
  const rows = trayId
    ? trayLegend(trayId)
    : [...new Set(model.rackUnits.map((u) => u.componentId))].map((id) => {
        const c = model.getComponent(id);
        return { label: c?.name ?? id, color: TYPE_COLORS[c?.type ?? 'rack'] ?? '#666666' };
      }).concat(
        [...new Set((model.topology.rearLayout?.parts ?? []).map((p) => p.component))].map((id) => {
          const c = model.getComponent(id);
          return { label: `${c?.name ?? id} (rear)`, color: REAR_COLORS[c?.type ?? ''] ?? '#666666' };
        }),
      );
  return (
    <ul className={trayId ? 'legend legend-tray' : 'legend'} aria-label="Legend">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="swatch" style={{ background: r.color }} aria-hidden="true" />
          {r.label}
        </li>
      ))}
    </ul>
  );
}

const LAYERS = [
  { key: 'structure', label: 'Structure', hint: 'the bones: rack frame or tray shell' },
  { key: 'parts', label: 'Parts', hint: 'the muscles: units, rear parts, chips, cards, drives, ports' },
  { key: 'links', label: 'Connections', hint: 'the veins: PCIe, C2C, Clink, NVLink, coolant, power' },
] as const;

/** "Open tray" in the rack view; "Back to rack" and the layer toggles inside a tray. */
function StageActions({ trayKey, view }: { trayKey: string | null; view: string }) {
  const openTray = useExplorer((s) => s.openTray);
  const closeTray = useExplorer((s) => s.closeTray);
  const setSide = useExplorer((s) => s.setSide);
  const layers = useExplorer((s) => s.layers);
  const toggleLayer = useExplorer((s) => s.toggleLayer);
  const inTray = view === 'tray' && trayKey !== null;
  const name = trayKey ? model.segmentLabel(model.parsePath(trayKey)![0]!) : '';
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
          ← Back to rack
        </button>
      ) : (
        <div className="layer-toggles" role="group" aria-label="Side of the rack">
          <button type="button" aria-pressed={view !== 'rear'} onClick={() => setSide('rack')}>
            Front
          </button>
          <button type="button" aria-pressed={view === 'rear'} onClick={() => setSide('rear')}>
            Rear
          </button>
          {trayKey && (
            <button type="button" className="open-button" onClick={openTray}>
              Open {name}
            </button>
          )}
        </div>
      )}
      <div className="layer-toggles" role="group" aria-label="Layers">
        {LAYERS.map((l) => (
          <button
            key={l.key}
            type="button"
            aria-pressed={layers[l.key]}
            title={`Show or hide ${l.hint}`}
            onClick={() => toggleLayer(l.key)}
          >
            {l.label}
          </button>
        ))}
      </div>
      {layers.links && (inTray || view === 'rear') && (
        <ul className="link-legend" aria-label="Connection types">
          {kinds.map((k) => (
            <li key={k}>
              <span className="line-swatch" style={{ background: LINK_COLORS[k] }} aria-hidden="true" />
              {LINK_NAMES[k] ?? k}
            </li>
          ))}
          {inTray && <li className="muted">Dashed: assumed, see the panel</li>}
        </ul>
      )}
    </div>
  );
}

export default function App() {
  const [webgl] = useState(hasWebGL);
  const listOpen = useExplorer((s) => s.listOpen);
  const setListOpen = useExplorer((s) => s.setListOpen);
  const selected = useExplorer((s) => s.selected);
  const view = useExplorer((s) => s.view);
  const trayKey = trayKeyOf(selected, model);
  const inTray = view === 'tray' && trayKey !== null;
  useKeyboard();
  useEffect(() => syncUrl(), []);

  const showList = !webgl || listOpen;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Vera Rubin NVL72 Explorer</h1>
          <p className="tagline">Unofficial learning tool · not affiliated with NVIDIA</p>
        </div>
        <Search />
        {webgl && (
          <button
            type="button"
            className="toggle"
            aria-expanded={listOpen}
            aria-controls="list-pane"
            onClick={() => setListOpen(!listOpen)}
          >
            {listOpen ? 'Hide list' : 'List view'}
          </button>
        )}
      </header>

      <Breadcrumb />

      <main className={!webgl ? 'layout list-only' : showList ? 'layout with-list' : 'layout'}>
        {showList && (
          <aside className="list-pane" id="list-pane" aria-label="Rack as a list">
            {!webgl && (
              <p className="notice" role="status">
                WebGL is not available in this browser, so the rack is shown as a list.
              </p>
            )}
            <RackList />
          </aside>
        )}

        {webgl && (
          <section
            className="stage"
            id="rack-stage"
            tabIndex={0}
            aria-label="Rack view. Use the up and down arrow keys to step through the units."
            aria-describedby="stage-hint"
          >
            <ErrorBoundary
              fallback={
                <p className="notice" role="alert">
                  The 3D view could not start. Use the list view instead.
                </p>
              }
            >
              <Suspense fallback={<p className="notice">Loading 3D view…</p>}>
                <Scene />
              </Suspense>
            </ErrorBoundary>
            <Legend trayId={inTray ? trayKey!.split('.')[0]! : null} />
            <StageActions trayKey={trayKey} view={view} />
            <p className="hint" id="stage-hint">
              {inTray ? (
                <>
                  <span className="hint-long">Click a part · drag to rotate · scroll or pinch to zoom · ↑ ↓ to step · Esc to go back</span>
                  <span className="hint-short">Tap a part · drag to rotate · pinch to zoom</span>
                </>
              ) : view === 'rear' ? (
                <>
                  <span className="hint-long">
                    Rear: click a cartridge, manifold or the bus bar · lines show NVLink, coolant and power to every unit
                  </span>
                  <span className="hint-short">Tap a rear part · drag to rotate</span>
                </>
              ) : (
                <>
                  <span className="hint-long">
                    Click a unit, click again to open it · drag to rotate · ↑ ↓ to step · Enter to open · Esc to go back
                  </span>
                  <span className="hint-short">Tap a unit, tap again to open · drag to rotate</span>
                </>
              )}
            </p>
          </section>
        )}

        <section className={selected ? 'panel open' : 'panel'} aria-label="Details">
          <SidePanel />
        </section>
      </main>

      <footer className="footer">
        Data: {model.topology.meta.document.title} ({model.topology.meta.document.date}) and{' '}
        {model.topology.meta.serviceManual?.title} ({model.topology.meta.serviceManual?.date}). Unofficial; not affiliated
        with or endorsed by NVIDIA. NVIDIA, DGX, Vera, Rubin, NVLink, NVSwitch, ConnectX and BlueField are trademarks
        of NVIDIA Corporation. 3D geometry is original and illustrative.
      </footer>
    </div>
  );
}
