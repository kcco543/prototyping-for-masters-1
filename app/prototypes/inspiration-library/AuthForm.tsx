"use client";

/**
 * The sign in and sign up form (one component for both pages).
 *
 * It runs in the browser and calls Better Auth's browser client
 * (lib/auth-client.ts), which sends the email and password to
 * /api/auth/sign-in/email or /api/auth/sign-up/email. Signing in with a
 * username instead (anything without an @) goes to /api/auth/sign-in/username. Better Auth checks
 * them on the server and, if all is well, sets the session cookie. Going
 * through /api/auth (rather than a server action) means the rate limits in
 * lib/auth.ts apply to every attempt.
 *
 * "Continue with Google" (when it's set up) works differently: the browser
 * leaves this site for Google's sign-in page and comes back afterwards, so
 * there's nothing to wait for here. If it goes wrong, Better Auth sends you
 * back to this page with `?error=<code>` in the address, shown by
 * explainGoogleError() below.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "./lib/auth-client";
import { SIGN_IN, SIGN_UP } from "./lib/paths";
import styles from "./styles.module.css";

/** Must match `minPasswordLength` in lib/auth.ts. */
const MIN_PASSWORD_LENGTH = 12;

/**
 * The username plugin's rules (lib/auth.ts): 3–30 letters, numbers, _ or .
 * Checked here so you hear about it straight away; the server checks again.
 */
export const USERNAME_PATTERN = "[A-Za-z0-9_.]{3,30}";
export const USERNAME_HINT = "3–30 letters, numbers, _ or . — it's in your profile's web address.";

/** The username plugin's errors, in plain words (also used by UsernameForm.tsx). */
export function explainUsernameError(code: string | undefined): string | null {
  switch (code) {
    case "USERNAME_IS_ALREADY_TAKEN":
      return "That username is taken. Try another.";
    case "USERNAME_TOO_SHORT":
      return "Use at least 3 characters for your username.";
    case "USERNAME_TOO_LONG":
      return "Use 30 characters or fewer for your username.";
    case "INVALID_USERNAME":
      return "Use only letters, numbers, _ and . in your username.";
    default:
      return null;
  }
}

type Props = {
  mode: "sign-in" | "sign-up";
  /** Where to go afterwards (already checked by safeNext() on the server) */
  next: string;
  /** Show "Continue with Google"? (Only when GOOGLE_CLIENT_ID and _SECRET are set.) */
  google: boolean;
  /** The `?error=` code Better Auth sent us back with, after a failed Google sign-in */
  googleError?: string;
};

/**
 * A failed Google sign-in, in plain words. Better Auth sends these codes in
 * the address (`?error=…`), so anyone could type one in: we only ever show
 * our own sentences, never the code's text itself.
 */
export function explainGoogleError(code: string): string {
  switch (code) {
    case "account_not_linked":
      return "There's already an account with this email, made with a password. Sign in with your email and password instead.";
    case "access_denied":
      return "Google sign-in was cancelled. You can try again, or use your email and password.";
    case "signup_disabled":
      return "New accounts can't be created right now.";
    case "email_not_found":
      return "Google didn't share an email address, so we couldn't sign you in.";
    case "state_mismatch":
    case "please_restart_the_process":
      return "The Google sign-in took too long or was opened in another tab. Please try again.";
    default:
      return "Google sign-in didn't work. Please try again, or use your email and password.";
  }
}

/** The error Better Auth's client hands back when something goes wrong. */
type AuthError = { code?: string; message?: string; status: number };

/** Better Auth's error, in plain words. */
function explain(error: AuthError, mode: Props["mode"]): string {
  if (error.status === 429) return "Too many attempts in a short time. Wait a minute, then try again.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match. Check for typos and try again.";
    case "INVALID_USERNAME_OR_PASSWORD":
      return "That username and password don't match. Check for typos and try again.";
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
  const usernameProblem = explainUsernameError(error.code);
  if (usernameProblem) return usernameProblem;
  if (error.status === 503) return "Accounts aren't set up on this site yet (see the README).";
  if (error.status >= 500) {
    return `The server couldn't ${mode === "sign-up" ? "create your account" : "sign you in"} just now. If you're setting this up, check that schema.sql has been run in Supabase (see the README).`;
  }
  return error.message || "Something went wrong. Please try again.";
}

export default function AuthForm({ mode, next, google, googleError }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(googleError ? explainGoogleError(googleError) : null);
  const [pending, setPending] = useState(false);
  const signingUp = mode === "sign-up";

  async function handleGoogle() {
    setPending(true);
    setError(null);
    // This page's own address, to come back to if Google sign-in fails.
    const thisPage = `${signingUp ? SIGN_UP : SIGN_IN}?next=${encodeURIComponent(next)}`;
    /*
      Better Auth sends the browser to Google. Afterwards Google sends it to
      /api/auth/callback/google, and Better Auth then goes on to `callbackURL`
      (signed in) or `errorCallbackURL` (with ?error=…). The same button
      signs you up the first time, so it's the same on both pages.
    */
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
      errorCallbackURL: thisPage,
    });
    // Only reached if we couldn't even leave for Google (e.g. it isn't set up).
    if (error) {
      setError(explain(error, mode));
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Stop the browser's own form submission: we send it with Better Auth instead.
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setPending(true);
    setError(null);

    let result;
    if (signingUp) {
      // The plugin stores the username in lower case, and keeps how you
      // typed it as displayUsername.
      const username = String(form.get("username") ?? "").trim();
      result = await authClient.signUp.email({ name: String(form.get("name") ?? "").trim(), email, password, username });
    } else if (email.includes("@")) {
      result = await authClient.signIn.email({ email, password });
    } else {
      // No @, so it's a username.
      result = await authClient.signIn.username({ username: email, password });
    }
    const { error } = result;

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
      {google && (
        <>
          <button className={styles.googleButton} type="button" onClick={handleGoogle} disabled={pending}>
            <GoogleLogo />
            Continue with Google
          </button>
          <p className={styles.orDivider}>
            <span className={styles.orDividerText}>or with email</span>
          </p>
        </>
      )}

      {signingUp && (
        <label className={styles.label}>
          <span className={styles.labelText}>Your name</span>
          <input className={styles.input} name="name" type="text" autoComplete="name" required maxLength={100} />
        </label>
      )}

      {signingUp && (
        <label className={styles.label}>
          <span className={styles.labelText}>Username</span>
          <input
            className={styles.input}
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            pattern={USERNAME_PATTERN}
            title={USERNAME_HINT}
            maxLength={30}
            aria-describedby="username-hint"
          />
          <span id="username-hint" className={styles.hint}>
            {USERNAME_HINT}
          </span>
        </label>
      )}

      <label className={styles.label}>
        <span className={styles.labelText}>{signingUp ? "Email" : "Email or username"}</span>
        <input
          className={styles.input}
          name="email"
          // Signing in accepts a username too, so it can't insist on an email there.
          type={signingUp ? "email" : "text"}
          autoComplete={signingUp ? "email" : "username"}
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
        />
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

/** Google's "G", as Google's sign-in button guidelines ask for. */
function GoogleLogo() {
  return (
    <svg className={styles.googleLogo} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
