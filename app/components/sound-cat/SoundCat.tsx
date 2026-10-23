"use client";

/**
 * Sound-Sensitive Cat — the microphone button.
 *
 * This sits next to the cat that listens (the black cat in the cat lounge)
 * and does three jobs:
 *
 *   1. The button. The microphone is OFF until you click it. Clicking asks
 *      the browser for permission; clicking again switches it off.
 *   2. Messages. A small speech bubble explains what's happening, or what
 *      went wrong ("the microphone is blocked…"), without breaking anything.
 *   3. Passing on what the cat hears. On every frame `listener.ts` reports
 *      the sound level and the cat's reaction. The level makes the button's
 *      ring glow; the reaction goes to the cat (`onReaction`); a double clap
 *      sets off the fireworks (and one meow).
 *
 * TUNING: every sensitivity number lives in `detector.ts`
 * (DEFAULT_SOUND_SETTINGS). To see the live numbers while you tune them, add
 * `?sound-debug` to the page address, e.g. http://localhost:3000/?sound-debug
 */

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Reaction } from "./detector";
import { burstFireworks } from "./fireworks";
import { MicError, startListening, type Listening, type MicProblem } from "./listener";
import { meow } from "./meow";
import styles from "./SoundCat.module.css";

/** Play one short meow with the fireworks. Set to false for silent fireworks. */
const MEOW_WITH_FIREWORKS = true;

/** How long the friendly messages stay up, in ms. */
const MESSAGE_MS = 6000;

type Status = "off" | "asking" | "calibrating" | "listening" | MicProblem | "lost";

/** What the bubble says. Problems keep the rest of the page working: only the listening is off. */
const MESSAGES: Partial<Record<Status, string>> = {
  asking: "May I listen? Your browser will ask first.",
  calibrating: "Shh… learning what your room sounds like.",
  listening: "I'm listening! Whisper, make a loud noise, or clap twice.",
  denied: "I can't hear you: the microphone is blocked for this page. You can allow it in your browser's site settings.",
  unsupported: "This browser can't share a microphone with me. Everything else still works!",
  insecure: "Microphones only work on secure (https) pages.",
  missing: "I couldn't find a microphone.",
  busy: "Another app is using the microphone right now.",
  failed: "The microphone didn't start. Try again?",
  lost: "The microphone went away, so I stopped listening.",
};

type Props = {
  /** The listening cat. The fireworks start from it. */
  cat: RefObject<HTMLElement | null>;
  /** True while the cat is busy with something else (like its click animation). */
  isBusy: () => boolean;
  /** Called whenever the cat's reaction changes. */
  onReaction: (reaction: Reaction) => void;
};

