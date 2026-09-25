"use client";

/**
 * Wheel of Fortune — ask the cat a silent question.
 *
 * Phases:
 *   idle      → the cat plays with its yarn; its eyes follow your pointer
 *   swat      → you clicked: the paw bats the ball
 *   writing   → the ball rolls out, unravelling; the thread spells the answer
 *   answered  → the answer is written; you can ask another question
 *   rewinding → the yarn winds itself back up into the ball
 *
 * The unravelling works like this: thread.ts turns the answer into one long
 * continuous line made of many short segments. Every animation frame we
 * reveal the thread up to a certain distance (using stroke-dashoffset) and
 * move the ball to that exact point, spinning it and shrinking it as the
 * yarn is used up. This runs outside React (direct DOM updates) so it stays
 * smooth.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./styles.module.css";
import { caveat, instrumentSans } from "../../fonts";
import { ArtDefs, BALL_R, BALL_REST, Cat, EYES, LooseStrands, YARN, YARN_LIGHT, YarnBall } from "./art";
import { buildThread, pointAt, type Pt, type Thread } from "./thread";
import { pickAnswer } from "./answers";

type Phase = "idle" | "swat" | "writing" | "answered" | "rewinding";

const SWAT_MS = 320; // paw hits the ball this long after the click
const REWIND_MS = 1400;

/** Twinkling stars in the stage: [x %, y %, size, delay] */
const STARS: [number, number, number, number][] = [
  [6, 10, 14, 0], [93, 8, 10, 1.2], [88, 36, 14, 0.5], [4, 44, 10, 1.8],
  [12, 88, 12, 0.9], [94, 84, 12, 2.2], [50, 4, 8, 1.5], [70, 96, 8, 0.3],
];

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t); // gentle start and finish

