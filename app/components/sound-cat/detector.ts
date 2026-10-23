/**
 * Sound-Sensitive Cat — the cat's "ears".
 *
 * This file turns raw microphone samples into one of four reactions:
 *
 *   magic     two quick claps             → fireworks          (most important)
 *   startled  a loud sound that keeps going → puffed-up cat
 *   curious   a quiet sound                → ears up, comes closer
 *   idle      silence                      → normal cat         (least important)
 *
 * There is no microphone, React or drawing code in here, only arithmetic.
 * That keeps the rules in one place, and it means they can be tested with
 * made-up sounds (see README.md in this folder).
 *
 * HOW LOUDNESS IS MEASURED
 * The microphone gives us "samples": numbers between -1 and 1 that describe
 * the sound wave. The "root mean square" (RMS) of a batch of samples is a
 * good measure of how loud they are. We turn it into decibels (dB), where
 * 0 dB is the loudest possible sound and quieter sounds are negative
 * (a quiet room is roughly -60 dB, talking roughly -35 dB).
 *
 * Every room and every microphone is different, so the first moment after
 * switching on is spent listening to the room ("calibrating"). Every rule
 * below is then measured from that background level, not from a fixed number.
 */

export type Reaction = "idle" | "curious" | "startled" | "magic";

/* ---------- Tuning: every number the cat's hearing uses ---------- */

export type SoundSettings = {
  /** How long to listen to the room before reacting, in ms. */
  calibrationMs: number;

  // Audio smoothing: how quickly the measured level follows the sound.
  /** Rising: small = reacts quickly to a new sound. */
  attackMs: number;
  /** Falling: bigger = the level fades out more slowly after a sound. */
  releaseMs: number;

  // The background level keeps updating after calibration.
  /** How slowly it creeps up when the room gets noisier. The cat "gets used to" a fan or music this way. */
  floorRiseMs: number;
  /** How quickly it drops back when the room gets quieter. */
  floorFallMs: number;

  // Quiet sound sensitivity → curious cat.
  /** dB above the background that counts as "a sound". Lower = more sensitive. */
  quietAboveFloorDb: number;
  /** Hysteresis: the sound must drop this many dB further before it counts as gone. Stops flickering. */
  quietHysteresisDb: number;
  /** Never treat anything quieter than this (in dB) as a sound, however silent the room is. */
  quietMinDb: number;
  /** How long a sound must last before the cat notices it, in ms. */
  quietHoldMs: number;
  /** How long it must be quiet before the cat loses interest, in ms. */
  quietReleaseMs: number;

  // Loud sound threshold → startled cat.
  /** dB above the background that counts as loud. */
  loudAboveFloorDb: number;
  /** ...and never quieter than this, so normal talking in a silent room isn't "loud". */
  loudMinDb: number;
  /** How long it must stay loud, in ms. Claps are shorter than this, so they don't startle. */
  loudHoldMs: number;
  /** How long the cat stays puffed up, in ms. */
  startledMs: number;
  /** After calming down, how long before it can be startled again, in ms. */
  startledCooldownMs: number;

  // Clap detection sensitivity → magic fireworks.
  /** How sharply a clap must jump above the sound just before it, in dB. Lower = more sensitive. */
  clapRiseDb: number;
  /** A clap must also be this far above the background... */
  clapAboveFloorDb: number;
  /** ...and at least this loud. */
  clapMinDb: number;
  /** A clap is over once it has dropped this many dB from its peak. */
  clapDecayDb: number;
  /** ...and it must be over within this many ms. Longer means talking or a bang, not a clap. */
  clapMaxLengthMs: number;

  // Clap timing interval.
  /** Two peaks closer together than this are one clap (and its echo), in ms. */
  clapMinGapMs: number;
  /** Two claps further apart than this don't count as a pair, in ms. */
  clapMaxGapMs: number;
  /**
   * After the second clap, it must stay free of sharp sounds for this long,
   * in ms. Typing on a keyboard makes a steady stream of clicks that could
   * pass for claps; this is what tells the two apart.
   */
  clapQuietAfterMs: number;

  // Animation cooldowns.
  /** How long the fireworks (and the cat's magic gesture) last. Other reactions wait meanwhile. */
  fireworksMs: number;
  /** Extra wait after the fireworks before another double clap counts, in ms. */
  fireworksCooldownMs: number;
  /** The shortest time between two changes of mood, so the cat doesn't flicker, in ms. */
  minReactionMs: number;
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  calibrationMs: 1500,

  attackMs: 40,
  releaseMs: 300,

  floorRiseMs: 10000,
  floorFallMs: 2000,

  quietAboveFloorDb: 10,
  quietHysteresisDb: 4,
  quietMinDb: -66,
  quietHoldMs: 250,
  quietReleaseMs: 1500,

  loudAboveFloorDb: 26,
  loudMinDb: -30,
  loudHoldMs: 350,
  startledMs: 1300,
  startledCooldownMs: 3000,

  clapRiseDb: 18,
  clapAboveFloorDb: 24,
  clapMinDb: -36,
  clapDecayDb: 10,
  clapMaxLengthMs: 170,

  clapMinGapMs: 180,
  clapMaxGapMs: 1200,
  clapQuietAfterMs: 300,

  fireworksMs: 1800,
  fireworksCooldownMs: 1500,
  minReactionMs: 600,
};

