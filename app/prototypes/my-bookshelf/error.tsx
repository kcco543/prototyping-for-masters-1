"use client";

/**
 * A Constellation of Stories — shown if something unexpected breaks the page.
 *
 * Problems with Notion itself (a wrong token, an unshared database…) don't
 * end up here: page.tsx explains those. This is the safety net for anything
 * else. Next.js shows this file instead of a blank page, and `reset()` tries
 * to draw the page again.
 */

import { useEffect } from "react";
import { instrumentSans } from "../../fonts";
import { cormorant } from "./fonts";
import styles from "./styles.module.css";

export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The full error, for whoever is looking at the browser's console
    console.error("[my-bookshelf]", error);
  }, [error]);

  return (
    <div className={`${styles.page} ${styles.loading} ${instrumentSans.className} ${cormorant.variable}`}>
      <div className={styles.loadingInner} role="alert">
        <p className={styles.loadingKicker}>My Bookstore</p>
        <p className={styles.loadingTitle}>The sky has clouded over</p>
        <p className={styles.loadingText}>
          Something went wrong while drawing the constellations. Your books in Notion are safe; only this page stumbled.
        </p>
        <button type="button" className={styles.sampleButton} onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
