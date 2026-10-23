/**
 * Shown when `notFound()` is called: for a board that doesn't exist, AND for
 * someone else's private board. Both get exactly this page (with the
 * "404 Not Found" status), so nobody can find out that a private board exists.
 */

import Link from "next/link";
import Frame from "./Frame";
import { HOME } from "./lib/paths";
import SignInLink from "./SignInLink";
import styles from "./styles.module.css";

export default function NotFound() {
  return (
    <Frame>
      <section className={styles.notice} aria-labelledby="not-found-title">
        <p className={styles.eyebrow}>Not found</p>
        <h1 id="not-found-title" className={styles.noticeTitle}>
          There&apos;s no board here
        </h1>
        <p className={styles.noticeText}>
          It may have been deleted, or the link may be mistyped. If it&apos;s one of your own private boards,{" "}
          <SignInLink>sign in</SignInLink> to see it.
        </p>
        <div className={styles.actions}>
          <Link className={styles.button} href={HOME}>
            Go to the library
          </Link>
        </div>
      </section>
    </Frame>
  );
}
