"use client";

/**
 * A submit button that asks "Are you sure?" first. Used for Delete.
 *
 * It sits inside a <form> whose `action` is a server action. If you click
 * Cancel in the browser's question, `preventDefault()` stops the form
 * from being sent. `useFormStatus` tells it when that form is on its way, to
 * show "Deleting…".
 */

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  /** The question in the browser's "OK / Cancel" box */
  question: string;
  className?: string;
  children: ReactNode;
};

export default function ConfirmButton({ question, className, children }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(question)) event.preventDefault();
      }}
    >
      {pending ? "Deleting…" : children}
    </button>
  );
}
