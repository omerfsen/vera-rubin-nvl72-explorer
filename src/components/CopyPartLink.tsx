import { useEffect, useRef, useState } from 'react';
import { useExplorer } from '../state/store';
import { partUrl } from '../state/url';
import { useI18n } from '../i18n';
import { copyText, shareUrl } from './clipboard';

/** How long "Link copied" stays up. */
const COPIED_MS = 2000;

/** The page's own address without query or hash, e.g. "https://example.net/". */
function pageBase(): string {
  return typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`;
}

/**
 * "Copy link" next to the part's heading: copies a clean link to the selected
 * part. Touch devices with a share sheet get that instead; when the clipboard
 * is blocked, the link is shown selected so it can be copied by hand.
 * Hidden at the rack itself, whose link is just the bare address.
 */
export function CopyPartLink({ name }: { name: string }) {
  const selected = useExplorer((s) => s.selected);
  const view = useExplorer((s) => s.view);
  const lang = useExplorer((s) => s.lang);
  const { t } = useI18n();
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const url = partUrl(pageBase(), { view, select: selected, lang });

  // A new part starts fresh.
  useEffect(() => setStatus('idle'), [selected]);

  useEffect(() => {
    if (status !== 'copied') return;
    const timer = window.setTimeout(() => setStatus('idle'), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status === 'manual') inputRef.current?.select();
  }, [status]);

  if (selected === '') return null;

  const onClick = async () => {
    if ((await shareUrl(url, name)) === 'shared') return;
    setStatus((await copyText(url)) ? 'copied' : 'manual');
  };

  return (
    <div className="part-link">
      <button type="button" className="part-link-button" aria-label={t('partLink.button', { name })} title={t('partLink.button', { name })} onClick={onClick}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
          <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
        </svg>
        <span className="part-link-label">{t('partLink.short')}</span>
      </button>
      <span className="part-link-status muted small" role="status">
        {status === 'copied' ? t('share.linkCopied') : ''}
      </span>
      {status === 'manual' && (
        <label className="part-link-manual">
          <span>{t('partLink.manual')}</span>
          <input ref={inputRef} type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
    </div>
  );
}
