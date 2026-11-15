import { useState } from 'react';
import { useI18n } from '../i18n';

/** Copy a link to the current view, or an embed snippet for it. */
export function Share() {
  const [copied, setCopied] = useState('');
  const { t } = useI18n();
  const url = typeof window === 'undefined' ? '' : window.location.href;
  const embedUrl = url.includes('?') ? `${url}&embed=1` : `${url}?embed=1`;
  const snippet = `<iframe src="${embedUrl}" title="${t('site.title')}" width="960" height="600" style="border:0" loading="lazy"></iframe>`;
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied('');
    }
  };
  return (
    <section>
      <h3>{t('share.title')}</h3>
      <div className="share-row">
        <button type="button" className="link-button" onClick={() => copy(window.location.href, 'link')}>
          {t('share.copyLink')}
        </button>
        <button type="button" className="link-button" onClick={() => copy(snippet, 'embed')}>
          {t('share.copyEmbed')}
        </button>
        <span className="muted small" role="status">
          {copied === 'link' ? t('share.linkCopied') : copied === 'embed' ? t('share.embedCopied') : ''}
        </span>
      </div>
    </section>
  );
}
