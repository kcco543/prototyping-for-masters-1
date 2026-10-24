"use client";

/**
 * The form for one item: a picture, a link, a title and a note.
 * Used twice: to add an item to a board, and to edit an item.
 *
 * The picture can be:
 *   - UPLOADED from your computer (when uploading is set up): it's sent to
 *     Supabase Storage as soon as you choose it, and the form only keeps its
 *     path, in a hidden "imagePath" field. See uploadPicture() below and
 *     lib/storage.ts.
 *   - an IMAGE ADDRESS from another website, with a live preview.
 * Only one of the two is ever sent: the other tab's field isn't on the page.
 *
 * When editing, a "Boards" checklist shows every board of yours: the item is
 * on the ticked ones (an item can be on several boards, see lib/boards.ts).
 */

import { useActionState, useEffect, useId, useState, type ChangeEvent } from "react";
import { addItemAction, startImageUploadAction, updateItemAction, type FormState } from "./actions";
import type { Item } from "./lib/boards";
import { LIMITS } from "./lib/validate";
import styles from "./styles.module.css";

type Props = {
  /** The board the item is (or will be) on: uploads go in that board's folder. */
  boardId: string;
  /** Show the "Upload" tab? (Only when SUPABASE_URL and SUPABASE_SECRET_KEY are set.) */
  uploads: boolean;
} & (
  | { mode: "add" }
  | {
      mode: "edit";
      item: Pick<Item, "id" | "imageUrl" | "imagePath" | "linkUrl" | "title" | "note" | "boardIds">;
      /** A signed link to the item's uploaded picture, for the preview */
      imageSrc: string | null;
      /** All your boards, for the "Boards" checklist */
      boards: { id: string; title: string }[];
    }
);

/** The same types and size as the bucket allows (lib/storage.ts, migration 0005). */
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_MB = 5;

/** A picture chosen on this page: its path in Storage, and a preview made from the file itself. */
type Uploaded = { path: string; src: string };

