/** Shown for a username nobody has (or one that can't be a username at all). */

import Link from "next/link";
import Frame from "../../Frame";
import { HOME } from "../../lib/paths";
import styles from "../../styles.module.css";

export default function ProfileNotFound() {
  return (
    <Frame>
      <section className={styles.notice} aria-labelledby="profile-not-found-title">
        <p className={styles.eyebrow}>Not found</p>
        <h1 id="profile-not-found-title" className={styles.noticeTitle}>
          No one here
        </h1>
        <p className={styles.noticeText}>There&apos;s no profile with this username. It may have changed, or the link may be mistyped.</p>
        <div className={styles.actions}>
          <Link className={styles.button} href={HOME}>
            Go to the library
          </Link>
        </div>
      </section>
    </Frame>
  );
}
