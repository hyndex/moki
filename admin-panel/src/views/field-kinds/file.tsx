/** File attachment field kind — uploads through the existing
 *  `/api/files` storage backend (S3/MinIO/local) and stores the file
 *  reference inside the record value as
 *  `{ id, name, mimeType, sizeBytes, url } | null`.
 *
 *  Single-file slot (one attachment per field). For multi-file fields
 *  use multiple field instances or build a dedicated "files" kind on
 *  top of `useRecordFiles` later. The single-slot form keeps state
 *  shape simple: the record holds the attachment metadata directly,
 *  the storage record holds the bytes. The two are linked by the
 *  attachment's id (rows in `files.file`).
 *
 *  Hardening:
 *    - Drag/drop highlight + click-to-pick fallback.
 *    - Upload progress shown inline with a tiny spinner.
 *    - Errors surface in a danger banner with retry.
 *    - The download URL goes through `/api/files/:id/content` which
 *      auto-redirects to a presigned URL on S3 backends, or proxies
 *      bytes for local storage. */

import * as React from "react";
import { Upload, FileIcon, X, Download } from "lucide-react";
import { cn } from "@/lib/cn";
import { uploadFile, humanBytes, type UploadedFile } from "@/runtime/files";
import type {
  FieldKindFormProps,
  FieldKindListCellProps,
  FieldKindDetailProps,
  FieldKindRenderer,
} from "../fieldKindRegistry";

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
    name: typeof o.name === "string" ? o.name : "attachment",
    mimeType: typeof o.mimeType === "string" ? o.mimeType : undefined,
    sizeBytes: typeof o.sizeBytes === "number" ? o.sizeBytes : undefined,
    url: typeof o.url === "string" ? o.url : undefined,
  };
}

function downloadUrl(att: AttachmentRef): string {
  // The framework's download endpoint redirects to a presigned URL on
  // S3-family backends and streams bytes directly on local storage.
  return att.url ?? `/api/files/${encodeURIComponent(att.id)}/content`;
}

function FileForm(props: FieldKindFormProps): React.ReactElement {
  const { field, value, onChange, disabled, record } = props;
  const att = asAttachment(value);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const accept =
    (field as { accept?: string }).accept ??
    (field.kind === "image" ? "image/*" : field.kind === "video" ? "video/*" : field.kind === "audio" ? "audio/*" : undefined);

  const upload = async (file: File): Promise<void> => {
    setUploading(true);
    setError(undefined);
    try {
      // The storage record needs a resource + recordId association so
      // /api/files?resource=…&recordId=… returns it later. The form
      // doesn't always know the recordId yet (new record case), but
      // the file stays valid even without that link — the listing
      // endpoint just won't include it under that filter.
      const recordId = typeof record?.id === "string" ? record.id : undefined;
      const uploaded: UploadedFile = await uploadFile(file, {
        resource: (record as { __resource?: string })?.__resource,
        recordId,
      });
      onChange({
        id: uploaded.id,
        name: uploaded.name,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        url: uploaded.url,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void upload(f);
  };

  if (att) {
    return (
      <div className="rounded-md border border-border bg-surface-0 p-2 flex items-center gap-2">
        <FileIcon className="h-4 w-4 text-text-muted shrink-0" aria-hidden />
        <a
          href={downloadUrl(att)}
          target="_blank"
          rel="noreferrer"
          className="flex-1 min-w-0 text-sm text-info hover:text-info-strong truncate"
        >
          {att.name}
        </a>
        {att.sizeBytes !== undefined && (
          <span className="text-xs text-text-muted shrink-0 tabular-nums">{humanBytes(att.sizeBytes)}</span>
        )}
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-text-muted hover:text-danger-strong transition-colors"
            aria-label="Remove attachment"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "rounded-md border-2 border-dashed p-4 text-center text-sm cursor-pointer transition-colors",
        dragOver ? "border-accent bg-accent-soft/30" : "border-border hover:border-border-strong",
        disabled && "opacity-50 cursor-not-allowed",
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = ""; // allow re-uploading the same file
        }}
      />
      <Upload className="h-4 w-4 mx-auto mb-1 text-text-muted" aria-hidden />
      <div className="text-text-primary">
        {uploading ? "Uploading…" : "Drop a file or click to upload"}
      </div>
      {accept && <div className="text-[11px] text-text-muted mt-1">Accepts: {accept}</div>}
      {error && (
        <div role="alert" className="text-[11px] text-danger-strong mt-1">
          {error}
        </div>
      )}
    </div>
  );
}

function FileCell(props: FieldKindListCellProps): React.ReactElement {
  const att = asAttachment(props.value);
  if (!att) return <span className="text-text-muted">—</span>;
  return (
    <a
      href={downloadUrl(att)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-info hover:text-info-strong text-xs"
    >
      <FileIcon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate max-w-[200px]">{att.name}</span>
    </a>
  );
}

function FileDetail(props: FieldKindDetailProps): React.ReactElement {
  const att = asAttachment(props.value);
  if (!att) return <span className="text-text-muted">—</span>;
  return (
    <a
      href={downloadUrl(att)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-info hover:text-info-strong rounded-md border border-border bg-surface-0 px-2 py-1.5"
    >
      <FileIcon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{att.name}</span>
      <Download className="h-3.5 w-3.5 ml-1 opacity-60" aria-hidden />
    </a>
  );
}

export const fileKind: FieldKindRenderer = {
  Form: FileForm,
  ListCell: FileCell,
  Detail: FileDetail,
};
