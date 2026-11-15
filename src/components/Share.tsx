import { useState } from 'react';
import site from '../../data/site.json';

/** Copy a link to the current view, or an embed snippet for it. */
export function Share() {
  const [copied, setCopied] = useState('');
  const url = typeof window === 'undefined' ? '' : window.location.href;
  const embedUrl = url.includes('?') ? `${url}&embed=1` : `${url}?embed=1`;
  const snippet = `<iframe src="${embedUrl}" title="${site.title}" width="960" height="600" style="border:0" loading="lazy"></iframe>`;
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
      <h3>Share</h3>
      <div className="share-row">
        <button type="button" className="link-button" onClick={() => copy(window.location.href, 'link')}>
          Copy link to this view
        </button>
        <button type="button" className="link-button" onClick={() => copy(snippet, 'embed')}>
          Copy embed code
        </button>
        <span className="muted small" role="status">
          {copied === 'link' ? 'Link copied.' : copied === 'embed' ? 'Embed code copied.' : ''}
        </span>
      </div>
    </section>
  );
}
