/** Frontend mirror of the contract from `gutu-lib-editor-bridge`. The
 *  shell embeds the bridge directly here so the admin-panel doesn't pull in
 *  the workspace-only `@platform/editor-bridge` resolver. */

export type EditorKind = "spreadsheet" | "document" | "slides" | "page" | "whiteboard";

export interface EditorRecord {
  id: string;
  tenantId: string;
  title: string;
  folder?: string;
  slug?: string;
  parentId?: string | null;
  createdBy: string;
  status: "active" | "archived" | "template" | "deleted";
  exportAdapter?: string;
  exportObjectKey?: string;
  yjsAdapter?: string;
  yjsObjectKey?: string;
  htmlAdapter?: string;
  htmlObjectKey?: string;
  thumbnailAdapter?: string;
  thumbnailObjectKey?: string;
  summary?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EditorPresence {
  clientId: number;
  user: { id: string; name: string; color: string; avatarUrl?: string };
  cursor?: unknown;
  lastSeen: number;
}
