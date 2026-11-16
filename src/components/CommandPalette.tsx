import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { model } from '../data';
import { useShallow } from 'zustand/react/shallow';
import { useExplorer } from '../state/store';
import { useI18n } from '../i18n';
import { paletteActions, paletteResults } from './palette';

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Ctrl+K / Cmd+K (or "/" outside a text field) opens a dialog that runs an
 * action or selects a part. Not shown in an embed.
 */
export function CommandPalette({ webgl }: { webgl: boolean }) {
  const embed = useExplorer((s) => s.embed);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const returnTo = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const titleId = useId();
  const i18n = useI18n();
  const { t } = i18n;
  // The fields the action list depends on, so labels like "Hide list" stay current.
  const deps = useExplorer(
    useShallow((s) => [s.listOpen, s.network, s.page, s.compare, s.selected, s.procedure, s.panelOpen, s.embed]),
  );
  const actions = useMemo(
    () => (open ? paletteActions(model, useExplorer.getState(), i18n, webgl) : []),
    [open, i18n, webgl, ...deps],
  );
  const results = useMemo(() => (open ? paletteResults(model, query, actions, i18n) : []), [open, query, actions, i18n]);
  const shortcut = isMac() ? t('palette.shortcutMac') : t('palette.shortcutOther');

  const show = () => {
    const el = document.activeElement;
    returnTo.current = el instanceof HTMLElement && el !== document.body ? el : null;
    setQuery('');
    setActive(0);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    const back = returnTo.current;
    returnTo.current = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (embed) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey) return;
      const k = e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey) && !e.shiftKey;
      const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !isTyping(e.target);
      if (!k && !slash) return;
      e.preventDefault();
      if (dialogRef.current) inputRef.current?.focus();
      else show();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [embed]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open && results.length > 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, results.length, listId]);

  if (embed) return null;

  const run = (i: number) => {
    const item = results[i];
    if (!item) return;
    close();
    item.run(useExplorer.getState());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a + d + results.length) % results.length);
    } else if (e.key === 'Home' && e.ctrlKey) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && e.ctrlKey) {
      e.preventDefault();
      setActive(Math.max(0, results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(active);
    } else if (e.key === 'Escape') {
      // Only the dialog closes; the global Escape (go up a level) must not fire.
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      // Keep focus inside the dialog.
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('input, button') ?? [])];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const current = Math.min(active, Math.max(0, results.length - 1));

  return (
    <>
      <button type="button" className="toggle palette-button" title={t('palette.openHint', { shortcut })} onClick={show}>
        {t('palette.open')} <kbd aria-hidden="true">{shortcut}</kbd>
      </button>
      {open && (
        <div
          className="palette-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            className="palette"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={onKeyDown}
          >
            <div className="palette-head">
              <h2 id={titleId} className="sr-only">
                {t('palette.title')}
              </h2>
              <input
                ref={inputRef}
                type="text"
                className="palette-input"
                role="combobox"
                aria-label={t('palette.inputLabel')}
                aria-expanded={results.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={results.length > 0 ? `${listId}-${current}` : undefined}
                placeholder={t('palette.placeholder')}
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
              />
              <button type="button" className="palette-close" onClick={close}>
                {t('palette.close')}
              </button>
            </div>
            <ul id={listId} role="listbox" className="palette-results" aria-label={t('palette.results')}>
              {results.map((r, i) => (
                <li
                  key={r.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === current}
                  className={i === current ? 'active' : undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => i !== current && setActive(i)}
                  onClick={() => run(i)}
                >
                  <span className="palette-label">{r.label}</span>
                  <span className="palette-meta">
                    {r.detail && <span className="muted">{r.detail}</span>}
                    <span className="palette-kind">{r.kind === 'part' ? t('palette.kindPart') : t('palette.kindAction')}</span>
                  </span>
                </li>
              ))}
            </ul>
            {results.length === 0 && (
              <p className="palette-empty muted" role="status">
                {t('palette.noResults', { query })}
              </p>
            )}
            <p className="palette-help muted small" aria-hidden="true">
              {t('palette.help')}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
