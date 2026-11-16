/** Write text to the clipboard. false when the browser has no clipboard API or refuses (plain http, permissions). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open the system share sheet on touch devices that have one. 'shared' when
 * it opened (or the user closed it), 'unavailable' to fall back to copying.
 */
export async function shareUrl(url: string, title: string): Promise<'shared' | 'unavailable'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'unavailable';
  if (typeof window === 'undefined' || !window.matchMedia?.('(pointer: coarse)').matches) return 'unavailable';
  try {
    await navigator.share({ url, title });
    return 'shared';
  } catch (e) {
    // The user closed the sheet: that is an answer, not a failure.
    return e instanceof DOMException && e.name === 'AbortError' ? 'shared' : 'unavailable';
  }
}
