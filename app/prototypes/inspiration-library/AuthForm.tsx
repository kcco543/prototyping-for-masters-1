"use client";

/**
 * The sign in and sign up form (one component for both pages).
 *
 * It runs in the browser and calls Better Auth's browser client
 * (lib/auth-client.ts), which sends the email and password to
 * /api/auth/sign-in/email or /api/auth/sign-up/email. Better Auth checks
 * them on the server and, if all is well, sets the session cookie. Going
 * through /api/auth (rather than a server action) means the rate limits in
 * lib/auth.ts apply to every attempt.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "./lib/auth-client";
import { SIGN_IN, SIGN_UP } from "./lib/paths";
import styles from "./styles.module.css";

/** Must match `minPasswordLength` in lib/auth.ts. */
const MIN_PASSWORD_LENGTH = 12;

type Props = {
  mode: "sign-in" | "sign-up";
  /** Where to go afterwards (already checked by safeNext() on the server) */
  next: string;
};

/** The error Better Auth's client hands back when something goes wrong. */
type AuthError = { code?: string; message?: string; status: number };

/** Better Auth's error, in plain words. */
function explain(error: AuthError, mode: Props["mode"]): string {
  if (error.status === 429) return "Too many attempts in a short time. Wait a minute, then try again.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match. Check for typos and try again.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "There's already an account with this email. Sign in instead?";
    case "PASSWORD_TOO_SHORT":
      return `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
    case "PASSWORD_TOO_LONG":
      return "That password is too long. Use 128 characters or fewer.";
    case "INVALID_EMAIL":
      return "That doesn't look like an email address.";
    case "INVALID_ORIGIN":
    case "MISSING_OR_NULL_ORIGIN":
      return "This website's address doesn't match BETTER_AUTH_URL, so Better Auth refused the request. Set BETTER_AUTH_URL to this site's address (see the README).";
  }
  if (error.status === 503) return "Accounts aren't set up on this site yet (see the README).";
  if (error.status >= 500) {
    return `The server couldn't ${mode === "sign-up" ? "create your account" : "sign you in"} just now. If you're setting this up, check that schema.sql has been run in Supabase (see the README).`;
  }
  return error.message || "Something went wrong. Please try again.";
}

export default function AuthForm({ mode, next }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const signingUp = mode === "sign-up";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Stop the browser's own form submission: we send it with Better Auth instead.
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setPending(true);
    setError(null);

    const { error } = signingUp
      ? await authClient.signUp.email({ name: String(form.get("name") ?? "").trim(), email, password })
      : await authClient.signIn.email({ email, password });

    if (error) {
      setError(explain(error, mode));
      setPending(false);
      return;
    }

    // Signed in (signing up signs you in too). The cookie is set, so go on,
    // and refresh so the server builds the next page for a signed-in visitor.
    router.replace(next);
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {signingUp && (
        <label className={styles.label}>
          <span className={styles.labelText}>Your name</span>
          <input className={styles.input} name="name" type="text" autoComplete="name" required maxLength={100} />
        </label>
      )}

      <label className={styles.label}>
        <span className={styles.labelText}>Email</span>
        <input className={styles.input} name="email" type="email" autoComplete="email" required maxLength={254} />
      </label>

      <label className={styles.label}>
        <span className={styles.labelText}>Password</span>
        <input
          className={styles.input}
          name="password"
          type="password"
          // Lets password managers offer to create (or fill in) a password.
          autoComplete={signingUp ? "new-password" : "current-password"}
          required
          minLength={signingUp ? MIN_PASSWORD_LENGTH : undefined}
          maxLength={128}
          aria-describedby={signingUp ? "password-hint" : undefined}
        />
        {signingUp && (
          <span id="password-hint" className={styles.hint}>
            At least {MIN_PASSWORD_LENGTH} characters. A few random words work well.
          </span>
        )}
      </label>

      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}

      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? (signingUp ? "Creating your library…" : "Signing in…") : signingUp ? "Create account" : "Sign in"}
      </button>

      <p className={styles.formSwitch}>
        {signingUp ? (
          <>
            Already have an account?{" "}
            <Link className={styles.textLink} href={`${SIGN_IN}?next=${encodeURIComponent(next)}`}>
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link className={styles.textLink} href={`${SIGN_UP}?next=${encodeURIComponent(next)}`}>
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
