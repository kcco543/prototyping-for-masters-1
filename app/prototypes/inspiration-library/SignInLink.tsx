"use client";

/**
 * A "Sign in" link that brings you back to this exact page afterwards.
 * It needs the page's address, which `usePathname` reads in the browser.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signInHref } from "./lib/paths";
import styles from "./styles.module.css";

export default function SignInLink({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Link className={styles.textLink} href={signInHref(pathname)}>
      {children}
    </Link>
  );
}
