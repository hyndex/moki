/** Model Context Protocol — wire types we implement.
 *
 *  MCP is JSON-RPC 2.0 over a transport (HTTP, stdio, SSE). The full
 *  spec is large; we implement the production-critical subset:
 *
 *    Lifecycle:    initialize, ping
 *    Tools:        tools/list, tools/call
 *    Resources:    resources/list, resources/read
 *    Notifications: notifications/initialized, notifications/cancelled
 *
 *  Sampling, prompts, logging/setLevel, and server-initiated notifications
 *  are deliberately deferred to a later tier (T4) since they require
 *  bidirectional transport semantics that complicate the security
 *  model. */

export const MCP_PROTOCOL_VERSION = "2024-11-05";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcSuccess<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  result: T;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse<T = unknown> = JsonRpcSuccess<T> | JsonRpcError;

/** JSON-RPC error codes the spec carves out. */
export const ERR_PARSE = -32700;
export const ERR_INVALID_REQUEST = -32600;
export const ERR_METHOD_NOT_FOUND = -32601;
export const ERR_INVALID_PARAMS = -32602;
export const ERR_INTERNAL = -32603;
/** MCP-domain error codes (>= -32000). */
export const ERR_UNAUTHORIZED = -32001;
export const ERR_FORBIDDEN = -32002;
export const ERR_RATE_LIMITED = -32003;
export const ERR_RISK_BLOCKED = -32004;
export const ERR_NOT_FOUND = -32005;
export const ERR_CIRCUIT_OPEN = -32006;
export const ERR_BUDGET_EXCEEDED = -32007;
export const ERR_IDEMPOTENCY_REPLAY = -32008;

/* ---- initialize ------------------------------------------------- */

export interface InitializeParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: { name: string; version?: string };
}

export interface ClientCapabilities {
  /** Reserved for future client-side capabilities (sampling, etc.). */
  experimental?: Record<string, unknown>;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: { name: string; version: string };
  /** When the agent's token grants explicit `instructions`, returned
   *  here so a smart client can prepend them to its system prompt. */
  instructions?: string;
}

export interface ServerCapabilities {
  /** Tools the server exposes. listChanged means the server can emit
   *  notifications/tools/list_changed (we don't yet — set false). */
  tools?: { listChanged: false };
  /** Resources the server exposes. */
  resources?: { listChanged: false; subscribe: false };
  /** Logging the server emits to the client. We log via audit, not
   *  client-pushed log records, so omitted. */
}

/* ---- tools ------------------------------------------------------ */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
  /** Non-spec — annotation that flows up to the client when supported,
   *  letting smart agents decide whether to require human confirmation. */
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

export interface ToolsListResult {
  tools: ToolDefinition[];
  /** Pagination cursor. We don't paginate yet (most plugins have <50
   *  tools), but the field is part of the spec. */
  nextCursor?: string;
}

export interface ToolsCallParams {
  name: string;
  arguments?: Record<string, unknown>;
  /** Caller-supplied progress token; we echo it back if streaming. */
  _meta?: { progressToken?: string | number };
}

/** Content block returned from a tool call. The spec supports text,
 *  image, embedded resource, and audio. We only emit text + resource
 *  for now; image/audio land when we wire the storage layer up. */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource"; resource: { uri: string; mimeType?: string; text?: string } };

export interface ToolsCallResult {
  content: ContentBlock[];
  /** When true, the client should treat the call as failed even though
   *  the JSON-RPC envelope succeeded. Used for "couldn't find that
   *  record" type domain errors that aren't transport failures. */
  isError?: boolean;
  /** Echoed metadata. */
  _meta?: Record<string, unknown>;
}

/* ---- resources -------------------------------------------------- */

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourcesListResult {
  resources: Resource[];
  nextCursor?: string;
}

export interface ResourcesReadParams {
  uri: string;
}

export interface ResourcesReadResult {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string; // base64
  }>;
}
