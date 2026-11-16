import { model } from '../data';
import { ROOT_ID } from '../data/model';
import type { I18n } from '../i18n';
import { trayKeyOf, type View } from '../state/url';
import type { Caption } from '../lib/screenshot';

/** "Compute tray 7 › Rubin GPU · Tray view" on the left, "<site title> · <address>" on the right. */
export function screenshotCaption(state: { selected: string; view: View }, i18n: I18n, href: string): Caption {
  const segments = model.parsePath(state.selected) ?? [];
  const name = segments.length ? segments.map((s) => i18n.segmentLabel(s)).join(' › ') : i18n.name(ROOT_ID);
  const inTray = state.view === 'tray' && trayKeyOf(state.selected, model) !== null;
  const view = i18n.t(inTray ? 'screenshot.viewTray' : state.view === 'rear' ? 'screenshot.viewRear' : 'screenshot.viewFront');
  let address = href;
  try {
    const u = new URL(href);
    address = (u.host + u.pathname).replace(/\/$/, '');
  } catch {
    // Keep what was given.
  }
  return { subject: `${name} · ${view}`, site: `${i18n.t('site.title')} · ${address}` };
}
