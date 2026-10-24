"use client";

/**
 * Choosing (or changing) your username, on your library's home page.
 *
 * Accounts made before usernames existed, and Google sign-ups, don't have
 * one yet. This form asks Better Auth to update your account
 * (authClient.updateUser → /api/auth/update-user); the username plugin
 * checks it on the server (format, and not taken by someone else) and
 * stores it in lower case.
 */

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { explainUsernameError, USERNAME_HINT, USERNAME_PATTERN } from "./AuthForm";
import { authClient } from "./lib/auth-client";
import styles from "./styles.module.css";

export default function UsernameForm({ current }: { current: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = String(new FormData(event.currentTarget).get("username") ?? "").trim();
    if (username.toLowerCase() === current) return;

    setPending(true);
    setError(null);
    const { error } = await authClient.updateUser({ username });
    setPending(false);

    if (error) {
      setError(explainUsernameError(error.code) ?? "Your username couldn't be saved. Please try again.");
      return;
    }
    // Saved: build the page again, so the profile link shows the new username.
    router.refresh();
  }

  return (
    <form className={styles.usernameForm} onSubmit={handleSubmit}>
      <label className={styles.label}>
        <span className={styles.labelText}>{current ? "Change your username" : "Choose a username"}</span>
        <span className={styles.usernameRow}>
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
            defaultValue={current ?? ""}
            aria-describedby="username-form-hint"
          />
          <button className={styles.buttonSmall} type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </span>
        <span id="username-form-hint" className={styles.hint}>
          {USERNAME_HINT} Changing it changes your profile&apos;s address.
        </span>
      </label>
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
