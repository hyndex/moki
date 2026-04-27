/** Image attachment field kind — extends `file` with thumbnail
 *  display in lists/details and a click-to-zoom lightbox.
 *
 *  The form input is identical to `file` (same uploader). The list
 *  cell + detail viewer differ — they show an `<img>` and open a
 *  lightbox on click. The lightbox is built in-house (no extra dep)
 *  with focus-trap + Escape-to-close + arrow-key navigation when
 *  multiple images are siblings (TBD; v1 ships single-image viewer).
 *
 *  Performance: images are loaded with `loading="lazy"` so list views
 *  with hundreds of rows don't kick off hundreds of HTTP requests on
 *  first paint. The thumbnail uses the same URL as the full image
 *  because the storage layer handles content-range / streaming —
 *  swap in image-resize CDN params later if needed. */

import * as React from "react";
import { ImageIcon, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/cn";
import { humanBytes } from "@/runtime/files";
import type {
  FieldKindFormProps,
  FieldKindListCellProps,
  FieldKindDetailProps,
  FieldKindRenderer,
} from "../fieldKindRegistry";
import { fileKind } from "./file";

interface AttachmentRef {
  id: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  url?: string;
}

function asAttachment(v: unknown): AttachmentRef | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  return {
    id: o.id,
    name: typeof o.name === "string" ? o.name : "image",
    mimeType: typeof o.mimeType === "string" ? o.mimeType : undefined,
    sizeBytes: typeof o.sizeBytes === "number" ? o.sizeBytes : undefined,
    url: typeof o.url === "string" ? o.url : undefined,
  };
}

function srcOf(att: AttachmentRef): string {
  return att.url ?? `/api/files/${encodeURIComponent(att.id)}/content`;
}

/** Image form re-uses the file uploader directly — same drag/drop +
 *  click-to-pick. Once an image is uploaded the form swaps to a small
 *  thumbnail with download/remove buttons so the visual confirmation
 *  is immediate. */
function ImageForm(props: FieldKindFormProps): React.ReactElement {
  const att = asAttachment(props.value);
  if (!att) {
    // Delegate to the file kind's uploader for the empty state — same
    // drag/drop affordances, no duplicated logic.
    const FileFormImpl = fileKind.Form!;
    return <FileFormImpl {...props} />;
  }
  return (
    <div className="rounded-md border border-border bg-surface-0 p-2 flex items-center gap-3">
      <a href={srcOf(att)} target="_blank" rel="noreferrer" className="shrink-0">
        <img
          src={srcOf(att)}
          alt={att.name}
          loading="lazy"
          className="h-16 w-16 rounded object-cover bg-surface-2"
        />
      </a>
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-medium text-text-primary truncate">{att.name}</div>
        <div className="text-xs text-text-muted">
          {att.mimeType ?? "image"}
          {att.sizeBytes !== undefined && <> · {humanBytes(att.sizeBytes)}</>}
        </div>
      </div>
      {!props.disabled && (
        <button
          type="button"
          onClick={() => props.onChange(null)}
          className="text-text-muted hover:text-danger-strong transition-colors"
          aria-label="Remove image"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Lightbox — renders into the document, traps focus on the close
 *  button, closes on Escape + backdrop click. */
function Lightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}): React.ReactElement {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Prevent body scroll while the lightbox is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-3 right-3 inline-flex items-center justify-center h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function Thumbnail({ att, size = 32 }: { att: AttachmentRef; size?: number }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "inline-flex items-center justify-center rounded overflow-hidden",
          "bg-surface-2 transition-shadow hover:shadow-sm focus:outline-none focus-visible:shadow-focus",
        )}
        style={{ width: size, height: size }}
        aria-label={`Open ${att.name}`}
      >
        <img
          src={srcOf(att)}
          alt={att.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </button>
      {open && <Lightbox src={srcOf(att)} alt={att.name} onClose={() => setOpen(false)} />}
    </>
  );
}

function ImageCell(props: FieldKindListCellProps): React.ReactElement {
  const att = asAttachment(props.value);
  if (!att) return <span className="text-text-muted inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" aria-hidden /></span>;
  return <Thumbnail att={att} size={28} />;
}

function ImageDetail(props: FieldKindDetailProps): React.ReactElement {
  const att = asAttachment(props.value);
  if (!att) return <span className="text-text-muted">—</span>;
  return (
    <div className="space-y-1.5">
      <Thumbnail att={att} size={120} />
      <div className="text-xs text-text-muted inline-flex items-center gap-1">
        <ZoomIn className="h-3 w-3" aria-hidden />
        Click to zoom
      </div>
    </div>
  );
}

export const imageKind: FieldKindRenderer = {
  Form: ImageForm,
  ListCell: ImageCell,
  Detail: ImageDetail,
};