/* ---------- Measuring ---------- */

/** Anything quieter than this is treated as total silence. */
const SILENCE_DB = -100;

/** How loud a stretch of samples is (root mean square), in dB. */
export function rmsDb(samples: Float32Array, from = 0, to = samples.length): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / Math.max(1, to - from));
  return Math.max(SILENCE_DB, 20 * Math.log10(rms + 1e-12));
}

/**
 * The loudest short slice of the samples, in dB.
 *
 * A clap is very short (a few thousandths of a second). Averaged over the
 * whole batch it would hardly register, so for claps we cut the batch into
 * short slices of `slice` samples (about 5 ms each) and use the loudest one.
 */
export function peakSliceDb(samples: Float32Array, slice = 256): number {
  let loudest = SILENCE_DB;
  for (let from = 0; from < samples.length; from += slice) {
    loudest = Math.max(loudest, rmsDb(samples, from, Math.min(samples.length, from + slice)));
  }
  return loudest;
}

/** Moves `current` towards `target`, covering most of the way in about `timeMs`. */
const ease = (current: number, target: number, dt: number, timeMs: number) => current + (target - current) * (1 - Math.exp(-dt / timeMs));

/* ---------- The detector ---------- */

export type Hearing = {
  /** The reaction the cat should show right now. */
  reaction: Reaction;
  /** True on the one update where the reaction changed. */
  changed: boolean;
  /** True on the one update where a double clap was heard (time for fireworks). */
  fireworks: boolean;
  /** True while still learning the room's background noise. */
  calibrating: boolean;
  /** The smoothed sound level, in dB. */
  levelDb: number;
  /** The background level, in dB (null while calibrating). */
  floorDb: number | null;
  /** 0 = background, 1 = loud: handy for drawing a level meter. */
  meter: number;
  /** What happened most recently, in words (for the debug readout). */
  note: string;
};

