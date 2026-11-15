import { model } from '../data';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';

/** Rack > Compute tray 7 > Rubin GPU. Every step but the last is a link back. */
export function Breadcrumb() {
  const selected = useExplorer((s) => s.selected);
  const select = useExplorer((s) => s.select);
  const i18n = useI18n();
  const segments = model.parsePath(selected) ?? [];
  const crumbs = [
    { label: i18n.t('breadcrumb.rack'), path: '' },
    ...segments.map((seg, i) => ({
      label: i18n.segmentLabel(seg),
      path: model.formatPath(segments.slice(0, i + 1)),
    })),
  ];
  return (
    <nav aria-label={i18n.t('breadcrumb.label')} className="breadcrumb">
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
