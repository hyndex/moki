/** Video + Audio field kinds — built on the same attachment storage
 *  contract as `file` / `image`, surfaced through HTML5 native
 *  `<video>` and `<audio>` elements with proper controls.
 *
 *  Why native: the framework targets evergreen browsers; HTML5 covers
 *  MP4 / WebM / Ogg / WAV / MP3 / M4A / AAC out of the box. HLS is
 *  the only common gap — operators who need it can register their own
 *  renderer that uses `hls.js` lazily (same pattern as the Yjs
 *  adapter).
 *
 *  Form: identical uploader to `file`. List: shows a "▶ play" link
 *  with the file name. Detail: full inline player with native
 *  controls. The detail viewer keeps the player non-autoplaying — the
 *  framework never plays media without user gesture (browser
 *  autoplay policies + accessibility). */

import * as React from "react";
import { Play, Music, Video as VideoIcon } from "lucide-react";
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
    name: typeof o.name === "string" ? o.name : "media",
    mimeType: typeof o.mimeType === "string" ? o.mimeType : undefined,
    sizeBytes: typeof o.sizeBytes === "number" ? o.sizeBytes : undefined,
    url: typeof o.url === "string" ? o.url : undefined,
  };
}

function srcOf(att: AttachmentRef): string {
  return att.url ?? `/api/files/${encodeURIComponent(att.id)}/content`;
}

function MediaForm(props: FieldKindFormProps): React.ReactElement {
  // Re-use the file kind's uploader for the empty + populated states
  // — the *display* of populated state below the uploader switches to
  // a media player once the user has uploaded a file.
  const att = asAttachment(props.value);
  if (!att) {
    const Form = fileKind.Form!;
    return <Form {...props} />;
  }
  const isVideo = props.field.kind === "video" || (att.mimeType ?? "").startsWith("video/");
  const isAudio = props.field.kind === "audio" || (att.mimeType ?? "").startsWith("audio/");
  return (
    <div className="rounded-md border border-border bg-surface-0 p-2 space-y-2">
      {isVideo && (
        <video
          src={srcOf(att)}
          controls
          preload="metadata"
          className="w-full max-h-72 rounded bg-black"
          aria-label={att.name}
        />
      )}
      {isAudio && (
        <audio
          src={srcOf(att)}
          controls
          preload="metadata"
          className="w-full"
          aria-label={att.name}
        />
      )}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className="truncate flex-1">{att.name}</span>
        {att.sizeBytes !== undefined && <span className="tabular-nums">{humanBytes(att.sizeBytes)}</span>}
        {!props.disabled && (
          <button
            type="button"
            onClick={() => props.onChange(null)}
            className="text-text-muted hover:text-danger-strong transition-colors"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function VideoCell(props: FieldKindListCellProps): React.ReactElement {
  const att = asAttachment(props.value);
  if (!att) return <span className="text-text-muted">—</span>;
  return (
    <a
      href={srcOf(att)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-info hover:text-info-strong text-xs"
    >
      <VideoIcon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate max-w-[160px]">{att.name}</span>
      <Play className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
    </a>
  );
}

function AudioCell(props: FieldKindListCellProps): React.ReactElement {
  const att = asAttachment(props.value);
  if (!att) return <span className="text-text-muted">—</span>;
  return (
    <a
      href={srcOf(att)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-info hover:text-info-strong text-xs"
    >
      <Music className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate max-w-[160px]">{att.name}</span>
    </a>
  );
}

function VideoDetail(props: FieldKindDetailProps): React.ReactElement {
  const att = asAttachment(props.value);
  if (!att) return <span className="text-text-muted">—</span>;
  return (
    <video
      src={srcOf(att)}
      controls
      preload="metadata"
      className="w-full max-h-96 rounded-md border border-border bg-black"
      aria-label={att.name}
    />
  );
}

function AudioDetail(props: FieldKindDetailProps): React.ReactElement {
  const att = asAttachment(props.value);
  if (!att) return <span className="text-text-muted">—</span>;
  return (
    <audio
      src={srcOf(att)}
      controls
      preload="metadata"
      className="w-full"
      aria-label={att.name}
    />
  );
}

export const videoKind: FieldKindRenderer = {
  Form: MediaForm,
  ListCell: VideoCell,
  Detail: VideoDetail,
};

export const audioKind: FieldKindRenderer = {
  Form: MediaForm,
  ListCell: AudioCell,
  Detail: AudioDetail,
};
