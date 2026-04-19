import { Slot } from "@radix-ui/react-slot";
import clsx, { type ClassValue } from "clsx";
import React from "react";
import { twMerge } from "tailwind-merge";

export const packageId = "ui-kit" as const;
export const packageDisplayName = "UI Kit" as const;
export const packageDescription = "Shared Radix and shell primitives." as const;

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function PageSection(props: React.HTMLAttributes<HTMLElement>) {
  const { className, ...rest } = props;
  return React.createElement("section", {
    ...rest,
    className: cn("awb-section", className)
  });
}

export function MetricCard(props: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "positive" | "warning";
}) {
  const toneClass =
    props.tone === "positive"
      ? "awb-tone-positive"
      : props.tone === "warning"
        ? "awb-tone-warning"
        : "awb-tone-default";

  return (
    React.createElement(
      "div",
      { className: cn("awb-metric-card", toneClass) },
      React.createElement("div", { className: "awb-metric-label" }, props.label),
      React.createElement("div", { className: "awb-metric-value" }, props.value)
    )
  );
}

export function ObjectHeader(props: {
  title: string;
  subtitle?: string | undefined;
  actions?: React.ReactNode | undefined;
}) {
  return React.createElement(
    "header",
    { className: "awb-object-header" },
    React.createElement(
      "div",
      { className: "awb-object-copy" },
      React.createElement("h1", { className: "awb-object-title" }, props.title),
      props.subtitle ? React.createElement("p", { className: "awb-object-subtitle" }, props.subtitle) : null
    ),
    props.actions ? React.createElement("div", { className: "awb-object-actions" }, props.actions) : null
  );
}

export function FilterBar(props: {
  children?: React.ReactNode;
  summary?: string | undefined;
}) {
  return React.createElement(
    "div",
    { className: "awb-filter-bar" },
    props.summary ? React.createElement("span", { className: "awb-filter-summary" }, props.summary) : null,
    props.children
  );
}

export function SavedViewSelector(props: {
  views: Array<{ id: string; label: string; active?: boolean | undefined }>;
}) {
  return React.createElement(
    "nav",
    {
      "aria-label": "Saved views",
      className: "awb-saved-view-nav"
    },
    props.views.map((view) =>
      React.createElement(
        "span",
        {
          key: view.id,
          className: cn("awb-saved-view-chip", view.active ? "is-active" : "is-inactive")
        },
        view.label
      )
    )
  );
}

export function TimelinePanel(props: {
  entries: Array<{ id: string; title: string; detail?: string | undefined; at: string }>;
}) {
  return React.createElement(
    "aside",
    { className: "awb-timeline-panel" },
    React.createElement("h2", { className: "awb-panel-kicker" }, "Timeline"),
    React.createElement(
      "ol",
      { className: "awb-timeline-list" },
      props.entries.map((entry) =>
        React.createElement(
          "li",
          { key: entry.id, className: "awb-timeline-entry" },
          React.createElement("div", { className: "awb-timeline-title" }, entry.title),
          entry.detail ? React.createElement("div", { className: "awb-timeline-detail" }, entry.detail) : null,
          React.createElement("time", { className: "awb-timeline-time" }, entry.at)
        )
      )
    )
  );
}

export function CommandDialog(props: {
  query: string;
  items: Array<{ id: string; label: string; hint?: string | undefined }>;
}) {
  return React.createElement(
    "section",
    {
      className: "awb-command-dialog",
      "data-testid": "command-dialog"
    },
    React.createElement("div", { className: "awb-command-kicker" }, "Command Palette"),
    React.createElement(
      "div",
      { className: "awb-command-query" },
      props.query || "Type a command or jump target"
    ),
    React.createElement(
      "ul",
      { className: "awb-command-list" },
      props.items.map((item) =>
        React.createElement(
          "li",
          { key: item.id, className: "awb-command-item" },
          React.createElement("div", { className: "awb-command-label" }, item.label),
          item.hint ? React.createElement("div", { className: "awb-command-hint" }, item.hint) : null
        )
      )
    )
  );
}

export function WizardStepper(props: {
  steps: Array<{ id: string; label: string; status: "pending" | "current" | "complete" }>;
}) {
  return React.createElement(
    "ol",
    { className: "awb-wizard-stepper" },
    props.steps.map((step) =>
      React.createElement(
        "li",
        {
          key: step.id,
          className: cn("awb-step-chip", `is-${step.status}`)
        },
        step.label
      )
    )
  );
}

export function DrawerInspector(props: {
  title: string;
  children?: React.ReactNode;
}) {
  return React.createElement(
    "aside",
    { className: "awb-drawer-inspector" },
    React.createElement("h2", { className: "awb-panel-title" }, props.title),
    props.children
  );
}

export function BulkActionBar(props: {
  selectedCount: number;
  actions: React.ReactNode;
}) {
  return React.createElement(
    "div",
    {
      className: "awb-bulk-action-bar",
      "data-testid": "bulk-action-bar"
    },
    React.createElement("span", { className: "awb-bulk-label" }, `${props.selectedCount} selected`),
    React.createElement("div", { className: "awb-bulk-actions" }, props.actions)
  );
}

export function PermissionBoundary(props: {
  grants: string[];
  require: string;
  children?: React.ReactNode;
  fallback?: React.ReactNode | undefined;
}) {
  return React.createElement(
    React.Fragment,
    null,
    props.grants.includes(props.require) ? props.children : (props.fallback ?? null)
  );
}

export function Primitive(props: React.ComponentProps<typeof Slot>) {
  return React.createElement(Slot, props);
}
