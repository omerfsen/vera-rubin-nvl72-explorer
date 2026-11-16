import { useState } from 'react';
import { useI18n } from '../i18n';
import { copyText } from './clipboard';
import { embedUrl } from '../state/url';

/** Copy a link to the current view, or an embed snippet for it. */
export function Share() {
  const [copied, setCopied] = useState('');
  const { t } = useI18n();
  const url = typeof window === 'undefined' ? '' : window.location.href;
  const snippet = `<iframe src="${embedUrl(url)}" title="${t('site.title')}" width="960" height="600" style="border:0" loading="lazy"></iframe>`;
  const copy = async (text: string, what: string) => {
    setCopied((await copyText(text)) ? what : '');
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
