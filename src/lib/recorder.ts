// Records the browser tab to video with the screen-capture API. Everything
// stays on the visitor's machine: the files are saved locally, nothing is
// uploaded.
//
// The browser records WebM. On stop, Mediabunny (loaded only then) turns it
// into a proper MP4 (H.264, constant 30 fps, index at the front) and rewrites
// the WebM so it has a duration and can be seeked. Chrome's own MP4 recorder
// writes fragmented files with repeated timestamps, which many players
// handle badly, so it is not used. A browser that cannot record WebM
// (Safari) records its own MP4 instead.

export type VideoFormat = 'webm' | 'mp4';

const CANDIDATES: Record<VideoFormat, readonly string[]> = {
  webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
  mp4: ['video/mp4;codecs=avc1.640033', 'video/mp4;codecs=avc1', 'video/mp4'],
};

/** The same, with a voice track. */
const CANDIDATES_WITH_AUDIO: Record<VideoFormat, readonly string[]> = {
  webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'],
  mp4: ['video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus'],
};

export const MP4_FRAME_RATE = 30;

/** True when this browser can capture the screen and record it. */
export function canRecord(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

/** The first MIME type per format that MediaRecorder supports here. */
export function supportedTypes(
  isSupported: (t: string) => boolean = (t) => MediaRecorder.isTypeSupported(t),
  withAudio = false,
): Partial<Record<VideoFormat, string>> {
  const out: Partial<Record<VideoFormat, string>> = {};
  const table = withAudio ? CANDIDATES_WITH_AUDIO : CANDIDATES;
  for (const f of Object.keys(table) as VideoFormat[]) {
    const type = table[f].find(isSupported);
    if (type) out[f] = type;
  }
  return out;
}

/** What to record: WebM when possible, otherwise the browser's MP4. */
export function recordingType(types: Partial<Record<VideoFormat, string>>): { format: VideoFormat; mimeType: string } | null {
  if (types.webm) return { format: 'webm', mimeType: types.webm };
  if (types.mp4) return { format: 'mp4', mimeType: types.mp4 };
  return null;
}

/** vr-nvl72-20261116-142530.webm */
export function recordingName(format: VideoFormat, at: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}`;
  return `vr-nvl72-${stamp}.${format}`;
}

export interface RawRecording {
  format: VideoFormat;
  blob: Blob;
}

export interface Recording {
  format: VideoFormat;
  /** Whether the recording has the visitor's voice. */
  voice: boolean;
  /** The visitor asked for their voice but the microphone was refused. */
  voiceDenied: boolean;
  /** Stops recording and resolves with what the browser recorded. */
  stop(): Promise<RawRecording>;
}

/**
 * Asks to capture the screen (the current tab is offered first), and the
 * microphone when `voice` is set, then records them together. A refused
 * microphone records the screen without sound. `onEnded` fires when the
 * visitor stops sharing from the browser's bar.
 */
export async function startRecording(onEnded: () => void, { voice = false }: { voice?: boolean } = {}): Promise<Recording> {
  if (!recordingType(supportedTypes())) throw new Error('no-format');
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: MP4_FRAME_RATE },
    audio: false,
    // Chrome hints: offer this tab first.
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
  } as DisplayMediaStreamOptions);
  let mic: MediaStream | null = null;
  if (voice) {
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      mic = null;
    }
  }
  const audioPick = mic ? recordingType(supportedTypes(undefined, true)) : null;
  if (mic && !audioPick) {
    mic.getTracks().forEach((t) => t.stop());
    mic = null;
  }
  const pick = audioPick ?? recordingType(supportedTypes())!;
  const stream = new MediaStream([...display.getVideoTracks(), ...(mic?.getAudioTracks() ?? [])]);
  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream, {
    mimeType: pick.mimeType,
    videoBitsPerSecond: 12_000_000,
    ...(mic ? { audioBitsPerSecond: 128_000 } : {}),
  });
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const done = new Promise<RawRecording>((resolve) => {
    rec.onstop = () => resolve({ format: pick.format, blob: new Blob(chunks, { type: pick.mimeType }) });
  });
  rec.start(1000);
  let stopped = false;
  const stop = () => {
    if (!stopped) {
      stopped = true;
      if (rec.state !== 'inactive') rec.stop();
      display.getTracks().forEach((t) => t.stop());
      mic?.getTracks().forEach((t) => t.stop());
    }
    return done;
  };
  display.getVideoTracks()[0]?.addEventListener('ended', onEnded);
  return { format: pick.format, voice: mic !== null, voiceDenied: voice && mic === null, stop };
}

export interface SavedFile {
  format: VideoFormat;
  blob: Blob;
}

/**
 * Turns a raw recording into the files to save: from WebM, a seekable WebM
 * and an MP4. A step that fails is left out, and the raw WebM is kept when
 * the WebM rewrite fails.
 */
export async function finishRecording(
  raw: RawRecording,
  onProgress: (fraction: number) => void = () => {},
): Promise<{ files: SavedFile[]; mp4Failed: boolean }> {
  if (raw.format === 'mp4') return { files: [raw], mp4Failed: false };
  const mb = await import('mediabunny');
  // AAC plays everywhere; browsers that cannot encode it get Opus in the MP4.
  const mp4Audio = (await mb.canEncodeAudio('aac').catch(() => false)) ? 'aac' : 'opus';
  const convert = async (format: VideoFormat, progress: (p: number) => void): Promise<Blob> => {
    const input = new mb.Input({ source: new mb.BlobSource(raw.blob), formats: mb.ALL_FORMATS });
    const target = new mb.BufferTarget();
    const output = new mb.Output({
      format: format === 'mp4' ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(),
      target,
    });
    const conversion = await mb.Conversion.init({
      input,
      output,
      video:
        format === 'mp4'
          ? { codec: 'avc', frameRate: MP4_FRAME_RATE, bitrate: mb.QUALITY_HIGH, forceTranscode: true }
          : {},
      audio: format === 'mp4' ? { codec: mp4Audio, bitrate: 128_000 } : {},
    });
    if (!conversion.isValid) throw new Error('invalid-conversion');
    conversion.onProgress = progress;
    await conversion.execute();
    if (!target.buffer) throw new Error('empty-output');
    return new Blob([target.buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
  };
  let webm: Blob = raw.blob;
  try {
    webm = await convert('webm', () => {});
  } catch {
    // Keep the browser's WebM as it is.
  }
  const files: SavedFile[] = [{ format: 'webm', blob: webm }];
  let mp4Failed = false;
  try {
    files.push({ format: 'mp4', blob: await convert('mp4', onProgress) });
  } catch {
    mp4Failed = true;
  }
  return { files, mp4Failed };
}

/** Saves a blob through a temporary link. */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