export default function ItemForm(props: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(props.mode === "add" ? addItemAction : updateItemAction, {
    status: "idle",
  });
  // Kept here, outside the form below, so the preview survives the form
  // starting afresh after an error.
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [uploading, setUploading] = useState(false);

  // Saved: forget the uploaded picture, so the next item starts empty.
  useEffect(() => {
    if (state.status === "saved") setUploaded(null);
  }, [state]);

  const item = props.mode === "edit" ? props.item : null;
  const typed = state.status === "error" ? state.values : null;
  const start = {
    imageUrl: typed?.imageUrl ?? item?.imageUrl ?? "",
    imagePath: typed?.imagePath ?? item?.imagePath ?? "",
    linkUrl: typed?.linkUrl ?? item?.linkUrl ?? "",
    title: typed?.title ?? item?.title ?? "",
    note: typed?.note ?? item?.note ?? "",
  };
  // A preview for the starting picture: one chosen on this page, or the item's saved one.
  const startSrc =
    uploaded?.path === start.imagePath ? uploaded.src : props.mode === "edit" && start.imagePath === props.item.imagePath ? props.imageSrc : null;

  return (
    // A new `key` after every answer starts the form afresh: empty after
    // adding an item, or with what you typed if something needs fixing.
    <form key={state.status === "idle" ? "start" : state.at} action={formAction} className={styles.form}>
      {/* Ids travel with the form, but the server only changes boards and items that are yours. */}
      {props.mode === "add" ? <input type="hidden" name="boardId" value={props.boardId} /> : <input type="hidden" name="itemId" value={props.item.id} />}

      <PictureField
        boardId={props.boardId}
        uploads={props.uploads}
        initialAddress={start.imageUrl}
        initialPath={start.imagePath}
        initialSrc={startSrc}
        onUploaded={setUploaded}
        onUploadingChange={setUploading}
      />

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

      {props.mode === "edit" && (
        <fieldset className={styles.boardChecklist}>
          <legend className={styles.labelText}>Boards</legend>
          {/* Each ticked box sends one "boardIds" value; the server reads them all with form.getAll(). */}
          {props.boards.map((board) => (
            <label key={board.id} className={styles.checkRow}>
              <input
                className={styles.checkbox}
                type="checkbox"
                name="boardIds"
                value={board.id}
                defaultChecked={props.item.boardIds.includes(board.id)}
              />
              <span className={styles.checkText}>{board.title}</span>
            </label>
          ))}
        </fieldset>
      )}

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
        {/* Wait for the picture to finish uploading before saving. */}
        <button className={styles.button} type="submit" disabled={pending || uploading}>
          {uploading ? "Uploading picture…" : pending ? "Saving…" : props.mode === "add" ? "Save to board" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

/* ---------- The picture: upload a file, or paste an image address ---------- */

type PictureFieldProps = {
  boardId: string;
  uploads: boolean;
  initialAddress: string;
  initialPath: string;
  initialSrc: string | null;
  onUploaded: (uploaded: Uploaded | null) => void;
  onUploadingChange: (uploading: boolean) => void;
};

function PictureField(props: PictureFieldProps) {
  // Which tab is open. Start on "Upload" unless there's already an address.
  const [tab, setTab] = useState<"upload" | "address">(props.uploads && !props.initialAddress ? "upload" : "address");
  const tabsId = useId();

  // Uploading isn't set up, but this item already has an uploaded picture:
  // keep it as it is.
  if (!props.uploads && props.initialPath) {
    return <input type="hidden" name="imagePath" value={props.initialPath} />;
  }
  if (!props.uploads) return <AddressField initial={props.initialAddress} />;

  return (
    <fieldset className={styles.pictureField}>
      <legend className={styles.labelText}>Picture</legend>
      <div className={styles.pictureTabs} role="radiogroup" aria-label="Where the picture comes from">
        {(["upload", "address"] as const).map((name) => (
          <label key={name} className={tab === name ? styles.pictureTabActive : styles.pictureTab}>
            <input
              className={styles.pictureTabInput}
              type="radio"
              name={`${tabsId}-tab`}
              checked={tab === name}
              onChange={() => setTab(name)}
            />
            {name === "upload" ? "Upload from your computer" : "Paste an image address"}
          </label>
        ))}
      </div>
      {/* Both tabs stay on the page so switching back keeps what you did; only the open one is sent. */}
      <div hidden={tab !== "upload"}>
        <UploadField {...props} active={tab === "upload"} />
      </div>
      <div hidden={tab !== "address"}>
        <AddressField initial={props.initialAddress} active={tab === "address"} />
      </div>
    </fieldset>
  );
}

/**
 * Sends a picture to Supabase Storage, in three steps (see lib/storage.ts):
 * ask our server for a one-time upload link, send the file straight to
 * Supabase with it, and hand back the path to save with the item.
 */
async function uploadPicture(boardId: string, file: File): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  const start = await startImageUploadAction(boardId, file.type, file.size);
  if (!start.ok) return start;

  // The same request Supabase's own library makes: the file as form data.
  // The link itself is the permission, so no key is needed here.
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  try {
    const response = await fetch(start.uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
    if (!response.ok) return { ok: false, message: "Supabase didn't accept the picture. Check it's an image of 5 MB or less, then try again." };
  } catch {
    return { ok: false, message: "The picture couldn't be uploaded. Check your internet connection and try again." };
  }
  return { ok: true, path: start.path };
}

function UploadField(props: PictureFieldProps & { active: boolean }) {
  const [path, setPath] = useState(props.initialPath);
  const [src, setSrc] = useState(props.initialSrc);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [message, setMessage] = useState("");
  const hintId = useId();

  async function handleChoose(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    // Quick checks here, so you don't wait for an upload that will fail.
    // The server and Supabase check again: these are only for your convenience.
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setStatus("error");
      setMessage("Choose a JPEG, PNG, WebP, GIF or AVIF picture.");
      input.value = "";
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setStatus("error");
      setMessage(`That picture is ${(file.size / 1024 / 1024).toFixed(1)} MB. Choose one of ${MAX_MB} MB or less.`);
      input.value = "";
      return;
    }

    setStatus("uploading");
    props.onUploadingChange(true);
    const result = await uploadPicture(props.boardId, file);
    props.onUploadingChange(false);
    input.value = "";

    if (!result.ok) {
      setStatus("error");
      setMessage(result.message);
      return;
    }
    // A preview made from the file on your computer: no need to download it again.
    const preview = URL.createObjectURL(file);
    setPath(result.path);
    setSrc(preview);
    setStatus("idle");
    props.onUploaded({ path: result.path, src: preview });
  }

  function handleRemove() {
    setPath("");
    setSrc(null);
    props.onUploaded(null);
  }

  return (
    <div className={styles.imageField}>
      {/* Only the path is sent with the form, never the file. */}
      {props.active && path && <input type="hidden" name="imagePath" value={path} />}

      {path && (
        <div className={styles.imagePreview}>
          {src ? (
            <img className={styles.imagePreviewImage} src={src} alt="The uploaded picture" />
          ) : (
            <span className={styles.imagePreviewBroken}>Picture uploaded</span>
          )}
        </div>
      )}

      <div className={styles.uploadRow}>
        {/* A <label> styled as a button opens the file picker. The input itself has no
            `name`, so the file is never sent with the form: it's already in Storage. */}
        <label className={`${styles.buttonSmallQuiet} ${styles.uploadButton}`}>
          <input
            className={styles.fileInput}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={handleChoose}
            disabled={status === "uploading"}
            aria-describedby={hintId}
          />
          {status === "uploading" ? "Uploading…" : path ? "Choose another picture" : "Choose a picture"}
        </label>
        {path && status !== "uploading" && (
          <button className={styles.buttonSmallQuiet} type="button" onClick={handleRemove}>
            Remove picture
          </button>
        )}
      </div>
      <span id={hintId} className={styles.hint}>
        JPEG, PNG, WebP, GIF or AVIF, up to {MAX_MB} MB. Only you can upload to your boards.
      </span>

      {status === "error" && (
        <p className={styles.formError} role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

/** The image address field, with a live preview of the picture. */
function AddressField({ initial, active = true }: { initial: string; active?: boolean }) {
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
          // No name while its tab is closed, so it isn't sent with the form.
          name={active ? "imageUrl" : undefined}
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