export function SoundCat({ cat, isBusy, onReaction }: Props) {
  const [status, setStatus] = useState<Status>("off");
  const [message, setMessage] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);

  const button = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bubble = useRef<HTMLParagraphElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const listening = useRef<Listening | null>(null);
  const stopFireworks = useRef<(() => void) | null>(null);
  const hideMessage = useRef<number | undefined>(undefined);
  /** False once the page has been left (the permission question may still have been open). */
  const mounted = useRef(true);

  // The latest props, for code that runs on every frame (so it never uses old ones)
  const latest = useRef({ cat, isBusy, onReaction });
  latest.current = { cat, isBusy, onReaction };

  /** Shows a message in the bubble. Errors and the "I'm listening" note fade after a while. */
  const say = (text: string | null, fade = true) => {
    window.clearTimeout(hideMessage.current);
    setMessage(text);
    if (text && fade) hideMessage.current = window.setTimeout(() => setMessage(null), MESSAGE_MS);
  };

  // The bubble opens to the right of the button. On a narrow screen that could
  // run off the edge, so when a message appears, slide it left just enough to fit.
  // (offsetWidth is used because it ignores the bubble's pop-in animation.)
  useLayoutEffect(() => {
    const element = bubble.current;
    if (!element) return;
    element.style.marginLeft = "";
    if (!message) return;
    const overflow = element.getBoundingClientRect().left + element.offsetWidth - (document.documentElement.clientWidth - 8);
    if (overflow > 0) element.style.marginLeft = `${-overflow}px`;
  }, [message]);

  // The debug readout is switched on from the address bar: ?sound-debug
  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("sound-debug"));
  }, []);

  /** Switches everything off: microphone, fireworks, and the cat goes back to normal. */
  const stop = () => {
    listening.current?.stop();
    listening.current = null;
    stopFireworks.current?.();
    button.current?.style.setProperty("--level", "0");
    latest.current.onReaction("idle");
  };

  // Leaving the page: never leave the microphone on
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      listening.current?.stop();
      listening.current = null;
      stopFireworks.current?.();
      window.clearTimeout(hideMessage.current);
    };
  }, []);

  /** A double clap: fireworks from the cat, plus one meow. */
  const fireworks = (context: AudioContext) => {
    const from = latest.current.cat.current?.getBoundingClientRect();
    if (!canvas.current || !from) return;
    stopFireworks.current?.();
    stopFireworks.current = burstFireworks(canvas.current, {
      x: from.left + from.width / 2,
      y: from.top + from.height * 0.3,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    // Safe to make a sound: the visitor has clicked the microphone button
    if (MEOW_WITH_FIREWORKS) meow(context);
  };

  const toggle = async () => {
    if (status === "asking") return; // the browser's permission question is still open
    if (listening.current) {
      stop();
      setStatus("off");
      say(null);
      return;
    }

    setStatus("asking");
    say(MESSAGES.asking ?? null, false);
    let calibrating = true;
    let frames = 0;

    try {
      const started = await startListening({
        canReact: () => !latest.current.isBusy(),
        onLost: () => {
          listening.current = null;
          stop();
          setStatus("lost");
          say(MESSAGES.lost ?? null);
        },
        onHear: (hearing) => {
          // The ring around the button glows with the sound level
          button.current?.style.setProperty("--level", hearing.meter.toFixed(2));

          if (calibrating && !hearing.calibrating) {
            calibrating = false;
            setStatus("listening");
            say(MESSAGES.listening ?? null);
          }
          if (hearing.changed) latest.current.onReaction(hearing.reaction);
          if (hearing.fireworks && listening.current) fireworks(listening.current.context);

          if (readout.current && ++frames % 6 === 0) {
            const floor = hearing.floorDb === null ? "…" : hearing.floorDb.toFixed(0);
            readout.current.textContent = `level ${hearing.levelDb.toFixed(0)} dB · room ${floor} dB · ${hearing.reaction} · ${hearing.note}`;
          }
        },
      });
      if (!mounted.current) {
        started.stop(); // the page was left while the browser was asking
        return;
      }
      listening.current = started;
      setStatus("calibrating");
      say(MESSAGES.calibrating ?? null, false);
    } catch (error) {
      const problem = error instanceof MicError ? error.problem : "failed";
      setStatus(problem);
      say(MESSAGES[problem] ?? null);
    }
  };

  const on = status === "calibrating" || status === "listening";

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`${styles.mic} ${on ? styles.micOn : ""} ${status === "calibrating" ? styles.micCalibrating : ""}`}
        onClick={toggle}
        aria-pressed={on}
        aria-label={on ? "Stop letting the black cat listen" : "Let the black cat listen through your microphone"}
        title={on ? "Stop listening" : "Let the cat listen"}
      >
        <svg className={styles.micIcon} viewBox="0 0 24 24" aria-hidden="true">
          {/* a little old-fashioned microphone on a stand */}
          <rect className={styles.micHead} x="8.5" y="2.5" width="7" height="12" rx="3.5" />
          <path className={styles.micStand} d="M5.5 11.5 a6.5 6.5 0 0 0 13 0 M12 18 v3.5 M8.5 21.5 h7" />
          {!on && <path className={styles.micSlash} d="M4 4 L20 20" />}
        </svg>
      </button>

      {/* Read out by screen readers whenever it changes */}
      <p ref={bubble} className={`${styles.bubble} ${message ? styles.bubbleShown : ""}`} role="status">
        {message}
      </p>

      {debug && on && <span ref={readout} className={styles.readout} />}

      {/* The fireworks are drawn here. It covers the screen but can't be clicked. */}
      <canvas ref={canvas} className={styles.fireworks} aria-hidden="true" />
    </>
  );
}
