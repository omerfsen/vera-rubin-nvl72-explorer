import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { canRecord, recordingName, saveBlob, startRecording, type Recording } from '../lib/recorder';

type Phase = 'idle' | 'starting' | 'recording';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Record the tab to WebM and MP4, saved on the visitor's machine. */
export function Recorder() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState('');
  const rec = useRef<Recording | null>(null);

  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  if (!canRecord()) return null;

  const finish = async () => {
    const current = rec.current;
    if (!current) return;
    rec.current = null;
    setPhase('idle');
    const files = await current.stop();
    const at = new Date();
    for (const { format, blob } of files) saveBlob(blob, recordingName(format, at));
    const names = files.map((f) => f.format.toUpperCase()).join(', ');
    setStatus(t('record.saved', { files: names }) + (current.formats.includes('mp4') ? '' : ' ' + t('record.noMp4')));
  };

  const start = async () => {
    setStatus('');
    setPhase('starting');
    try {
      rec.current = await startRecording(() => void finish());
      setSeconds(0);
      setPhase('recording');
    } catch {
      setPhase('idle');
      setStatus(t('record.denied'));
    }
  };

  return (
    <div className="recorder">
      {phase === 'recording' ? (
        <button type="button" className="toggle recording" onClick={() => void finish()}>
          {t('record.stop', { time: clock(seconds) })}
        </button>
      ) : (
        <button type="button" className="toggle" disabled={phase === 'starting'} title={t('record.hint')} onClick={() => void start()}>
          {t('record.start')}
        </button>
      )}
      <span className="muted small" role="status">{status}</span>
    </div>
  );
}
