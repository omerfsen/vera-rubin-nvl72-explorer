import { useEffect, useRef, useState, type RefObject } from 'react';
import { useI18n } from '../i18n';
import { useExplorer } from '../state/store';
import { chunkText, panelText, pickVoice, speechLang, speechSupported } from '../lib/speech';

/**
 * "Read aloud" next to the part's heading: reads the side panel with the
 * browser's own speech. It only speaks after a press, stops on a second
 * press, and stops when the part or the language changes. Hidden when the
 * browser has no speech, or lists voices but none for the current language.
 */
export function ReadAloud({ panel, name }: { panel: RefObject<HTMLElement | null>; name: string }) {
  const { t, lang } = useI18n();
  const selected = useExplorer((s) => s.selected);
  // undefined: no voice for this language. null: the browser lists no voices yet
  // (Android Chrome can do this until it first speaks), so let it pick by language.
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null | undefined>(undefined);
  const [speaking, setSpeaking] = useState(false);
  const run = useRef(0);

  // Voices load late in some browsers, so listen for them.
  useEffect(() => {
    if (!speechSupported()) return;
    const synth = window.speechSynthesis;
    const update = () => {
      const voices = synth.getVoices();
      setVoice(voices.length === 0 ? null : (pickVoice(voices, lang) ?? undefined));
    };
    update();
    synth.addEventListener?.('voiceschanged', update);
    return () => synth.removeEventListener?.('voiceschanged', update);
  }, [lang]);

  const stop = () => {
    run.current += 1;
    if (speechSupported()) window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  // A new part, a new language or leaving the panel ends the reading.
  useEffect(() => stop, [selected, lang]);

  if (!speechSupported() || voice === undefined) return null;

  const play = () => {
    const article = panel.current;
    if (!article) return;
    const chunks = chunkText(panelText(article));
    if (chunks.length === 0) return;
    stop();
    const id = run.current;
    const synth = window.speechSynthesis;
    chunks.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLang(lang);
      if (voice) u.voice = voice;
      if (i === chunks.length - 1) {
        u.onend = () => run.current === id && setSpeaking(false);
      }
      u.onerror = () => run.current === id && setSpeaking(false);
      synth.speak(u);
    });
    setSpeaking(true);
  };

  const label = speaking ? t('readAloud.stop') : t('readAloud.play', { name });
  return (
    <button
      type="button"
      className="part-link-button read-aloud"
      aria-pressed={speaking}
      aria-label={label}
      title={label}
      onClick={() => (speaking ? stop() : play())}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        {speaking ? <rect x="6" y="6" width="12" height="12" rx="1" /> : <path d="M8 5v14l11-7z" />}
      </svg>
      <span>{speaking ? t('readAloud.stopShort') : t('readAloud.short')}</span>
    </button>
  );
}
