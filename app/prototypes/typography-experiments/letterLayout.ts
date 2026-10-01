/**
 * Where each letter goes, for each type treatment.
 *
 * (Named letterLayout.ts, not layout.ts: in the Next.js App Router, a file
 * called layout.ts inside a route folder is treated as that page's layout
 * component.)
 *
 * Letters are measured once at 100px (`widths100`), so their width at any
 * font size F is simply width × F / 100. From that we pick the biggest font
 * size that still fits the poster, and work out every letter's resting spot.
 *
 * Animated parts (the ring turning, the wave rippling) are added each frame
 * in page.tsx; this file only computes the still "base" layout.
 */

export type Mode = "circle" | "skew" | "wave";

export type Item = {
  ch: string;
  /** width at the chosen font size */
  w: number;
  /** base position (centre of the letter), relative to the poster */
  x: number;
  y: number;
  /** which line it's on (wave / skew) */
  line: number;
  /** angle around the ring, in radians (circle) */
  theta: number;
};

export type Layout = {
  mode: Mode;
  /** font size in px */
  F: number;
  items: Item[];
  cx: number;
  cy: number;
  /** ring radius (circle) */
  r: number;
  lines: number;
};

/** Split the text into lines no wider than maxW (at font size F). */
function wrap(chars: string[], widths100: number[], F: number, maxW: number) {
  const k = F / 100;
  const lines: number[][] = [];
  let line: number[] = [];
  let lineW = 0;
  let word: number[] = [];
  let wordW = 0;
  const flushWord = () => {
    if (!word.length) return;
    if (line.length && lineW + wordW > maxW) {
      // drop the trailing space of the full line, start a new line
      while (line.length && chars[line[line.length - 1]] === " ") line.pop();
      lines.push(line);
      line = [];
      lineW = 0;
    }
    line.push(...word);
    lineW += wordW;
    word = [];
    wordW = 0;
  };
  chars.forEach((ch, i) => {
    if (ch === " ") {
      flushWord();
      if (line.length) {
        line.push(i);
        lineW += widths100[i] * k;
      }
    } else {
      word.push(i);
      wordW += widths100[i] * k;
    }
  });
  flushWord();
  while (line.length && chars[line[line.length - 1]] === " ") line.pop();
  if (line.length) lines.push(line);
  const widest = Math.max(0, ...lines.map((l) => l.reduce((s, i) => s + widths100[i] * k, 0)));
  return { lines, widest };
}

export function computeLayout(mode: Mode, chars: string[], widths100: number[], W: number, H: number): Layout {
  const cx = W / 2;
  const cy = H / 2;
  const items: Item[] = chars.map((ch) => ({ ch, w: 0, x: cx, y: cy, line: 0, theta: 0 }));

  if (mode === "circle") {
    // The sentence runs round a ring, starting at the top, going clockwise.
    const r = Math.min(W, H) * 0.36;
    const total100 = widths100.reduce((a, b) => a + b, 0) || 1;
    const Fmax = r * 0.42;
    const F = Math.min(Fmax, ((2 * Math.PI * r * 0.9) / total100) * 100);
    const k = F / 100;
    const used = total100 * k;
    // short sentences get extra letter-spacing so they still go all the way round
    const gap = Math.max(0, (2 * Math.PI * r - used) / chars.length);
    let arc = 0;
    chars.forEach((ch, i) => {
      const w = widths100[i] * k;
      const mid = arc + w / 2 + gap / 2;
      const theta = -Math.PI / 2 + mid / r;
      items[i] = { ch, w, x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta), line: 0, theta };
      arc += w + gap;
    });
    return { mode, F, items, cx, cy, r, lines: 1 };
  }

  // wave and skew: big centred lines, like a poster headline
  const maxW = W * (mode === "skew" ? 0.8 : 0.86);
  const maxH = H * (mode === "skew" ? 0.62 : 0.66);
  const lineHeight = mode === "skew" ? 0.92 : 1.05;
  let F = Math.min(H * 0.32, W * 0.3);
  let wrapped = wrap(chars, widths100, F, maxW);
  for (let i = 0; i < 60; i++) {
    const fits = wrapped.widest <= maxW && wrapped.lines.length * F * lineHeight <= maxH;
    if (fits) break;
    F *= 0.94;
    wrapped = wrap(chars, widths100, F, maxW);
  }
  const k = F / 100;
  const n = wrapped.lines.length;
  const blockTop = cy - (n * F * lineHeight) / 2 + (F * lineHeight) / 2;
  wrapped.lines.forEach((line, li) => {
    const lineW = line.reduce((s, i) => s + widths100[i] * k, 0);
    let x = cx - lineW / 2;
    for (const i of line) {
      const w = widths100[i] * k;
      items[i] = { ch: chars[i], w, x: x + w / 2, y: blockTop + li * F * lineHeight, line: li, theta: 0 };
      x += w;
    }
  });
  // spaces that were dropped at line ends: hide them off to the side
  const placed = new Set(wrapped.lines.flat());
  chars.forEach((ch, i) => {
    if (!placed.has(i)) items[i] = { ch, w: 0, x: -9999, y: -9999, line: 0, theta: 0 };
  });
  return { mode, F, items, cx, cy, r: 0, lines: n };
}
