/**
 * Sound effects for "The Tower", made with the Web Audio API.
 *
 * Instead of loading audio files, each sound is built from simple
 * oscillators (tones) and noise, the way an old synthesizer works:
 * - meow:  a buzzy tone whose pitch and "vowel" filter slide up then down
 *          ("mee-ow"), with a little wobble (vibrato)
 * - catch: a quick rising "pop"
 * - crash: a burst of noise plus a few high porcelain "tinks"
 * - rattle: tiny clicks when a cup starts to wobble
 *
 * Browsers only allow sound after the user interacts with the page, so
 * `unlockAudio()` is called from the "Let's play" button click.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function setMuted(value: boolean) {
  muted = value;
  if (master) master.gain.value = value ? 0 : 0.8;
}

function ready() {
  return ctx && master && !muted ? { ctx, master } : null;
}

/** One cat vocalisation. f0 → fPeak → fEnd are pitches in Hz. */
function meowAt(start: number, dur: number, f0: number, fPeak: number, fEnd: number, vol = 0.35) {
  const r = ready();
  if (!r) return;
  const { ctx, master } = r;
  const t = ctx.currentTime + start;

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.linearRampToValueAtTime(fPeak, t + dur * 0.35);
  osc.frequency.linearRampToValueAtTime(fEnd, t + dur);

  // vibrato: a slow oscillator gently wiggling the pitch
  const vib = ctx.createOscillator();
  vib.frequency.value = 7;
  const vibAmt = ctx.createGain();
  vibAmt.gain.value = 10;
  vib.connect(vibAmt).connect(osc.frequency);

  // the "vowel": a band-pass filter sliding from "ee" to "ah" to "ow"
  const vowel = ctx.createBiquadFilter();
  vowel.type = "bandpass";
  vowel.Q.value = 3;
  vowel.frequency.setValueAtTime(900, t);
  vowel.frequency.linearRampToValueAtTime(2200, t + dur * 0.35);
  vowel.frequency.linearRampToValueAtTime(1000, t + dur);

  const soften = ctx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 3600;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(vol, t + 0.04);
  env.gain.setValueAtTime(vol, t + dur * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(vowel).connect(soften).connect(env).connect(master);
  osc.start(t);
  vib.start(t);
  osc.stop(t + dur + 0.05);
  vib.stop(t + dur + 0.05);
}

/** Happy "mrrp! mrrp! meee-ow!" */
export function playMeow() {
  meowAt(0, 0.14, 650, 950, 900, 0.28);
  meowAt(0.18, 0.14, 700, 1050, 980, 0.28);
  meowAt(0.4, 0.75, 560, 1000, 620, 0.38);
}

export function playCatch() {
  const r = ready();
  if (!r) return;
  const { ctx, master } = r;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(1100, t + 0.09);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.3, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + 0.2);
}

export function playRattle() {
  const r = ready();
  if (!r) return;
  const { ctx, master } = r;
  for (let i = 0; i < 3; i++) {
    const t = ctx.currentTime + i * 0.06;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 1500 + Math.random() * 600;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.08, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    osc.connect(env).connect(master);
    osc.start(t);
    osc.stop(t + 0.05);
  }
}

export function playCrash() {
  const r = ready();
  if (!r) return;
  const { ctx, master } = r;
  const t = ctx.currentTime;

  // noise burst
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.5, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  noise.connect(hp).connect(env).connect(master);
  noise.start(t);

  // porcelain "tinks"
  for (let i = 0; i < 5; i++) {
    const s = t + Math.random() * 0.12;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 2400 + Math.random() * 2200;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.12, s);
    e.gain.exponentialRampToValueAtTime(0.0001, s + 0.18);
    osc.connect(e).connect(master);
    osc.start(s);
    osc.stop(s + 0.2);
  }
}
