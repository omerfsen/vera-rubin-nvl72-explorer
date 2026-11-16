// Records the browser tab to video with the screen-capture API. Everything
// stays on the visitor's machine: the files are saved locally, nothing is
// uploaded. WebM and MP4 are recorded side by side from the same stream.

export type VideoFormat = 'webm' | 'mp4';

const CANDIDATES: Record<VideoFormat, readonly string[]> = {
  webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
  mp4: ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'],
};

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
): Partial<Record<VideoFormat, string>> {
  const out: Partial<Record<VideoFormat, string>> = {};
  for (const f of Object.keys(CANDIDATES) as VideoFormat[]) {
    const type = CANDIDATES[f].find(isSupported);
    if (type) out[f] = type;
  }
  return out;
}

/** vr-nvl72-20261116-142530.webm */
export function recordingName(format: VideoFormat, at: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}`;
  return `vr-nvl72-${stamp}.${format}`;
}

export interface Recording {
  formats: VideoFormat[];
  /** Stops recording and resolves with one file per format. */
  stop(): Promise<{ format: VideoFormat; blob: Blob }[]>;
}

/**
 * Asks to capture the screen (the current tab is offered first), then records
 * it in every supported format. `onEnded` fires when the visitor stops
 * sharing from the browser's own bar.
 */
export async function startRecording(onEnded: () => void): Promise<Recording> {
  const types = supportedTypes();
  const formats = Object.keys(types) as VideoFormat[];
  if (formats.length === 0) throw new Error('no-format');
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: false,
    // Chrome hints: offer this tab first.
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
  } as DisplayMediaStreamOptions);
  const parts = formats.map((format) => {
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: types[format], videoBitsPerSecond: 8_000_000 });
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    const done = new Promise<{ format: VideoFormat; blob: Blob }>((resolve) => {
      rec.onstop = () => resolve({ format, blob: new Blob(chunks, { type: types[format] }) });
    });
    rec.start(1000);
    return { rec, done };
  });
  let stopped: Promise<{ format: VideoFormat; blob: Blob }[]> | null = null;
  const stop = () => {
    if (!stopped) {
      parts.forEach(({ rec }) => rec.state !== 'inactive' && rec.stop());
      stream.getTracks().forEach((t) => t.stop());
      stopped = Promise.all(parts.map((p) => p.done));
    }
    return stopped;
  };
  stream.getVideoTracks()[0]?.addEventListener('ended', onEnded);
  return { formats, stop };
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
