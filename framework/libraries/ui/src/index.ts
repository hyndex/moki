import { format, formatDistanceToNowStrict, isValid } from "date-fns";
import * as LucideIcons from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";
import React from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

export const packageId = "ui" as const;
export const packageDisplayName = "UI" as const;
export const packageDescription = "Canonical admin UI wrapper surface over shared shell primitives." as const;

export * from "@platform/ui-kit";

const dynamicLucideRegistry = LucideIcons as unknown as Record<string, LucideIcon | undefined>;
const fallbackLucideIcon = dynamicLucideRegistry.Square ?? dynamicLucideRegistry.Circle ?? LucideIcons.Circle;
const iconAliasMap = {
  "layout-grid": "LayoutGrid",
  "bar-chart-3": "BarChart3",
  inbox: "Inbox",
  activity: "Activity",
  "file-output": "FileOutput",
  "layout-panel-top": "LayoutPanelTop",
  "chart-line": "ChartLine",
  cpu: "Cpu",
  "shield-check": "ShieldCheck",
  users: "Users",
  wrench: "Wrench",
  "layout-template": "LayoutTemplate",
  search: "Search",
  bell: "Bell",
  settings: "Settings",
  home: "House",
  help: "CircleHelp",
  warning: "TriangleAlert",
  success: "BadgeCheck"
} as const satisfies Record<string, string>;

const iconOverrides = new Map<string, LucideIcon>();

export type PlatformIconName = string;
export type PlatformToastIntent = "success" | "error" | "info" | "warning";
export type PlatformToastRecord = {
  title: string;
  description?: string | undefined;
  intent?: PlatformToastIntent | undefined;
};

export type PlatformToastDispatcher = (toast: PlatformToastRecord) => void;
export type PlatformToastController = {
  success(input: Omit<PlatformToastRecord, "intent">): void;
  error(input: Omit<PlatformToastRecord, "intent">): void;
  info(input: Omit<PlatformToastRecord, "intent">): void;
  warning(input: Omit<PlatformToastRecord, "intent">): void;
  show(input: PlatformToastRecord): void;
};

export type MemoryToastDispatcher = {
  history: PlatformToastRecord[];
  dispatch: PlatformToastDispatcher;
};

export function registerPlatformIcon(name: string, icon: LucideIcon): void {
  iconOverrides.set(name, icon);
}

export function resolvePlatformIcon(name?: PlatformIconName): LucideIcon {
  if (!name) {
    return fallbackLucideIcon;
  }

  const override = iconOverrides.get(name);
  if (override) {
    return override;
  }

  const alias = iconAliasMap[name as keyof typeof iconAliasMap];
  const aliasIcon = alias ? dynamicLucideRegistry[alias] : undefined;
  if (aliasIcon) {
    return aliasIcon;
  }

  const exportName = name
    .split(/[-_\s]+/g)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join("");

  return dynamicLucideRegistry[exportName] ?? fallbackLucideIcon;
}

export function PlatformIcon(props: LucideProps & { name?: PlatformIconName | undefined }) {
  const { name, ...iconProps } = props;
  const IconComponent = resolvePlatformIcon(name);
  return React.createElement(IconComponent, iconProps);
}

export function createMemoryToastDispatcher(initialHistory: PlatformToastRecord[] = []): MemoryToastDispatcher {
  const history = [...initialHistory];
  return {
    history,
    dispatch(toast) {
      history.push({
        ...toast
      });
    }
  };
}

export function createToastController(dispatch: PlatformToastDispatcher = dispatchPlatformToast): PlatformToastController {
  return {
    success(input) {
      dispatch({
        ...input,
        intent: "success"
      });
    },
    error(input) {
      dispatch({
        ...input,
        intent: "error"
      });
    },
    info(input) {
      dispatch({
        ...input,
        intent: "info"
      });
    },
    warning(input) {
      dispatch({
        ...input,
        intent: "warning"
      });
    },
    show(input) {
      dispatch(input);
    }
  };
}

export function dispatchPlatformToast(input: PlatformToastRecord): void {
  const message = input.description ? `${input.title}: ${input.description}` : input.title;
  if (input.intent === "success") {
    sonnerToast.success(message);
    return;
  }
  if (input.intent === "error") {
    sonnerToast.error(message);
    return;
  }
  if (input.intent === "warning") {
    sonnerToast.warning(message);
    return;
  }
  sonnerToast(message);
}

export function PlatformToaster(props: {
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right" | undefined;
}) {
  return React.createElement(SonnerToaster, {
    closeButton: true,
    richColors: true,
    position: props.position ?? "top-right"
  });
}

export function ToastStack(props: {
  toasts: PlatformToastRecord[];
}) {
  if (props.toasts.length === 0) {
    return null;
  }

  return React.createElement(
    "div",
    {
      className: "awb-notice-list",
      "data-testid": "toast-stack"
    },
    props.toasts.map((toast, index) =>
      React.createElement(
        "section",
        {
          key: `${toast.title}:${index}`,
          className: "awb-notice-card"
        },
        React.createElement("div", { className: "awb-panel-title" }, toast.title),
        toast.description ? React.createElement("p", { className: "awb-muted-copy" }, toast.description) : null,
        toast.intent ? React.createElement("span", { className: "awb-pill" }, toast.intent) : null
      )
    )
  );
}

export function LoadingState(props: {
  title?: string | undefined;
  description?: string | undefined;
}) {
  return React.createElement(
    "section",
    {
      className: "awb-empty-state",
      "data-testid": "ui-loading-state"
    },
    React.createElement("h2", { className: "awb-panel-title" }, props.title ?? "Loading"),
    React.createElement("p", { className: "awb-muted-copy" }, props.description ?? "Preparing governed admin surfaces.")
  );
}

export function ErrorState(props: {
  title?: string | undefined;
  description: string;
}) {
  return React.createElement(
    "section",
    {
      className: "awb-empty-state",
      "data-testid": "ui-error-state"
    },
    React.createElement("h2", { className: "awb-panel-title" }, props.title ?? "Something needs attention"),
    React.createElement("p", { className: "awb-muted-copy" }, props.description)
  );
}

export function formatPlatformDate(value: string | number | Date, pattern = "dd MMM yyyy"): string {
  const date = toValidDate(value);
  return date ? format(date, pattern) : "Unknown date";
}

export function formatPlatformDateTime(value: string | number | Date, pattern = "dd MMM yyyy, HH:mm"): string {
  const date = toValidDate(value);
  return date ? format(date, pattern) : "Unknown time";
}

export function formatPlatformRelativeTime(value: string | number | Date): string {
  const date = toValidDate(value);
  return date ? formatDistanceToNowStrict(date, { addSuffix: true }) : "recently";
}

function toValidDate(value: string | number | Date): Date | undefined {
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : undefined;
}
