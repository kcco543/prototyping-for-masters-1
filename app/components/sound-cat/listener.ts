/**
 * Sound-Sensitive Cat — the microphone.
 *
 * This file connects the microphone to `detector.ts` using the Web Audio API:
 *
 *   microphone ──▶ MediaStreamSource ──▶ AnalyserNode
 *                                          │
 *        on every animation frame, read the newest samples
 *        (getFloatTimeDomainData) and hand them to the detector
 *
 * PRIVACY: the sound only ever travels from the microphone into the
 * AnalyserNode, inside this browser tab. It is never recorded, saved, sent
 * anywhere or played back (the analyser isn't even connected to the
 * speakers). Switching the feature off stops the microphone completely.
 */

import { createDetector, type Hearing, type SoundSettings } from "./detector";

/** Why the microphone couldn't start. Each one gets its own friendly message. */
export type MicProblem = "unsupported" | "insecure" | "denied" | "missing" | "busy" | "failed";

export class MicError extends Error {
  problem: MicProblem;
  constructor(problem: MicProblem) {
    super(problem);
    this.problem = problem;
  }
}

/** Turns the browser's error into one of our problems. */
function problemFrom(error: unknown): MicProblem {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "failed";
}

export type Listening = {
  /** The audio engine. Also used to play the meow, so no second one is needed. */
  context: AudioContext;
  /** Switch everything off: microphone, audio engine and the frame loop. */
  stop: () => void;
};

type Options = {
  settings?: Partial<SoundSettings>;
  /** Called on every frame with what the detector heard. */
  onHear: (hearing: Hearing) => void;
  /** Return false while the cat is busy with something else (it then won't start a new mood). */
  canReact?: () => boolean;
  /** Called if the microphone goes away by itself (unplugged, or permission taken back). */
  onLost?: () => void;
};

/**
 * Asks for the microphone and starts listening.
 *
 * Call this straight from a click: browsers only let a page start an audio
 * engine in response to something the visitor did. If anything goes wrong
 * it throws a `MicError` saying why.
 */
export async function startListening({ settings, onHear, canReact = () => true, onLost }: Options): Promise<Listening> {
  if (typeof window === "undefined" || !("AudioContext" in window)) throw new MicError("unsupported");
  // Browsers only offer the microphone to secure (https or localhost) pages
  if (!window.isSecureContext) throw new MicError("insecure");
  if (!navigator.mediaDevices?.getUserMedia) throw new MicError("unsupported");

  // Created right away, while we still "count" as a click (see above).
  const context = new AudioContext();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // Turn off the browser's automatic voice processing. It is made for
        // video calls: it keeps changing the volume and filters out sharp
        // noises, which would hide claps and confuse the calibration.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  } catch (error) {
    context.close();
    throw new MicError(problemFrom(error));
  }

  // While the permission prompt was open the engine may have gone to sleep
  if (context.state === "suspended") await context.resume().catch(() => {});

  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  // 2048 samples ≈ 43 ms of sound: a little more than one animation frame,
  // so nothing falls between two readings even if frames are slow.
  analyser.fftSize = 2048;
  source.connect(analyser); // NOT connected to the speakers: we only measure
  const samples = new Float32Array(analyser.fftSize);

  const detector = createDetector(settings);
  let frame = 0;

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    analyser.getFloatTimeDomainData(samples);
    onHear(detector.update(now, samples, canReact()));
  };
  frame = requestAnimationFrame(tick);

  // When the tab is hidden, animation frames stop by themselves. Also put the
  // audio engine to sleep, and let the cat calm down while nobody is watching.
  const onVisibility = () => {
    if (document.hidden) {
      context.suspend().catch(() => {});
      detector.calmDown();
    } else {
      context.resume().catch(() => {});
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    document.removeEventListener("visibilitychange", onVisibility);
    source.disconnect();
    analyser.disconnect();
    // Stopping every track is what turns off the browser's "microphone in use" light
    stream.getTracks().forEach((track) => track.stop());
    context.close().catch(() => {});
  };

  // If the microphone is unplugged (or blocked from the address bar), stop politely
  stream.getTracks().forEach((track) =>
    track.addEventListener("ended", () => {
      stop();
      onLost?.();
    }),
  );

  return { context, stop };
}
