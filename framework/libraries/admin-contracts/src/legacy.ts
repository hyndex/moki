import type { UiRegistry } from "@platform/ui-shell";

import { defineAdminNav, definePage, defineWidget, defineWorkspace, defineZoneLaunch } from "./registry";
import type { AdminNavContribution, LegacyUiAdapterResult, PageContribution, WorkspaceContribution } from "./types";

export function adaptLegacyUiRegistry(source: UiRegistry): LegacyUiAdapterResult {
  const pages: PageContribution[] = [];
  const widgets = source.widgets
    .filter((widget) => widget.shell === "admin")
    .map((widget) =>
      defineWidget({
        id: `legacy.widget.${widget.slot.replaceAll(/[/.:-]+/g, "_")}`,
        kind: inferWidgetKind(widget.slot),
        shell: "admin",
        slot: widget.slot,
        permission: widget.permission,
        title: humanizeSlug(lastSegment(widget.slot)),
        component: widget.component
      })
    );

  const workspaceMap = new Map<string, WorkspaceContribution>();
  const navBuckets = new Map<string, AdminNavContribution>();

  for (const entry of source.embeddedPages) {
    if (entry.shell !== "admin" || !entry.route.startsWith("/admin")) {
      continue;
    }

    const workspaceId = inferWorkspaceId(entry.route);
    const groupId = inferGroupId(entry.route);
    const page = definePage({
      id: `legacy.page.${toStableId(entry.route)}`,
      kind: inferPageKind(entry.route),
      route: entry.route,
      label: humanizeSlug(lastStaticAdminSegment(entry.route)),
      workspace: workspaceId,
      group: groupId,
      permission: entry.permission,
      component: entry.component
    });
    pages.push(page);

    if (!workspaceMap.has(workspaceId)) {
      workspaceMap.set(
        workspaceId,
        defineWorkspace({
          id: workspaceId,
          label: humanizeSlug(workspaceId),
          icon: workspaceId === "reports" ? "bar-chart-3" : workspaceId === "tools" ? "wrench" : "layout-grid",
          permission: entry.permission,
          homePath: `/admin/workspace/${workspaceId}`
        })
      );
    }

    const bucketKey = `${workspaceId}:${groupId}`;
    const existing = navBuckets.get(bucketKey);
    const navItem = {
      id: `legacy.nav.${toStableId(entry.route)}`,
      label: page.label,
      to: entry.route,
      permission: entry.permission
    };

    navBuckets.set(
      bucketKey,
      defineAdminNav({
        workspace: workspaceId,
        group: groupId,
        items: [...(existing?.items ?? []), navItem]
      })
    );
  }

  const zoneLaunchers = source.zones
    .filter((zone) => zone.mountPath.startsWith("/apps/"))
    .map((zone) =>
      defineZoneLaunch({
        id: `legacy.zone.${toStableId(zone.id)}`,
        zoneId: zone.id,
        route: zone.mountPath,
        label: humanizeSlug(lastSegment(zone.mountPath)),
        permission: "ui.zone.mount",
        workspace: "tools",
        group: "zones",
        description: `Legacy zone launcher for ${zone.id}`
      })
    );

  if (zoneLaunchers.length > 0 && !workspaceMap.has("tools")) {
    workspaceMap.set(
      "tools",
      defineWorkspace({
        id: "tools",
        label: "Tools",
        icon: "wrench",
        permission: "ui.zone.mount",
        homePath: "/admin/workspace/tools"
      })
    );
  }

  return {
    source,
    workspaces: [...workspaceMap.values()].sort((left, right) => left.id.localeCompare(right.id)),
    nav: [...navBuckets.values()].sort((left, right) => {
      const leftKey = `${left.workspace}:${left.group}`;
      const rightKey = `${right.workspace}:${right.group}`;
      return leftKey.localeCompare(rightKey);
    }),
    pages: pages.sort((left, right) => left.route.localeCompare(right.route)),
    widgets,
    zoneLaunchers
  };
}

function inferWorkspaceId(route: string): string {
  const segments = route.split("/").filter(Boolean);
  if (segments[1] === "reports") {
    return "reports";
  }
  if (segments[1] === "tools") {
    return "tools";
  }
  return segments[1] ?? "home";
}

function inferGroupId(route: string): string {
  const segments = route.split("/").filter(Boolean);
  if (segments[1] === "reports") {
    return "saved-reports";
  }
  if (segments[1] === "tools") {
    return "builders";
  }
  return segments[2] ?? "overview";
}

function inferPageKind(route: string): PageContribution["kind"] {
  if (route.startsWith("/admin/reports")) {
    return "report";
  }
  if (route.startsWith("/admin/tools")) {
    return "builder";
  }
  if (route.endsWith("/edit")) {
    return "form";
  }
  if (route.includes("/:")) {
    return "detail";
  }
  if (route === "/admin" || route.endsWith("/dashboard") || route.includes("dashboard")) {
    return "dashboard";
  }
  return "list";
}

function inferWidgetKind(slot: string) {
  if (slot.includes("dashboard")) {
    return "kpi" as const;
  }
  if (slot.includes("activity")) {
    return "activity" as const;
  }
  return "custom" as const;
}

function lastSegment(input: string): string {
  const segments = input.split("/").filter(Boolean);
  return segments.at(-1) ?? input;
}

function lastStaticAdminSegment(route: string): string {
  const segments = route.split("/").filter(Boolean).filter((segment) => !segment.startsWith(":"));
  return segments.at(-1) ?? "page";
}

function humanizeSlug(value: string): string {
  return value
    .replaceAll(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function toStableId(value: string): string {
  return value.replaceAll(/[/:.-]+/g, "_").replaceAll(/^_+|_+$/g, "");
}
