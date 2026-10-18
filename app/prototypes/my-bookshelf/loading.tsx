/**
 * A Constellation of Stories — shown while the books are being read from Notion.
 *
 * Next.js shows this file automatically while page.tsx is still waiting for
 * Notion (usually under a second). A small constellation draws itself, line
 * by line, while the stars come up.
 */

import { instrumentSans } from "../../fonts";
import { cormorant } from "./fonts";
import styles from "./styles.module.css";

const STARS = [
  { x: 20, y: 70 },
  { x: 62, y: 38 },
  { x: 108, y: 56 },
  { x: 150, y: 22 },
  { x: 182, y: 64 },
];

export default function Loading() {
  return (
    <div className={`${styles.page} ${styles.loading} ${instrumentSans.className} ${cormorant.variable}`} role="status" aria-live="polite">
      <div className={styles.loadingInner}>
        <svg className={styles.loadingChart} viewBox="0 0 200 90" aria-hidden="true">
          <path
            className={styles.loadingLine}
            pathLength={100}
            d={`M${STARS.map((star) => `${star.x} ${star.y}`).join(" L")}`}
          />
          {STARS.map((star, index) => (
            <circle key={index} className={styles.loadingStar} cx={star.x} cy={star.y} r={index === 3 ? 3.4 : 2.4} style={{ animationDelay: `${index * 0.28}s` }} />
          ))}
        </svg>
        <p className={styles.loadingKicker}>My Bookstore</p>
        <p className={styles.loadingTitle}>Charting the heavens…</p>
        <p className={styles.loadingText}>Reading the catalogue from Notion</p>
      </div>
    </div>
  );
}
