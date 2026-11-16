/**
 * Read-aloud helpers around the browser's own speech (Web Speech API).
 * Nothing is uploaded: the browser or the OS speaks the text.
 */

/** BCP 47 tags for the app's languages. */
const SPEECH_LANG: Record<string, string> = { en: 'en-US', tr: 'tr-TR', zh: 'zh-CN', ru: 'ru-RU', es: 'es-ES' };

export function speechLang(lang: string): string {
  return SPEECH_LANG[lang] ?? lang;
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.speechSynthesis) && typeof window.SpeechSynthesisUtterance === 'function';
}

/** The best voice for a language: an exact tag, then any voice of that language; local voices first. */
export function pickVoice(voices: readonly SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const tag = speechLang(lang).toLowerCase();
  const base = tag.split('-')[0]!;
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
  const local = (list: SpeechSynthesisVoice[]) => list.find((v) => v.localService) ?? list[0] ?? null;
  const exact = voices.filter((v) => norm(v) === tag);
  if (exact.length) return local(exact);
  const same = voices.filter((v) => norm(v).split('-')[0] === base);
  return local(same);
}

/**
 * Split text into pieces short enough to speak: some browsers stop a long
 * utterance after about 15 seconds. Breaks at sentence ends, then commas,
 * then spaces.
 */
export function chunkText(text: string, max = 200): string[] {
  const out: string[] = [];
  // A sentence ends at . ! ? before a space (so "2.3" stays whole), or at a CJK stop.
  const sentences = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?](?=\s)|[。！？])/);
  for (const raw of sentences) {
    let s = raw.trim();
    while (s.length > max) {
      const cut = Math.max(s.lastIndexOf(', ', max), s.lastIndexOf('，', max), s.lastIndexOf(' ', max));
      const at = cut > max / 3 ? cut + 1 : max;
      out.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

/** Controls, citations and helper text that are not part of what the panel says. */
const SKIP =
  'button, input, select, textarea, svg, [aria-hidden="true"], [role="status"], [role="dialog"], .sr-only, .spec-source, .inline-source, pre, code, [data-no-read]';
/** Buttons that are words in a sentence (glossary terms, links to parts): keep their text. */
const INLINE = 'button.gloss-term, button.link-button';

/** The text a reader hears for the panel: everything from the part's heading down, without its controls. */
export function panelText(article: Element, startSelector = '.panel-header'): string {
  const start = article.querySelector(startSelector);
  const parts: string[] = [];
  let node: Element | null = start;
  while (node) {
    const copy = node.cloneNode(true) as Element;
    copy.querySelectorAll('[role="dialog"]').forEach((el) => el.remove());
    copy.querySelectorAll(INLINE).forEach((el) => el.replaceWith(el.textContent ?? ''));
    copy.querySelectorAll(SKIP).forEach((el) => el.remove());
    if (!copy.matches(SKIP)) {
      // Labels lead into their value; blocks read as separate sentences.
      copy.querySelectorAll('span, div').forEach((el) => {
        el.prepend(' ');
        el.append(' ');
      });
      copy.querySelectorAll('.note').forEach((el) => el.prepend('. '));
      copy.querySelectorAll('th, dt').forEach((el) => el.append(': '));
      copy.querySelectorAll('h2, h3, h4, p, li, dd, td, summary, .note').forEach((el) => el.append('. '));
      const text = (copy.textContent ?? '').replace(/\s+/g, ' ').replace(/(\s*[.:]\s*){2,}/g, (m) => (m.includes(':') && !m.includes('.') ? ': ' : '. ')).trim();
      if (text) parts.push(text);
    }
    node = node.nextElementSibling;
  }
  return parts.join(' ').replace(/\s+([.:])/g, '$1').replace(/^[.\s]+/, '').trim();
}
