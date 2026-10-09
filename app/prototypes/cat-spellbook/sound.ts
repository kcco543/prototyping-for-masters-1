/**
 * Music-box sounds with Tone.js.
 *
 * - Sound is OFF by default. Tone.js is only loaded (dynamic import) the
 *   first time the user switches sound on, so no audio is created before a
 *   user interaction (browsers require that anyway).
 * - Every note comes from a pentatonic scale (C D E G A): any combination
 *   of these notes sounds pleasant, like a music box or wind chimes.
 * - Each brush has its own instrument, and the note's pitch follows how
 *   high on the page you are drawing.
 */

import type { BrushId } from "./brushes";

type ToneModule = typeof import("tone");
type Voice = { triggerAttackRelease: (note: string, duration: number | string, time?: number, velocity?: number) => unknown };

const SCALE = ["C", "D", "E", "G", "A"];

/** Each brush: which octave it starts in, note length, and the quietest gap between notes (ms) */
const VOICING: Record<BrushId, { octave: number; length: number; gap: number }> = {
  quill: { octave: 4, length: 0.25, gap: 130 },
  paw: { octave: 2, length: 0.15, gap: 90 },
  yarn: { octave: 3, length: 0.7, gap: 260 },
  stardust: { octave: 5, length: 0.3, gap: 110 },
  tail: { octave: 3, length: 0.35, gap: 200 },
};

let Tone: ToneModule | null = null;
let voices: Record<BrushId, Voice> | null = null;
let enabled = false;
const lastPlayed: Partial<Record<BrushId, number>> = {};

/** Turn sound on or off. Must be called from a click/tap handler. */
export async function setSoundEnabled(on: boolean) {
  enabled = on;
  if (!on) {
    if (Tone) Tone.getDestination().mute = true;
    return;
  }
  if (!Tone) {
    Tone = await import("tone");
    await Tone.start(); // unlock audio (needs the user gesture)

    // everything passes through a soft reverb at a low volume
    const reverb = new Tone.Reverb({ decay: 3.5, wet: 0.4 }).toDestination();
    const out = new Tone.Volume(-18).connect(reverb);

    voices = {
      // quill: a plain, bright music-box pluck
      quill: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.004, decay: 0.3, sustain: 0, release: 0.7 },
      }).connect(out),
      // paw: a soft, low "thup"
      paw: new Tone.MembraneSynth({
        pitchDecay: 0.02,
        octaves: 1.6,
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.15 },
        volume: -4,
      }).connect(out),
      // yarn: slow, woolly and warm
      yarn: new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2,
        envelope: { attack: 0.12, decay: 0.4, sustain: 0.25, release: 1.1 },
        volume: 2,
      }).connect(out),
      // stardust: a tiny glassy bell
      stardust: new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 7,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.9 },
        modulationEnvelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 },
        volume: -8,
      }).connect(out),
      // tail: one voice that slides between notes, a bit like a meow
      tail: new Tone.Synth({
        oscillator: { type: "sine" },
        portamento: 0.14,
        envelope: { attack: 0.03, decay: 0.25, sustain: 0.3, release: 0.6 },
        volume: -2,
      }).connect(out),
    };
  }
  Tone.getDestination().mute = false;
}

/** yNorm: 0 = top of the page (high notes) … 1 = bottom (low notes) */
function noteFor(brush: BrushId, yNorm: number) {
  const steps = Math.max(0, Math.min(9, Math.floor((1 - yNorm) * 10))); // two octaves of the scale
  return SCALE[steps % 5] + (VOICING[brush].octave + Math.floor(steps / 5));
}

/** Play a note for a drawing gesture (rate-limited per brush so it stays gentle). */
export function playGesture(brush: BrushId, yNorm: number) {
  if (!enabled || !voices || !Tone) return;
  const now = performance.now();
  const v = VOICING[brush];
  if (now - (lastPlayed[brush] ?? 0) < v.gap) return;
  lastPlayed[brush] = now;
  voices[brush].triggerAttackRelease(noteFor(brush, yNorm), v.length, undefined, 0.5 + Math.random() * 0.3);
}

/** A cat tapping a star: one small bell */
export function playChime(yNorm: number) {
  if (!enabled || !voices) return;
  voices.stardust.triggerAttackRelease(noteFor("stardust", yNorm), 0.4, undefined, 0.5);
}

/** Cast a Spell: a rising arpeggio */
export function playSpell() {
  if (!enabled || !voices || !Tone) return;
  const t = Tone.now();
  ["C5", "E5", "G5", "A5", "C6", "E6"].forEach((n, i) => voices!.stardust.triggerAttackRelease(n, 0.6, t + i * 0.11, 0.6));
  ["C3", "G3"].forEach((n, i) => voices!.yarn.triggerAttackRelease(n, 1.6, t + i * 0.2, 0.5));
}
