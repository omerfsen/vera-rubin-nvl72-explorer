import { useState } from 'react';
import { useI18n } from '../i18n';
import { useExplorer } from '../state/store';
import { recordingName, saveBlob } from '../lib/recorder';
import { canCopyImage, canvasToPng, captureSource, compose, copyPng } from '../lib/screenshot';
import { screenshotCaption } from './screenshotCaption';

/** Save the 3D view as a PNG, or copy it to the clipboard. Nothing is uploaded. */
export function Screenshot() {
  const i18n = useI18n();
  const { t } = i18n;
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  /** The composed image, made in this task, right after a fresh render. */
  const shoot = (): HTMLCanvasElement | null => {
    const source = captureSource();
    if (!source) return null;
    const s = useExplorer.getState();
    try {
      return compose(source, screenshotCaption(s, i18n, window.location.href));
    } catch {
      return null;
    }
  };

  const save = async () => {
    setStatus('');
    const canvas = shoot();
    if (!canvas) return setStatus(t('screenshot.failed'));
    setBusy(true);
    try {
      saveBlob(await canvasToPng(canvas), recordingName('png'));
      setStatus(t('screenshot.saved'));
    } catch {
      setStatus(t('screenshot.failed'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    setStatus('');
    if (!canCopyImage()) return setStatus(t('screenshot.noCopy'));
    const canvas = shoot();
    if (!canvas) return setStatus(t('screenshot.failed'));
    setBusy(true);
    const ok = await copyPng(canvasToPng(canvas));
    setBusy(false);
    setStatus(ok ? t('screenshot.copied') : t('screenshot.copyFailed'));
  };

  return (
    <div className="screenshot" role="group" aria-label={t('screenshot.group')}>
      <button type="button" className="toggle" disabled={busy} title={t('screenshot.hint')} onClick={() => void save()}>
        {t('screenshot.save')}
      </button>
      <button
        type="button"
        className="toggle screenshot-copy"
        disabled={busy}
        aria-label={t('screenshot.copy')}
        title={t('screenshot.copy')}
        onClick={() => void copy()}
      >
        <span aria-hidden="true">⧉</span>
      </button>
      <span className="muted small" role="status">{status}</span>
    </div>
  );
}
