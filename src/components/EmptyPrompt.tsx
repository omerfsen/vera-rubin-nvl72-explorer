import { model } from '../data';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';

const MAX_STARTS = 4;

/**
 * Quick starts: the first unit of each kind of front rack unit, in the order
 * the kinds first appear from the top of the rack, read from the rack layout.
 */
export function quickStarts(): { componentId: string; key: string; index: number }[] {
  const ids = [...new Set(model.rackUnits.map((u) => u.componentId))].slice(0, MAX_STARTS);
  return ids.map((id) => {
    const ofType = model.rackUnits.filter((u) => u.componentId === id);
    const first = ofType.reduce((a, b) => (b.index < a.index ? b : a));
    return { componentId: id, key: first.key, index: first.index };
  });
}

/**
 * A short prompt at the top of the rack panel while nothing is selected:
 * what to do, a few units to start from, and how to move with the keyboard.
 * `webgl`: false in the list-only fallback, which has no 3D rack.
 */
export function EmptyPrompt({ webgl = true }: { webgl?: boolean }) {
  const selected = useExplorer((s) => s.selected);
  const busy = useExplorer((s) => s.quiz !== null || s.compare !== '' || s.procedure !== '');
  const select = useExplorer((s) => s.select);
  const i18n = useI18n();
  const { t } = i18n;
  if (selected !== '' || busy) return null;
  const starts = quickStarts();

  return (
    <section className="empty-prompt" aria-label={t('emptyPanel.label')}>
      <p className="empty-prompt-lead">{webgl ? t('emptyPanel.lead3d') : t('emptyPanel.leadList')}</p>
      {starts.length > 0 && (
        <ul className="empty-prompt-starts" aria-label={t('emptyPanel.starts')}>
          {starts.map((s) => (
            <li key={s.key}>
              <button type="button" onClick={() => select(s.key)}>
                {i18n.segmentLabel({ id: s.componentId, index: s.index })}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="note">{webgl ? t('emptyPanel.keys3d') : t('emptyPanel.keysList')}</p>
    </section>
  );
}
