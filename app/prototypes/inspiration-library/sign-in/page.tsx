/**
 * The sign in page. The form itself is AuthForm.tsx (it runs in the browser).
 * Already signed in? You're sent straight on.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "../AuthForm";
import Frame from "../Frame";
import { safeNext } from "../lib/paths";
import { attempt } from "../lib/problems";
import { getSession } from "../lib/session";
import { checkSettings } from "../lib/settings";
import { ProblemNotice, SetupNotice } from "../SetupNotice";
import styles from "../styles.module.css";

export const metadata: Metadata = { title: "Sign in · Inspiration library" };

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function SignInPage({ searchParams }: Props) {
  const settings = checkSettings();
  if (!settings.ok) {
    return (
      <Frame>
        <SetupNotice check={settings} />
      </Frame>
    );
  }

  const { next } = await searchParams;
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
      <section className={styles.authCard} aria-labelledby="sign-in-title">
        <p className={styles.eyebrow}>Welcome back</p>
        <h1 id="sign-in-title" className={styles.authTitle}>
          Sign in to your library
        </h1>
        <AuthForm mode="sign-in" next={goTo} />
      </section>
    </Frame>
  );
}
