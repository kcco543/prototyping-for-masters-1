/**
 * The frame around every page of the prototype: the top bar (back home, the
 * library's name, and your account) and the footer.
 *
 * Each page asks the server who's signed in and passes the user in here,
 * so the top bar shows "Sign out" or "Sign in / Sign up" as appropriate.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import BackHome from "../../components/back-home/BackHome";
import { instrumentSans, instrumentSerif } from "../../fonts";
import { HOME, SIGN_IN, SIGN_UP } from "./lib/paths";
import SignOutButton from "./SignOutButton";
import styles from "./styles.module.css";

type Props = {
  /**
   * The signed-in user, `null` when signed out (shows Sign in / Sign up),
   * or left out when we don't know (setup and error pages show neither).
   */
  user?: { name: string; email: string } | null;
  /** Leave out the Sign in / Sign up links (on those pages themselves). */
  hideAuthLinks?: boolean;
  children: ReactNode;
};

export default function Frame({ user, hideAuthLinks = false, children }: Props) {
  return (
    <div className={`${styles.page} ${instrumentSans.className} ${instrumentSerif.variable}`}>
      <header className={styles.topBar}>
        <BackHome accent="#d4532f" surface="#fffdf8" ink="#1f1c18" />
        <Link href={HOME} className={styles.brand}>
          Inspiration <em className={styles.brandItalic}>library</em>
        </Link>
        <nav className={styles.account} aria-label="Your account">
          {user && (
            <>
              <span className={styles.who} title={user.email}>
                {user.name}
              </span>
              <SignOutButton />
            </>
          )}
          {user === null && !hideAuthLinks && (
            <>
              <Link href={SIGN_IN} className={styles.navLink}>
                Sign in
              </Link>
              <Link href={SIGN_UP} className={styles.buttonSmall}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        Accounts by Better Auth. Boards and items are kept in a Supabase Postgres database.
      </footer>
    </div>
  );
}
