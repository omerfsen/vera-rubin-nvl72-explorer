import { lazy, Suspense, useEffect, useState } from 'react';
import { Breadcrumb } from './components/Breadcrumb';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RackList } from './components/RackList';
import { Search } from './components/Search';
import { SidePanel } from './components/SidePanel';
import { hasWebGL } from './lib/webgl';
import { model } from './data';
import { TYPE_COLORS } from './scenes/geometry';
import { syncUrl, useExplorer } from './state/store';

const RackScene = lazy(() => import('./scenes/RackScene'));

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
      const s = useExplorer.getState();
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        s.stepRackUnit(1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        s.stepRackUnit(-1);
      } else if (e.key === 'Escape') {
        const parts = s.selected.split('/');
        s.select(parts.slice(0, -1).join('/'));
      } else if (e.key === '/') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Legend() {
  const types = [...new Set(model.rackUnits.map((u) => u.componentId))];
  return (
    <ul className="legend" aria-label="Legend">
      {types.map((id) => {
        const c = model.getComponent(id);
        return (
          <li key={id}>
            <span className="swatch" style={{ background: TYPE_COLORS[c?.type ?? 'rack'] }} aria-hidden="true" />
            {c?.name}
          </li>
        );
      })}
    </ul>
  );
}

export default function App() {
  const [webgl] = useState(hasWebGL);
  const listOpen = useExplorer((s) => s.listOpen);
  const setListOpen = useExplorer((s) => s.setListOpen);
  const selected = useExplorer((s) => s.selected);
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
          <button type="button" className="toggle" aria-pressed={listOpen} onClick={() => setListOpen(!listOpen)}>
            {listOpen ? 'Hide list' : 'List view'}
          </button>
        )}
      </header>

      <Breadcrumb />

      <main className={!webgl ? 'layout list-only' : showList ? 'layout with-list' : 'layout'}>
        {showList && (
          <aside className="list-pane">
            {!webgl && (
              <p className="notice" role="status">
                WebGL is not available in this browser, so the rack is shown as a list.
              </p>
            )}
            <RackList />
          </aside>
        )}

        {webgl && (
          <section className="stage" aria-label="Rack view">
            <ErrorBoundary
              fallback={
                <p className="notice" role="alert">
                  The 3D view could not start. Use the list view instead.
                </p>
              }
            >
              <Suspense fallback={<p className="notice">Loading 3D view…</p>}>
                <RackScene />
              </Suspense>
            </ErrorBoundary>
            <Legend />
            <p className="hint">Click a unit · drag to rotate · scroll or pinch to zoom · ↑ ↓ to step · Esc to go back</p>
          </section>
        )}

        <aside className={selected ? 'panel open' : 'panel'} aria-label="Details">
          <SidePanel />
        </aside>
      </main>

      <footer className="footer">
        Data: {model.topology.meta.document.title} ({model.topology.meta.document.date}). Unofficial; not affiliated
        with or endorsed by NVIDIA. NVIDIA, DGX, Vera, Rubin, NVLink, NVSwitch, ConnectX and BlueField are trademarks
        of NVIDIA Corporation. 3D geometry is original and illustrative.
      </footer>
    </div>
  );
}
