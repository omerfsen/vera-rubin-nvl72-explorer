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

/**
 * The voice for a language: the system default if it speaks the language,
 * else an exact tag, else the same language (for Chinese, mainland first);
 * local voices before network ones.
 */
export function pickVoice(voices: readonly SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const tag = speechLang(lang).toLowerCase();
  const base = tag.split('-')[0]!;
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
  const best = (list: SpeechSynthesisVoice[]) => list.find((v) => v.default) ?? list.find((v) => v.localService) ?? list[0] ?? null;
  const exact = voices.filter((v) => norm(v) === tag);
  if (exact.length) return best(exact);
  const same = voices.filter((v) => norm(v).split('-')[0] === base);
  // Hong Kong and Taiwan voices read Cantonese or Taiwanese conventions; use them last for zh.
  const preferred = base === 'zh' ? same.filter((v) => !/-(hk|tw|mo)\b/.test(norm(v))) : same;
  return best(preferred.length ? preferred : same);
}

/** CJK characters take about twice as long to say as a Latin letter. */
function spokenLength(text: string): number {
  let n = 0;
  for (const ch of text) n += /[　-鿿가-힯＀-￯]/.test(ch) ? 2.5 : 1;
  return n;
}

/** Abbreviations whose dot does not end a sentence. */
const ABBREV = /(?:^|\s)(?:Fig|Figs|Sec|No|Nos|vs|approx|etc|e\.g|i\.e|cf|Rev|Vol|p|pp|Рис|рис|т\.е|напр|Şek|örn|vb|p\.ej|pág)\.$/i;

/** Split into sentences without lookbehind (older Safari cannot parse it). */
function sentences(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  const chars = [...text];
  chars.forEach((ch, i) => {
    cur += ch;
    const next = chars[i + 1];
    const cjkStop = ch === '。' || ch === '！' || ch === '？';
    const latinStop = (ch === '.' || ch === '!' || ch === '?') && (next === undefined || next === ' ');
    if (cjkStop || (latinStop && !(ch === '.' && ABBREV.test(cur)))) {
      out.push(cur.trim());
      cur = '';
    }
  });
  if (cur.trim()) out.push(cur.trim());
  return out.filter((x) => x && !/^[.。\s]+$/.test(x));
}

/**
 * Split text into pieces short enough to speak: some browsers stop a long
 * utterance after about 15 seconds, so pieces stay well under that.
 * Breaks at sentence ends, then commas, then spaces.
 */
export function chunkText(text: string, max = 130): string[] {
  const out: string[] = [];
  for (let s of sentences(text.replace(/\s+/g, ' ').trim())) {
    while (spokenLength(s) > max) {
      // Longest prefix within budget, cut at a comma or space if one is there.
      let fit = 0;
      let len = 0;
      for (const ch of s) {
        len += spokenLength(ch);
        if (len > max) break;
        fit += ch.length;
      }
      const head = s.slice(0, fit);
      const cut = Math.max(head.lastIndexOf(', '), head.lastIndexOf('，'), head.lastIndexOf('、'), head.lastIndexOf(' '));
      const at = cut > fit / 3 ? cut + 1 : fit;
      out.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

/** Controls, citations and helper text that are not part of what the panel says. */
const SKIP =
  'button, input, select, textarea, svg, [aria-hidden="true"], [role="status"], [role="dialog"], .sr-only, .spec-source, .inline-source, .part-link-manual, pre, code, [data-no-read]';
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
      copy.querySelectorAll('.assumed, .gap-badge, .conn-kind').forEach((el) => el.append(': '));
      copy.querySelectorAll('h2, h3, h4, p, li, dd, td, summary, caption, figcaption, .note').forEach((el) => el.append('. '));
      const text = (copy.textContent ?? '').replace(/\s+/g, ' ').replace(/(\s*[.:]\s*){2,}/g, (m) => (m.includes(':') && !m.includes('.') ? ': ' : '. ')).trim();
      if (text) parts.push(text);
    }
    node = node.nextElementSibling;
  }
  return parts
    .join(' ')
    .replace(/\s+([.:,)])/g, '$1')
    .replace(/([(/])\s+/g, '$1')
    .replace(/([。！？：])[.:]+/g, '$1')
    .replace(/:\s*:/g, ':')
    .replace(/^[.\s]+/, '')
    .trim();
}
