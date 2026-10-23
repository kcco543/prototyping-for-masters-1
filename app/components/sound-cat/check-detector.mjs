/**
 * Sound-Sensitive Cat — a quick check of the cat's hearing, without a microphone.
 *
 * It makes up sounds (a quiet room, talking, shouting, claps, typing…), feeds
 * them through detector.ts exactly the way the browser does, and checks that
 * the cat reacts the right way to each one.
 *
 * Run it from the project's top folder after changing DEFAULT_SOUND_SETTINGS:
 *
 *   node app/components/sound-cat/check-detector.mjs
 *
 * Each line says PASS or FAIL, followed by what the cat did and when.
 * (Node may print a warning about "MODULE_TYPELESS_PACKAGE_JSON". That's
 * harmless: it's Node reading a TypeScript file directly.)
 *
 * Made-up sounds are tidier than real ones, so passing here is a good sign,
 * not a guarantee. Always try your changes with a real microphone too.
 */

import { createDetector } from "./detector.ts";

const RATE = 48000; // samples per second, like most microphones
const WINDOW = 2048; // the same batch size as listener.ts
const FRAME_MS = 1000 / 60; // one batch per animation frame

// A repeatable "random" noise, so every run gives the same result
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const fromDb = (db) => 10 ** (db / 20);

/* ---------- Ingredients: each is a function from time (seconds) to one sample ---------- */

const quietRoom = (db = -60) => () => noise() * fromDb(db) * 1.7;
const clap = (at, peakDb = -8) => (t) => {
  const x = t - at;
  return x < 0 || x > 0.4 ? 0 : noise() * fromDb(peakDb) * (Math.exp(-x / 0.006) + 0.04 * Math.exp(-x / 0.08));
};
const talking = (from, to, db) => (t) => {
  if (t < from || t > to) return 0;
  const syllables = Math.max(0, Math.sin(Math.PI * (t - from) * 4.5)) ** 0.6;
  const voice = Math.sin(2 * Math.PI * 150 * t) + 0.6 * Math.sin(2 * Math.PI * 300 * t) + 0.4 * Math.sin(2 * Math.PI * 450 * t) + 0.3 * noise();
  return voice * syllables * fromDb(db) * 1.15;
};
const steadyNoise = (from, to, db) => (t) => (t >= from && t <= to ? noise() * fromDb(db) * 1.7 : 0);
const typing = (from, keys) => (t) => {
  let sample = 0;
  for (let i = 0; i < keys; i++) {
    const x = t - (from + i * 0.19 + (((i * 37) % 11) / 11) * 0.09);
    if (x >= 0 && x < 0.05) sample += noise() * fromDb(-24) * Math.exp(-x / 0.0025);
  }
  return sample;
};
const mix = (...parts) => (t) => parts.reduce((sum, part) => sum + part(t), 0);

/* ---------- Running one scenario ---------- */

function check(name, seconds, sound, passes) {
  seed = 7;
  const samples = new Float32Array(Math.ceil(seconds * RATE));
  for (let i = 0; i < samples.length; i++) samples[i] = sound(i / RATE);

  const detector = createDetector();
  const story = [];
  let fireworks = 0;
  for (let now = 0; now < seconds * 1000; now += FRAME_MS) {
    const end = Math.floor((now / 1000) * RATE);
    if (end < WINDOW) continue;
    const heard = detector.update(now, samples.subarray(end - WINDOW, end));
    if (heard.changed) story.push(`${(now / 1000).toFixed(1)}s ${heard.reaction}`);
    if (heard.fireworks) fireworks++;
  }
  const reactions = story.map((step) => step.split(" ")[1]);
  const ok = passes(reactions, fireworks);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  console.log(`      ${story.join(" → ") || "(no reaction)"}${fireworks ? `   [fireworks ×${fireworks}]` : ""}`);
  return ok;
}

// Calibration takes the first 1.5 s, so every sound starts after this
const S = 2.5;
const has = (list, reaction) => list.includes(reaction);

const results = [
  check("1. Silence: the cat stays idle", 8, quietRoom(), (r, f) => r.length === 0 && f === 0),
  check("2. Quiet talking: curious, then idle again", 8, mix(quietRoom(), talking(S, S + 2.5, -40)), (r, f) => r.join() === "curious,idle" && f === 0),
  check("3. Loud talking: startled once", 10, mix(quietRoom(), talking(S, S + 4, -16)), (r, f) => r.filter((x) => x === "startled").length === 1 && f === 0),
  check("4. Two quick claps: fireworks", 7, mix(quietRoom(), clap(S), clap(S + 0.4)), (r, f) => f === 1 && !has(r, "startled")),
  check("5. One clap: no fireworks", 7, mix(quietRoom(), clap(S)), (r, f) => f === 0 && !has(r, "startled")),
  check("6. Two claps 1.6 s apart: no fireworks", 8, mix(quietRoom(), clap(S), clap(S + 1.6)), (r, f) => f === 0),
  check("7. Three claps: fireworks only once", 8, mix(quietRoom(), clap(S), clap(S + 0.35), clap(S + 0.7)), (r, f) => f === 1),
  check("8. A fan running for 30 s: no startles, the cat gets used to it", 34, mix(quietRoom(), steadyNoise(S, S + 31, -42)), (r, f) => !has(r, "startled") && f === 0 && r[r.length - 1] === "idle"),
  check("9. A shout, then two claps: startled, later fireworks", 12, mix(quietRoom(), talking(S, S + 1.2, -14), clap(S + 6), clap(S + 6.4)), (r, f) => has(r, "startled") && f === 1),
  check("10. Two claps while someone talks quietly: fireworks", 9, mix(quietRoom(), talking(S, S + 4, -42), clap(S + 1.5), clap(S + 1.9)), (r, f) => f === 1),
  check("11. Noisy room: normal talking is only curious", 9, mix(quietRoom(-45), talking(S, S + 4, -28)), (r, f) => has(r, "curious") && !has(r, "startled") && f === 0),
  check("12. Noisy room: two claps still work", 7, mix(quietRoom(-45), clap(S, -10), clap(S + 0.45, -10)), (r, f) => f === 1),
  check("13. Quiet microphone: soft claps still work", 7, mix(quietRoom(-72), clap(S, -24), clap(S + 0.5, -24)), (r, f) => f === 1),
  check("14. A door slam: no fireworks", 8, mix(quietRoom(), (t) => (t < S || t > S + 1 ? 0 : noise() * fromDb(-6) * Math.exp(-(t - S) / 0.12))), (r, f) => f === 0),
  check("15. Typing on a keyboard: no fireworks", 9, mix(quietRoom(), typing(S, 26)), (r, f) => f === 0),
];

console.log(`\n${results.filter(Boolean).length} of ${results.length} passed`);
