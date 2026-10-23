"use client";

/**
 * The form for one item: an image address, a link, a title and a note.
 * Used twice: to add an item to a board, and to edit an item.
 *
 * While you type an image address, a small preview shows whether the
 * picture loads, before you save it.
 */

import { useActionState, useId, useState } from "react";
import { addItemAction, updateItemAction, type FormState } from "./actions";
import type { Item } from "./lib/boards";
import { LIMITS } from "./lib/validate";
import styles from "./styles.module.css";

type Props =
  | { mode: "add"; boardId: string }
  | { mode: "edit"; item: Pick<Item, "id" | "imageUrl" | "linkUrl" | "title" | "note"> };

export default function ItemForm(props: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(props.mode === "add" ? addItemAction : updateItemAction, {
    status: "idle",
  });

  const item = props.mode === "edit" ? props.item : null;
  const typed = state.status === "error" ? state.values : null;
  const start = {
    imageUrl: typed?.imageUrl ?? item?.imageUrl ?? "",
    linkUrl: typed?.linkUrl ?? item?.linkUrl ?? "",
    title: typed?.title ?? item?.title ?? "",
    note: typed?.note ?? item?.note ?? "",
  };

  return (
    // A new `key` after every answer starts the form afresh: empty after
    // adding an item, or with what you typed if something needs fixing.
    <form key={state.status === "idle" ? "start" : state.at} action={formAction} className={styles.form}>
      {/* Ids travel with the form, but the server only changes boards and items that are yours. */}
      {props.mode === "add" ? <input type="hidden" name="boardId" value={props.boardId} /> : <input type="hidden" name="itemId" value={props.item.id} />}

      <ImageField initial={start.imageUrl} />

      <label className={styles.label}>
        <span className={styles.labelText}>Link</span>
        <input
          className={styles.input}
          name="linkUrl"
          type="text"
          inputMode="url"
          maxLength={LIMITS.url}
          defaultValue={start.linkUrl}
          placeholder="https://… (the page it came from, or any website)"
        />
      </label>

      <label className={styles.label}>
        <span className={styles.labelText}>
          Title <span className={styles.optional}>(optional)</span>
        </span>
        <input className={styles.input} name="title" type="text" maxLength={LIMITS.itemTitle} defaultValue={start.title} />
      </label>

      <label className={styles.label}>
        <span className={styles.labelText}>
          Note <span className={styles.optional}>(optional)</span>
        </span>
        <textarea className={styles.textarea} name="note" rows={2} maxLength={LIMITS.note} defaultValue={start.note} placeholder="Why did you save it?" />
      </label>

      {state.status === "error" && (
        <p className={styles.formError} role="alert">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p className={styles.formSaved} role="status">
          {props.mode === "add" ? "Added to the board." : "Saved."}
        </p>
      )}

      <div className={styles.actions}>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? "Saving…" : props.mode === "add" ? "Save to board" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

/** The image address field, with a live preview of the picture. */
function ImageField({ initial }: { initial: string }) {
  const [address, setAddress] = useState(initial);
  const [broken, setBroken] = useState(false);
  // A unique id, because a board page can show several of these forms at once.
  const hintId = useId();
  const looksLikeAddress = /^https?:\/\/\S+\.\S+/i.test(address.trim());

  return (
    <div className={styles.imageField}>
      <label className={styles.label}>
        <span className={styles.labelText}>Image address</span>
        <input
          className={styles.input}
          name="imageUrl"
          type="text"
          inputMode="url"
          maxLength={LIMITS.url}
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
            setBroken(false);
          }}
          placeholder="https://…/picture.jpg"
          aria-describedby={hintId}
        />
        <span id={hintId} className={styles.hint}>
          On most websites: right-click a picture → <strong>Copy Image Address</strong>.
        </span>
      </label>

      {looksLikeAddress && (
        <div className={styles.imagePreview}>
          {broken ? (
            <span className={styles.imagePreviewBroken}>This picture didn&apos;t load. Check the address, or try another picture.</span>
          ) : (
            // A plain <img>, because the picture can come from any website.
            <img className={styles.imagePreviewImage} src={address.trim()} alt="Preview" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
          )}
        </div>
      )}
    </div>
  );
}
