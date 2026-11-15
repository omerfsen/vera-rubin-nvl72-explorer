import { model } from '../data';
import { useExplorer } from '../state/store';

/** Rack > Compute tray 7 > Rubin GPU. Every step but the last is a link back. */
export function Breadcrumb() {
  const selected = useExplorer((s) => s.selected);
  const select = useExplorer((s) => s.select);
  const segments = model.parsePath(selected) ?? [];
  const crumbs = [
    { label: 'Rack', path: '' },
    ...segments.map((seg, i) => ({
      label: model.segmentLabel(seg),
      path: model.formatPath(segments.slice(0, i + 1)),
    })),
  ];
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol>
        {crumbs.map((c, i) => (
          <li key={c.path}>
            {i === crumbs.length - 1 ? (
              <span aria-current="page">{c.label}</span>
            ) : (
              <button type="button" onClick={() => select(c.path)}>
                {c.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