export default function WheelOfFortune() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState<string>("");
  const [thread, setThread] = useState<Thread | null>(null);
  const [narrow, setNarrow] = useState(false);

  // Stage size: a taller, narrower stage on phones so the words stay big
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const W = narrow ? 620 : 1000;
  const H = narrow ? 980 : 760;
  const catScale = narrow ? 1 : 1.15;
  const cat: Pt = [W / 2 - (narrow ? 40 : 80), 290];
  const ballHome: Pt = [cat[0] + BALL_REST[0] * catScale, cat[1] + BALL_REST[1] * catScale];

  const layout = useMemo(
    () => ({ width: W, top: narrow ? 470 : 470, maxWidth: W - (narrow ? 60 : 110), maxLines: narrow ? 4 : 3, maxScale: narrow ? 0.1 : 0.11 }),
    [W, narrow],
  );

  /* ---------- refs for per-frame updates ---------- */
  const svgRef = useRef<SVGSVGElement>(null);
  const segRefs = useRef<(SVGPathElement | null)[]>([]);
  const plyRefs = useRef<(SVGPathElement | null)[]>([]);
  const ballRef = useRef<SVGGElement>(null);
  const spinRef = useRef<SVGGElement>(null);
  const pupilRefs = useRef<(SVGCircleElement | null)[]>([]);
  const look = useRef<Pt>([W / 2, H / 2]); // what the cat is looking at
  const ballState = useRef({ pos: ballHome, angle: 0, scale: 1 });
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** Place the ball: position, spin and size. */
  const placeBall = useCallback((pos: Pt, angle: number, scale: number) => {
    ballState.current = { pos, angle, scale };
    ballRef.current?.setAttribute("transform", `translate(${pos[0].toFixed(1)} ${pos[1].toFixed(1)})`);
    spinRef.current?.setAttribute("transform", `rotate(${angle.toFixed(1)}) scale(${(scale * catScale).toFixed(3)})`);
  }, [catScale]);

  /** Point the pupils at `look`. */
  const aimEyes = useCallback(() => {
    EYES.forEach(([ex, ey], i) => {
      const px = cat[0] + ex * catScale;
      const py = cat[1] + ey * catScale;
      const dx = look.current[0] - px;
      const dy = look.current[1] - py;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 120) * 7; // up to 7 units off-centre
      pupilRefs.current[i]?.setAttribute("cx", String(ex + (dx / d) * k));
      pupilRefs.current[i]?.setAttribute("cy", String(ey + (dy / d) * k));
    });
  }, [cat, catScale]);

  /** Reveal the thread up to distance `upTo`. Segments are revealed in order. */
  const reveal = useCallback((t: Thread, upTo: number) => {
    t.segments.forEach((seg, i) => {
      const el = segRefs.current[i];
      const ply = plyRefs.current[i];
      if (!el) return;
      const shown = Math.max(0, Math.min(seg.len, upTo - seg.start));
      if (shown <= 0) {
        el.style.opacity = "0";
      } else {
        el.style.opacity = "";
        el.style.strokeDashoffset = String(seg.len - shown);
      }
      // the lighter "ply" twist only appears on finished parts of the yarn
      if (ply) ply.style.opacity = shown >= seg.len ? "" : "0";
    });
  }, []);

  /* ---------- the animation loop ---------- */
  useEffect(() => {
    if (!thread || (phase !== "writing" && phase !== "rewinding")) return;
    let raf = 0;
    const startTime = performance.now();
    // writing speed: a little quicker for long answers, 5–9 seconds in total
    const duration = phase === "writing" ? Math.min(9000, Math.max(5000, thread.total * 1.6)) : REWIND_MS;
    let angle = ballState.current.angle;

    const frame = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const d = phase === "writing" ? ease(t) * thread.total : (1 - ease(t)) * thread.total;
      const { pt } = pointAt(thread, d);
      const prev = ballState.current.pos;
      const left = 1 - d / thread.total; // how much yarn is still on the ball
      const scale = 0.3 + 0.7 * Math.pow(left, 0.8);
      // roll: spin according to horizontal movement ÷ radius
      angle += ((pt[0] - prev[0]) / (BALL_R * scale * catScale)) * (180 / Math.PI);
      placeBall(pt, angle, scale);
      reveal(thread, d);
      look.current = pt;
      aimEyes();

      if (t < 1) raf = requestAnimationFrame(frame);
      else if (phase === "writing") setPhase("answered");
      else {
        setThread(null);
        placeBall(ballHome, angle, 1);
        setPhase("idle");
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, thread]);

  // New thread → hide it all before the first frame
  useEffect(() => {
    if (thread) reveal(thread, phase === "answered" ? thread.total : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread]);

  // Keep the ball at home when idle (and when the stage size changes)
  useEffect(() => {
    if (phase === "idle") placeBall(ballHome, ballState.current.angle, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, W]);

  /* ---------- interactions ---------- */

  const summon = () => {
    if (phase !== "idle") return;
    const next = pickAnswer(answer);
    setAnswer(next);
    setThread(buildThread(next, ballHome, layout));
    setPhase("swat");
    look.current = ballHome;
    aimEyes();
    timers.current.push(window.setTimeout(() => setPhase("writing"), SWAT_MS));
  };

  const askAgain = () => {
    if (phase === "answered") setPhase("rewinding");
  };

  // Eyes follow the pointer while the cat is waiting
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (phase !== "idle" && phase !== "answered") return;
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    look.current = [p.x, p.y];
    aimEyes();
  };

  const hint =
    phase === "idle"
      ? "…then tap the cat."
      : phase === "answered"
        ? "The yarn has spoken."
        : phase === "rewinding"
          ? "Winding the yarn back up…"
          : "The yarn is unravelling…";

  return (
    <div className={`${styles.container} ${instrumentSans.className} ${caveat.variable}`}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.backLink}>
          ← <span className={styles.backFull}>Jiaqi Yuan&apos;s prototypes</span>
          <span className={styles.backShort}>Home</span>
        </Link>
        <h1 className={styles.title}>Wheel of Fortune</h1>
        <span />
      </header>

      <main className={styles.stageCard}>
        <div className={styles.prompt}>
          <p className={styles.question}>Silently think of your question.</p>
          <p className={styles.hint} aria-live="polite">
            {hint}
          </p>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`${styles.stage} ${phase === "answered" ? styles.stageDone : ""}`}
          onPointerMove={onPointerMove}
        >
          <ArtDefs />

          {STARS.map(([x, y, s, delay], i) => (
            <path
              key={i}
              className={styles.star}
              style={{ animationDelay: `${delay}s` } as CSSProperties}
              transform={`translate(${(x / 100) * W} ${(y / 100) * H})`}
              d={`M0 ${-s} Q0 0 ${s} 0 Q0 0 0 ${s} Q0 0 ${-s} 0 Q0 0 0 ${-s}Z`}
              fill="#f2c230"
            />
          ))}

          {/* a soft glow behind the answer once it's written */}
          {phase === "answered" && thread && (
            <ellipse className={styles.glow} cx={W / 2} cy={layout.top + (thread.lines.length - 1) * 70 - 20} rx={W * 0.5} ry={80 + thread.lines.length * 70} fill="url(#glow)" />
          )}

          {/* the cat, as a big button */}
          <g
            transform={`translate(${cat[0]} ${cat[1]}) scale(${catScale})`}
            className={`${styles.catButton} ${phase === "idle" ? styles.catReady : ""}`}
            role="button"
            tabIndex={phase === "idle" ? 0 : -1}
            aria-label="The cat with its ball of yarn. Click to ask for your answer."
            aria-disabled={phase !== "idle"}
            onClick={summon}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                summon();
              }
            }}
          >
            {/* a generous invisible hit area */}
            <rect x={-190} y={-240} width={480} height={280} fill="transparent" />
            <LooseStrands />
            <Cat swatting={phase === "swat"} pupilRefs={pupilRefs} />
          </g>

          {/* the unravelled yarn */}
          {thread && (
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {thread.segments.map((seg, i) => (
                <path
                  key={`s${i}`}
                  ref={(el) => {
                    segRefs.current[i] = el;
                  }}
                  d={seg.d}
                  stroke={YARN}
                  strokeWidth={seg.kind === "slack" ? 1.8 : 3.4}
                  opacity={seg.kind === "slack" ? 0.7 : 1}
                  strokeDasharray={`${seg.len} ${seg.len + 20}`}
                  strokeDashoffset={seg.len}
                  style={{ opacity: 0 }}
                />
              ))}
              {/* a thin lighter twist on top, so it reads as yarn rather than ink */}
              {thread.segments.map((seg, i) =>
                seg.kind === "slack" ? null : (
                  <path
                    key={`p${i}`}
                    ref={(el) => {
                      plyRefs.current[i] = el;
                    }}
                    d={seg.d}
                    stroke={YARN_LIGHT}
                    strokeWidth={1.1}
                    strokeDasharray="2.5 5"
                    style={{ opacity: 0 }}
                  />
                ),
              )}
            </g>
          )}

          {/* the yarn ball (moved every frame by the animation) */}
          <g ref={ballRef} transform={`translate(${ballHome[0]} ${ballHome[1]})`} className={styles.ballWrap} aria-hidden="true">
            <g className={phase === "idle" ? styles.ballIdle : undefined}>
              <g ref={spinRef} transform={`scale(${catScale})`}>
                <YarnBall />
              </g>
            </g>
          </g>
        </svg>

        {/* The answer as real text, for screen readers */}
        <p className={styles.srOnly} aria-live="polite">
          {phase === "answered" ? `Your answer: ${answer}` : ""}
        </p>

        <div className={styles.controls}>
          {phase === "answered" ? (
            <button type="button" className={styles.againButton} onClick={askAgain} autoFocus>
              Ask another question
            </button>
          ) : (
            <span className={styles.controlsSpacer} />
          )}
        </div>
      </main>
    </div>
  );
}
