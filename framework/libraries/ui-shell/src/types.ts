import type React from "react";

export type ShellKind = "admin" | "portal" | "site";

export type EmbeddedPageRegistration = {
  shell: ShellKind;
  route: string;
  component: React.ComponentType;
  permission: string;
};

export type WidgetRegistration = {
  shell: ShellKind;
  slot: string;
  component: React.ComponentType;
  permission: string;
};

export type ZoneDefinition = {
  id: string;
  adapter: string;
  mountPath: string;
  assetPrefix: string;
  authMode: "platform-session" | "zone-session";
  telemetryNamespace: string;
  deepLinks: string[];
  routeOwnership: string[];
  sizeBudget?: number;
  featureFlags?: string[];
};

export type UiSurfaceDefinition = {
  embeddedPages: EmbeddedPageRegistration[];
  widgets: WidgetRegistration[];
};

export type UiRegistry = {
  embeddedPages: EmbeddedPageRegistration[];
  widgets: WidgetRegistration[];
  zones: ZoneDefinition[];
};

export type SessionSnapshot = {
  sessionId: string;
  tenantId: string;
  actorId: string;
  userId?: string | undefined;
  claims: string[];
};

export type PermissionIntrospector = {
  granted: string[];
  has(permission: string): boolean;
  hasEvery(permissions: string[]): boolean;
  hasSome(permissions: string[]): boolean;
};

export type DesignTokens = Record<string, string>;

export type ShellAuditEvent = {
  type: string;
  shell: ShellKind;
  route: string;
  tenantId?: string | undefined;
  actorId?: string | undefined;
  details?: Record<string, unknown> | undefined;
  at: string;
};

export type ShellTelemetryEvent = {
  name: string;
  shell: ShellKind;
  route: string;
  namespace: string;
  dimensions?: Record<string, string | number | boolean> | undefined;
  at: string;
};

export type CommandEnvelope = {
  type: string;
  payload?: Record<string, unknown> | undefined;
  target?: string | undefined;
};

export type NotificationEnvelope = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
};

export type ShellEventBus<TEvent> = {
  publish(event: TEvent): TEvent;
  subscribe(listener: (event: TEvent) => void): () => void;
};

export type NavigationTarget = {
  kind: "embedded-page" | "zone";
  href: string;
  sourceId: string;
  shell?: ShellKind | undefined;
  permission?: string | undefined;
  telemetryNamespace?: string | undefined;
  authMode?: ZoneDefinition["authMode"] | undefined;
};

export type ShellNavigationContract = {
  deepLinks: string[];
  resolve(href: string): NavigationTarget | undefined;
};

export type ShellAuditHook = {
  history: ShellAuditEvent[];
  record(event: Omit<ShellAuditEvent, "at"> & Partial<Pick<ShellAuditEvent, "at">>): ShellAuditEvent;
};

export type ShellTelemetryHook = {
  history: ShellTelemetryEvent[];
  track(event: Omit<ShellTelemetryEvent, "at"> & Partial<Pick<ShellTelemetryEvent, "at">>): ShellTelemetryEvent;
};

export type ShellProviderContract = {
  session: SessionSnapshot;
  permissions: PermissionIntrospector;
  designTokens: DesignTokens;
  navigation: ShellNavigationContract;
  audit: ShellAuditHook;
  telemetry: ShellTelemetryHook;
  commandBus: ShellEventBus<CommandEnvelope>;
  notificationBus: ShellEventBus<NotificationEnvelope>;
};
