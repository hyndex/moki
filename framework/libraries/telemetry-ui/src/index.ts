import type { ShellKind, ShellProviderContract, ShellTelemetryEvent } from "@platform/ui-shell";

export const packageId = "telemetry-ui" as const;
export const packageDisplayName = "Telemetry UI" as const;
export const packageDescription = "UI telemetry helpers for page views, actions, widgets, and command palette flows." as const;

export type UiTelemetryInput = {
  namespace: string;
  name: string;
  route: string;
  shell?: ShellKind | undefined;
  detail?: string | undefined;
};

export function createUiTelemetryEvent(input: UiTelemetryInput): ShellTelemetryEvent {
  return {
    at: new Date().toISOString(),
    namespace: input.namespace,
    name: input.name,
    route: input.route,
    shell: input.shell ?? "admin",
    dimensions: input.detail ? { detail: input.detail } : undefined
  };
}

export function trackPageView(
  providers: ShellProviderContract,
  route: string,
  detail?: string,
  shell: ShellKind = "admin"
): ShellTelemetryEvent {
  return providers.telemetry.track(
    createUiTelemetryEvent({
      namespace: "ui.page",
      name: "page_view",
      route,
      detail,
      shell
    })
  );
}

export function trackUiAction(
  providers: ShellProviderContract,
  input: {
    route: string;
    action: string;
    shell?: ShellKind;
    detail?: string;
  }
): ShellTelemetryEvent {
  return providers.telemetry.track(
    createUiTelemetryEvent({
      namespace: "ui.action",
      name: input.action,
      route: input.route,
      shell: input.shell,
      detail: input.detail
    })
  );
}

export function trackWidgetView(
  providers: ShellProviderContract,
  input: {
    route: string;
    widgetId: string;
    shell?: ShellKind;
  }
): ShellTelemetryEvent {
  return providers.telemetry.track(
    createUiTelemetryEvent({
      namespace: "ui.widget",
      name: "widget_view",
      route: input.route,
      shell: input.shell,
      detail: input.widgetId
    })
  );
}

export function trackCommandPalette(
  providers: ShellProviderContract,
  input: {
    route: string;
    query: string;
    shell?: ShellKind;
  }
): ShellTelemetryEvent {
  return providers.telemetry.track(
    createUiTelemetryEvent({
      namespace: "ui.command-palette",
      name: "command_palette_open",
      route: input.route,
      shell: input.shell,
      detail: input.query
    })
  );
}