export function createDetector(overrides: Partial<SoundSettings> = {}) {
  const settings: SoundSettings = { ...DEFAULT_SOUND_SETTINGS, ...overrides };

  let startedAt: number | null = null;
  let lastTime: number | null = null;
  let calibration: number[] = [];
  let floor: number | null = null;
  let smooth = SILENCE_DB;

  let reaction: Reaction = "idle";
  let changedAt = 0;
  let note = "listening to the room";

  // quiet and loud timers (ms)
  let soundFor = 0;
  let silenceFor = 0;
  let loudFor = 0;
  /** A startle is only allowed again once the loud sound has stopped. */
  let loudArmed = true;
  let startledUntil = 0;
  let startledReadyAt = 0;
  let magicUntil = 0;
  let fireworksReadyAt = 0;

  // clap detection
  const recentPeaks: { time: number; db: number }[] = [];
  let clap: { start: number; max: number } | null = null;
  let firstClapAt: number | null = null;
  let lastClapAt = -Infinity;
  /** A pair has been heard: fireworks go off at this time, unless another sharp sound comes first. */
  let pairConfirmAt: number | null = null;
  /** After a long loud sound, wait for quiet before looking for claps again. */
  let clapsBlocked = false;

  /** Looks for short, sharp peaks. Returns true once a pair of claps is confirmed. */
  function hearClaps(now: number, peak: number, floorDb: number): boolean {
    // A pair heard a moment ago, and nothing sharp since: that's a double clap.
    if (pairConfirmAt !== null && now >= pairConfirmAt) {
      pairConfirmAt = null;
      return true;
    }

    // Keep the last 400 ms of peak levels: "what did it sound like just before?"
    recentPeaks.push({ time: now, db: peak });
    while (recentPeaks.length && recentPeaks[0].time < now - 400) recentPeaks.shift();

    if (firstClapAt !== null && now - firstClapAt > settings.clapMaxGapMs) firstClapAt = null; // too late for a pair

    if (clap) {
      // A possible clap is in progress: is it over yet, and was it short?
      clap.max = Math.max(clap.max, peak);
      if (peak < clap.max - settings.clapDecayDb) {
        const start = clap.start;
        clap = null;
        lastClapAt = start;
        if (firstClapAt !== null && start - firstClapAt >= settings.clapMinGapMs) {
          // The second clap of a pair. Wait a moment to be sure it isn't typing.
          firstClapAt = null;
          pairConfirmAt = start + settings.clapQuietAfterMs;
          note = "two claps?";
          return false;
        }
        firstClapAt = start;
        note = "one clap";
      } else if (now - clap.start > settings.clapMaxLengthMs) {
        // Still going: a shout or a bang, not a clap
        clap = null;
        clapsBlocked = true;
      }
      return false;
    }

    // "Sharp" means much louder than the quietest moment 90 to 30 ms ago: the
    // sound just before it. (Looking further back would let the fading end of
    // a bang look like a new clap.)
    let before = Infinity;
    for (const { time, db } of recentPeaks) if (time >= now - 90 && time <= now - 30) before = Math.min(before, db);
    if (before === Infinity) return false;
    const sharp = peak - before >= settings.clapRiseDb;

    // Any sharp sound soon after a pair, even a softer one, means a stream of
    // clicks (like typing), not a double clap. The first 100 ms are skipped:
    // that is still the second clap itself, fading away.
    if (sharp && pairConfirmAt !== null && now - lastClapAt >= 100 && peak >= floorDb + settings.quietAboveFloorDb) {
      pairConfirmAt = null;
      firstClapAt = null;
      note = "too many clicks";
    }

    if (clapsBlocked || now - lastClapAt < settings.clapMinGapMs) return false;
    const loudEnough = peak >= Math.max(floorDb + settings.clapAboveFloorDb, settings.clapMinDb);
    if (sharp && loudEnough) clap = { start: now, max: peak };
    return false;
  }

  /**
   * Feed one batch of samples. Call this on every animation frame.
   * `now` is the time in ms. `canReact` is false while the cat is busy with
   * something else (like a click animation): new moods then wait, though
   * fireworks still happen.
   */
  function update(now: number, samples: Float32Array, canReact = true): Hearing {
    const level = rmsDb(samples);
    const peak = peakSliceDb(samples);
    const dt = lastTime === null ? 16 : Math.min(100, Math.max(1, now - lastTime));
    lastTime = now;
    startedAt ??= now;

    // Smoothing: follow rising sounds quickly and falling ones more slowly
    smooth = ease(smooth, level, dt, level > smooth ? settings.attackMs : settings.releaseMs);

    const previous = reaction;
    const result = (fireworks = false): Hearing => {
      const changed = reaction !== previous;
      if (changed) changedAt = now;
      const loudLine = floor === null ? -20 : Math.max(floor + settings.loudAboveFloorDb, settings.loudMinDb);
      const meter = floor === null ? 0 : Math.min(1, Math.max(0, (smooth - floor) / (loudLine - floor)));
      return { reaction, changed, fireworks, calibrating: floor === null, levelDb: smooth, floorDb: floor, meter, note };
    };

    /* ----- 1. Calibration: learn the room's background noise ----- */
    if (floor === null) {
      calibration.push(level);
      if (now - startedAt < settings.calibrationMs) return result();
      // The middle value, so a single cough during calibration doesn't matter
      calibration.sort((a, b) => a - b);
      floor = calibration[Math.floor(calibration.length / 2)];
      calibration = [];
      smooth = floor;
      note = "listening";
      return result();
    }

    /* ----- 2. Keep the background level up to date ----- */
    floor = ease(floor, smooth, dt, smooth > floor ? settings.floorRiseMs : settings.floorFallMs);

    const quietOn = Math.max(floor + settings.quietAboveFloorDb, settings.quietMinDb);
    const quietOff = quietOn - settings.quietHysteresisDb;
    const loudOn = Math.max(floor + settings.loudAboveFloorDb, settings.loudMinDb);

    /* ----- 3. Timers: how long has it been quiet, sound, loud? ----- */
    // Talking has little gaps between syllables. So instead of starting again
    // at every gap, the "sound" and "loud" timers drain slowly while it's
    // quieter, and only empty completely after a proper pause.
    if (smooth >= quietOn) {
      soundFor += dt;
      silenceFor = 0;
    } else {
      soundFor = Math.max(0, soundFor - dt * 0.5);
      if (smooth < quietOff) silenceFor += dt;
    }
    if (smooth >= loudOn) loudFor += dt;
    else loudFor = Math.max(0, loudFor - dt * 0.5);
    if (silenceFor > 400) soundFor = loudFor = 0;
    if (smooth < loudOn - 8) loudArmed = true; // the loud sound is really over
    if (clapsBlocked && smooth < quietOn) clapsBlocked = false;

    const doubleClap = hearClaps(now, peak, floor);

    /* ----- 4. Choose the reaction, most important first ----- */
    if (reaction === "magic") {
      // Fireworks running: everything else waits until they're done
      if (now >= magicUntil) {
        reaction = "idle";
        soundFor = loudFor = 0; // the claps themselves shouldn't count as a new sound
        loudArmed = false;
        note = "fireworks done";
      }
    } else if (doubleClap && now >= fireworksReadyAt) {
      reaction = "magic";
      magicUntil = now + settings.fireworksMs;
      fireworksReadyAt = magicUntil + settings.fireworksCooldownMs;
      note = "double clap!";
      return result(true);
    } else if (reaction === "startled") {
      if (now >= startledUntil) {
        reaction = "idle";
        startledReadyAt = now + settings.startledCooldownMs;
        loudArmed = false;
        note = "calming down";
      }
    } else if (canReact && loudArmed && loudFor >= settings.loudHoldMs && now >= startledReadyAt) {
      reaction = "startled";
      startledUntil = now + settings.startledMs;
      note = "loud sound";
    } else if (reaction === "curious") {
      if (silenceFor >= settings.quietReleaseMs) {
        reaction = "idle";
        note = "quiet again";
      }
    } else if (canReact && soundFor >= settings.quietHoldMs && now - changedAt >= settings.minReactionMs) {
      reaction = "curious";
      note = "a sound";
    }

    return result();
  }

  /** Forget the current mood (for example when the page is hidden). The background level is kept. */
  function calmDown() {
    reaction = "idle";
    soundFor = silenceFor = loudFor = 0;
    clap = null;
    firstClapAt = null;
    pairConfirmAt = null;
    lastTime = null;
    recentPeaks.length = 0;
  }

  return { settings, update, calmDown };
}

export type Detector = ReturnType<typeof createDetector>;
