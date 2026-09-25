/**
 * Tiny synthesized sounds (Web Audio API, no audio files).
 * - tick:  a soft click each time the font changes
 * - spell: a rising, sparkly arpeggio for the reveal
 * Browsers only allow sound after a click/key press, so `unlock()` is
 * called from those handlers.
 */

let ctx: AudioContext | null = null;
let muted = false;

export function unlock() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function setMuted(value: boolean) {
  muted = value;
}

function note(freq: number, start: number, dur: number, vol: number, type: OscillatorType = "triangle") {
  if (!ctx || muted || ctx.state !== "running") return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function tick() {
  note(1400, 0, 0.05, 0.05, "sine");
}

export function spell() {
  // C major arpeggio climbing up, then a shimmer of high notes
  [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => note(f, i * 0.09, 0.6, 0.12));
  for (let i = 0; i < 8; i++) note(2000 + Math.random() * 2500, 0.6 + i * 0.05, 0.25, 0.04, "sine");
}
