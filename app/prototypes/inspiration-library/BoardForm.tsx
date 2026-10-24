"use client";

/**
 * The form for a board's title, description and public/private switch.
 * Used twice: to create a board (boards/new) and to edit one (on its page).
 *
 * It sends its fields to a server action (actions.ts) with `useActionState`,
 * a React hook that gives back the action's answer ("Saved", or what went
 * wrong) and whether it's still working (`pending`).
 */

import Link from "next/link";
import { useActionState } from "react";
import { createBoardAction, updateBoardAction, type FormState } from "./actions";
import { LIMITS } from "./lib/validate";
import styles from "./styles.module.css";

type Props = {
  /** The board to edit. Leave it out to create a new board. */
  board?: { id: string; title: string; description: string; isPublic: boolean };
  /** Where the Cancel link goes (only shown when creating). */
  cancelHref?: string;
};

export default function BoardForm({ board, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(board ? updateBoardAction : createBoardAction, { status: "idle" });

  // After an error, fill the form with what was typed; otherwise with the board as it is now.
  const typed = state.status === "error" ? state.values : null;

  return (
    // A new `key` after every answer makes React start the form afresh with these values.
    <form key={state.status === "idle" ? "start" : state.at} action={formAction} className={styles.form}>
      {/* The board's id travels with the form. The server never trusts it: it only changes the board if it's yours. */}
      {board && <input type="hidden" name="boardId" value={board.id} />}

      <label className={styles.label}>
        <span className={styles.labelText}>Title</span>
        <input
          className={styles.input}
          name="title"
          type="text"
          required
          maxLength={LIMITS.boardTitle}
          defaultValue={typed?.title ?? board?.title ?? ""}
          placeholder="Type specimens"
        />
      </label>

      <label className={styles.label}>
        <span className={styles.labelText}>
          Description <span className={styles.optional}>(optional)</span>
        </span>
        <textarea
          className={styles.textarea}
          name="description"
          rows={3}
          maxLength={LIMITS.description}
          defaultValue={typed?.description ?? board?.description ?? ""}
          placeholder="What is this board for?"
        />
      </label>

      <label className={styles.checkRow}>
        <input
          className={styles.checkbox}
          name="isPublic"
          type="checkbox"
          defaultChecked={typed ? typed.isPublic === "on" : (board?.isPublic ?? false)}
        />
        <span className={styles.checkText}>
          <strong>Public board</strong>
          <span className={styles.hint}>Anyone with the link can look at it, even without an account. Only you can change it.</span>
        </span>
      </label>

      {state.status === "error" && (
        <p className={styles.formError} role="alert">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p className={styles.formSaved} role="status">
          Saved.
        </p>
      )}

      <div className={styles.actions}>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? "Saving…" : board ? "Save changes" : "Create board"}
        </button>
        {cancelHref && (
          <Link className={styles.buttonQuiet} href={cancelHref}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
