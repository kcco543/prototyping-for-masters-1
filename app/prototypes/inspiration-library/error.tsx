"use client";

/**
 * Shown if something unexpected breaks while a page of the prototype is
 * built or a form is sent (for example, the database stops answering in the
 * middle of a delete). Expected problems, like missing settings, get their
 * own explanations instead (see SetupNotice.tsx).
 *
 * Error pages must be client components: "Try again" runs in the browser.
 */

import Link from "next/link";
import { useEffect } from "react";
import { instrumentSans, instrumentSerif } from "../../fonts";
import { HOME } from "./lib/paths";
import styles from "./styles.module.css";

export default function InspirationLibraryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The browser's console shows what went wrong; the server's terminal shows more.
    console.error(error);
  }, [error]);

  return (
    <div className={`${styles.page} ${instrumentSans.className} ${instrumentSerif.variable}`}>
      <main className={styles.main}>
        <section className={`${styles.notice} ${styles.noticeProblem}`} aria-labelledby="error-title">
          <p className={styles.eyebrow}>Something went wrong</p>
          <h1 id="error-title" className={styles.noticeTitle}>
            That didn&apos;t work
          </h1>
          <p className={styles.noticeText}>
            Something unexpected happened. Try again in a moment. If it keeps happening, the terminal running{" "}
            <code className={styles.code}>npm run dev</code> (or your Vercel project&apos;s Logs) shows the details, on a line starting with{" "}
            <code className={styles.code}>[inspiration-library]</code> or <code className={styles.code}>[Better Auth]</code>.
          </p>
          <div className={styles.actions}>
            <button className={styles.button} type="button" onClick={reset}>
              Try again
            </button>
            <Link className={styles.buttonQuiet} href={HOME}>
              Go to the library
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
