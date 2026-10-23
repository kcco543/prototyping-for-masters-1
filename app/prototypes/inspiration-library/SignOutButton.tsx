"use client";

/**
 * The sign out button. Better Auth deletes the session from the database
 * and clears the cookie; then we go back to the prototype's home page and
 * refresh it, so the server builds it for a signed-out visitor.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "./lib/auth-client";
import { HOME } from "./lib/paths";
import styles from "./styles.module.css";

export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace(HOME);
    router.refresh();
  }

  return (
    <button className={styles.buttonQuiet} type="button" onClick={signOut} disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
