/**
 * The sign up page. The form itself is AuthForm.tsx (it runs in the browser).
 * Already signed in? You're sent straight on.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "../AuthForm";
import Frame from "../Frame";
import { safeNext } from "../lib/paths";
import { attempt } from "../lib/problems";
import { getSession } from "../lib/session";
import { checkSettings, googleSignInReady } from "../lib/settings";
import { ProblemNotice, SetupNotice } from "../SetupNotice";
import styles from "../styles.module.css";

export const metadata: Metadata = { title: "Sign up · Inspiration library" };

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> };

export default async function SignUpPage({ searchParams }: Props) {
  const settings = checkSettings();
  if (!settings.ok) {
    return (
      <Frame>
        <SetupNotice check={settings} />
      </Frame>
    );
  }

  const { next, error } = await searchParams;
  const goTo = safeNext(typeof next === "string" ? next : null);

  const result = await attempt(getSession);
  if (!result.ok) {
    return (
      <Frame>
        <ProblemNotice problem={result.problem} />
      </Frame>
    );
  }
  if (result.value) redirect(goTo);

  return (
    <Frame user={null} hideAuthLinks>
      <section className={styles.authCard} aria-labelledby="sign-up-title">
        <p className={styles.eyebrow}>Start your library</p>
        <h1 id="sign-up-title" className={styles.authTitle}>
          Create an account
        </h1>
        <p className={styles.authText}>Your boards are private unless you make one public.</p>
        <AuthForm
          mode="sign-up"
          next={goTo}
          google={googleSignInReady()}
          // Set by Better Auth when a Google sign-in comes back with a problem.
          googleError={typeof error === "string" ? error : undefined}
        />
      </section>
    </Frame>
  );
}
