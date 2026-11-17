import { useEffect, useRef, useState, type RefObject } from 'react';
import { useI18n } from '../i18n';
import { useExplorer } from '../state/store';
import { chunkText, panelText, pickVoice, speechLang, speechSupported } from '../lib/speech';

/** If speech has not started this long after a press, the browser cannot speak: give the button back. */
const START_TIMEOUT_MS = 3000;

/**
 * "Read aloud" next to the part's heading: reads the side panel with the
 * browser's own speech. It only speaks after a press, and stops on a second
 * press, a new part, a new language, a collapsed panel or leaving the page.
 * Hidden when the browser has no speech, or lists voices but none for the
 * current language.
 */
export function ReadAloud({ panel, name }: { panel: RefObject<HTMLElement | null>; name: string }) {
  const { t, lang } = useI18n();
  const selected = useExplorer((s) => s.selected);
  const panelOpen = useExplorer((s) => s.panelOpen);
  // undefined: no voice for this language. null: the browser lists no voices yet
  // (Android Chrome can do this until it first speaks), so let it pick by language.
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null | undefined>(undefined);
  const [speaking, setSpeaking] = useState(false);
  const run = useRef(0);
  // Chrome can drop the events of queued utterances nothing refers to, so keep them.
  const queue = useRef<SpeechSynthesisUtterance[]>([]);
  const watchdog = useRef<number | undefined>(undefined);

  const stop = () => {
    run.current += 1;
    window.clearTimeout(watchdog.current);
    queue.current = [];
    if (speechSupported()) {
      const synth = window.speechSynthesis;
      // Only cancel what is playing: cancel() just before speak() can swallow the next utterance.
      if (synth.speaking || synth.pending) synth.cancel();
    }
    setSpeaking(false);
  };

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

  // A new part, a new language, a collapsed panel, a lost voice or leaving the panel ends the reading.
  useEffect(() => stop, [selected, lang]);
  useEffect(() => {
    if (!panelOpen || voice === undefined) stop();
  }, [panelOpen, voice]);
  useEffect(() => {
    const onHide = () => stop();
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  if (!speechSupported() || voice === undefined) return null;

  const play = () => {
    const article = panel.current;
    if (!article) return;
    const chunks = chunkText(panelText(article));
    if (chunks.length === 0) return;
    stop();
    const id = run.current;
    const mine = () => run.current === id;
    const synth = window.speechSynthesis;
    // Spoken here, inside the click, so iOS counts it as the user's gesture.
    queue.current = chunks.map((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLang(lang);
      if (voice) u.voice = voice;
      u.onstart = () => mine() && window.clearTimeout(watchdog.current);
      u.onerror = (e) => {
        // A cancel is not a failure; anything else ends the whole reading.
        if (mine() && e.error !== 'interrupted' && e.error !== 'canceled') stop();
      };
      if (i === chunks.length - 1) u.onend = () => mine() && stop();
      synth.speak(u);
      return u;
    });
    watchdog.current = window.setTimeout(() => mine() && !synth.speaking && stop(), START_TIMEOUT_MS);
    setSpeaking(true);
  };

  const label = speaking ? t('readAloud.stop') : t('readAloud.play', { name });
  return (
    <button type="button" className="part-link-button read-aloud" aria-label={label} title={label} onClick={() => (speaking ? stop() : play())}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        {speaking ? <rect x="6" y="6" width="12" height="12" rx="1" /> : <path d="M8 5v14l11-7z" />}
      </svg>
      <span className="part-link-label">{speaking ? t('readAloud.stopShort') : t('readAloud.short')}</span>
    </button>
  );
}
