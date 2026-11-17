import type { Model } from '../data/model';
import { i18nFor, LANGS, type I18n } from '../i18n';
import { THEME_PREFS } from '../theme';
import type { useExplorer } from '../state/store';
import { search } from './search';

type Explorer = ReturnType<typeof useExplorer.getState>;

export interface PaletteItem {
  /** Stable id, e.g. "network:ipminet" or "part:compute-tray.3". */
  id: string;
  kind: 'action' | 'part';
  label: string;
  detail: string;
  /** Extra text to match, such as the English label in another language. */
  keywords: string;
  run: (s: Explorer) => void;
}

type ActionSpec = Omit<PaletteItem, 'kind' | 'keywords'>;

/** Leave the Sources or What changed page, so whatever the action shows is on screen. */
const leavePage = (s: Explorer) => {
  if (s.page !== '') s.setPage('');
};

/** Language names: in the interface language and in the language itself. */
function languageName(code: string, inLang: string): string {
  try {
    return new Intl.DisplayNames([inLang], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function specs(model: Model, s: Explorer, i18n: I18n, webgl: boolean): ActionSpec[] {
  const { t } = i18n;
  const out: ActionSpec[] = [];
  if (webgl) {
    out.push(
      { id: 'view:front', label: t('palette.front'), detail: t('stage.side'), run: (x) => (leavePage(x), x.setSide('rack')) },
      { id: 'view:rear', label: t('palette.rear'), detail: t('stage.side'), run: (x) => (leavePage(x), x.setSide('rear')) },
      {
        id: 'list',
        label: s.listOpen ? t('top.hideList') : t('top.listView'),
        detail: '',
        run: (x) => x.setListOpen(!x.listOpen),
      },
    );
  }
  for (const n of model.topology.networks) {
    out.push({
      id: `network:${n.id}`,
      label: t('palette.network', { number: n.number, name: n.name }),
      detail: t('networkBar.label'),
      // setNetwork toggles; the palette only ever turns a network on.
      run: (x) => {
        leavePage(x);
        if (x.network !== n.id) x.setNetwork(n.id);
      },
    });
  }
  if (s.network !== '') {
    out.push({ id: 'network:clear', label: t('palette.clearNetwork'), detail: t('networkBar.label'), run: (x) => x.setNetwork(x.network) });
  }
  out.push(
    s.page !== ''
      ? { id: 'page:close', label: t('palette.closeSources'), detail: '', run: (x) => x.setPage('') }
      : { id: 'page:sources', label: t('palette.openSources'), detail: '', run: (x) => x.setPage('sources') },
  );
  if (s.page !== 'changes') out.push({ id: 'page:changes', label: t('palette.openChanges'), detail: '', run: (x) => x.setPage('changes') });
  if (!s.embed) out.push({ id: 'quiz', label: t('palette.startQuiz'), detail: t('quiz.aria'), run: (x) => x.startQuiz() });
  if (s.compare !== '') {
    out.push({ id: 'compare:stop', label: t('compare.stop'), detail: t('compare.heading'), run: (x) => x.stopCompare() });
  } else if (s.selected !== '') {
    const segments = model.parsePath(s.selected);
    const last = segments?.[segments.length - 1];
    const name = last ? i18n.segmentLabel(last) : s.selected;
    out.push({ id: 'compare:start', label: t('compare.startHint', { name }), detail: t('compare.start'), run: (x) => x.startCompare() });
  }
  if (s.procedure !== '') {
    out.push({ id: 'procedure:stop', label: t('palette.stopProcedure'), detail: '', run: (x) => x.stopProcedure() });
  }
  for (const p of model.topology.procedures ?? []) {
    out.push({
      id: `procedure:${p.id}`,
      label: t('procedure.walkThrough', { title: i18n.procedureTitle(p.id, p.title), count: p.steps.length }),
      detail: p.kind === 'operation' ? t('procedure.operations') : t('procedure.service'),
      run: (x) => (leavePage(x), x.startProcedure(p.id)),
    });
  }
  for (const l of LANGS) {
    const own = languageName(l, l);
    const here = languageName(l, i18n.lang);
    out.push({
      id: `lang:${l}`,
      label: t('palette.language', { name: here === own ? own : `${here} · ${own}` }),
      detail: i18nFor(l).t('language.self'),
      run: (x) => x.setLang(l),
    });
  }
  for (const p of THEME_PREFS) {
    out.push({ id: `theme:${p}`, label: t('palette.theme', { name: t(`theme.${p}`) }), detail: t('theme.label'), run: (x) => x.setThemePref(p) });
  }
  if (webgl) {
    out.push({
      id: 'details',
      label: s.panelOpen ? t('detailsToggle.collapse') : t('detailsToggle.expand'),
      detail: '',
      run: (x) => x.setPanelOpen(!x.panelOpen),
    });
  }
  return out;
}

/**
 * Actions the palette offers right now, built from the store and the data:
 * views, the list, every network, the Sources page, the quiz, comparing,
 * every service walkthrough, languages, themes and the details panel. The 3D
 * view, list and details actions need WebGL. Camera presets are not here:
 * they live inside the canvas with no store action to call.
 */
export function paletteActions(model: Model, s: Explorer, i18n: I18n, webgl: boolean): PaletteItem[] {
  const english = i18n.lang === 'en' ? null : new Map(specs(model, s, i18nFor('en'), webgl).map((a) => [a.id, a]));
  return specs(model, s, i18n, webgl).map((a) => {
    const en = english?.get(a.id);
    return { ...a, kind: 'action', keywords: en ? `${en.label} ${en.detail}` : '' };
  });
}

/** Lower score is a better match; null is no match. */
export function matchScore(query: string, item: Pick<PaletteItem, 'label' | 'detail' | 'keywords'>): number | null {
  const q = query.trim().toLocaleLowerCase();
  if (q === '') return 0;
  const label = item.label.toLocaleLowerCase();
  if (label === q) return 0;
  if (label.startsWith(q)) return 1;
  const wordStart = (text: string) => text.split(/[\s:·.,()（）：]+/).some((w) => w.startsWith(q));
  if (wordStart(label)) return 2;
  if (label.includes(q)) return 3;
  const all = `${label} ${item.detail} ${item.keywords}`.toLocaleLowerCase();
  if (wordStart(all)) return 4;
  const words = q.split(/\s+/);
  if (words.every((w) => all.includes(w))) return 5;
  return null;
}

/**
 * Results for a query: with no query, every action; otherwise strong action
 * matches first, then parts from the search box's own search, then weaker
 * action matches. Ties keep the actions' own order.
 */
export function paletteResults(model: Model, query: string, actions: PaletteItem[], i18n: I18n, partLimit = 8): PaletteItem[] {
  if (query.trim() === '') return actions;
  const scored = actions
    .map((a, i) => ({ a, i, score: matchScore(query, a) }))
    .filter((x): x is { a: PaletteItem; i: number; score: number } => x.score !== null)
    .sort((x, y) => x.score - y.score || x.i - y.i);
  const strong = scored.filter((x) => x.score <= 2).map((x) => x.a);
  const weak = scored.filter((x) => x.score > 2).map((x) => x.a);
  const parts: PaletteItem[] = search(model, query, partLimit, i18n).map((h) => ({
    id: `part:${h.path}|${h.detail}`,
    kind: 'part',
    label: h.label,
    detail: h.detail,
    keywords: '',
    run: (x) => {
      leavePage(x);
      x.select(h.path);
    },
  }));
  return [...strong, ...parts, ...weak];
}
