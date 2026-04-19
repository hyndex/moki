import type {
  AdminContributionRegistry,
  AdminNavContribution,
  BuilderContribution,
  CommandContribution,
  PageContribution,
  ReportContribution,
  SearchContribution,
  WidgetContribution,
  WorkspaceContribution,
  ZoneLaunchContribution
} from "./types";

export function defineWorkspace(definition: WorkspaceContribution): WorkspaceContribution {
  return Object.freeze({
    ...definition,
    cards: [...(definition.cards ?? [])].sort((left, right) => left.localeCompare(right)),
    reports: [...(definition.reports ?? [])].sort((left, right) => left.localeCompare(right)),
    quickActions: [...(definition.quickActions ?? [])].sort((left, right) => left.localeCompare(right))
  });
}

export function defineAdminNav(definition: AdminNavContribution): AdminNavContribution {
  return Object.freeze({
    ...definition,
    items: [...definition.items].sort((left, right) => left.id.localeCompare(right.id))
  });
}

export function definePage(definition: PageContribution): PageContribution {
  return Object.freeze({
    shell: "admin",
    ...definition,
    fields: [...(definition.fields ?? [])].sort((left, right) => left.field.localeCompare(right.field))
  });
}

export function defineWidget(definition: WidgetContribution): WidgetContribution {
  return Object.freeze(definition);
}

export function defineReport(definition: ReportContribution): ReportContribution {
  return Object.freeze({
    ...definition,
    filters: [...definition.filters].sort((left, right) => left.key.localeCompare(right.key)),
    export: [...definition.export].sort((left, right) => left.localeCompare(right))
  });
}

export function defineCommand(definition: CommandContribution): CommandContribution {
  return Object.freeze({
    ...definition,
    keywords: [...(definition.keywords ?? [])].sort((left, right) => left.localeCompare(right))
  });
}

export function defineSearchProvider(definition: SearchContribution): SearchContribution {
  return Object.freeze({
    ...definition,
    scopes: [...definition.scopes].sort((left, right) => left.localeCompare(right))
  });
}

export function defineBuilder(definition: BuilderContribution): BuilderContribution {
  return Object.freeze(definition);
}

export function defineZoneLaunch(definition: ZoneLaunchContribution): ZoneLaunchContribution {
  return Object.freeze(definition);
}

export function createAdminContributionRegistry(): AdminContributionRegistry {
  return {
    workspaces: [],
    nav: [],
    pages: [],
    widgets: [],
    reports: [],
    commands: [],
    searchProviders: [],
    builders: [],
    zoneLaunchers: []
  };
}

export function registerWorkspace(
  registry: AdminContributionRegistry,
  contribution: WorkspaceContribution
): AdminContributionRegistry {
  return validateAdminRegistry({
    ...registry,
    workspaces: [...registry.workspaces, contribution].sort((left, right) => left.id.localeCompare(right.id))
  });
}

export function registerAdminNav(
  registry: AdminContributionRegistry,
  contribution: AdminNavContribution
): AdminContributionRegistry {
  return validateAdminRegistry({
    ...registry,
    nav: [...registry.nav, contribution].sort((left, right) => {
      const leftKey = `${left.workspace}:${left.group}`;
      const rightKey = `${right.workspace}:${right.group}`;
      return leftKey.localeCompare(rightKey);
    })
  });
}

export function registerPage(registry: AdminContributionRegistry, contribution: PageContribution): AdminContributionRegistry {
  return validateAdminRegistry({
    ...registry,
    pages: [...registry.pages, contribution].sort((left, right) => left.route.localeCompare(right.route))
  });
}

export function registerWidget(
  registry: AdminContributionRegistry,
  contribution: WidgetContribution
): AdminContributionRegistry {
  return validateAdminRegistry({
    ...registry,
    widgets: [...registry.widgets, contribution].sort((left, right) => left.id.localeCompare(right.id))
  });
}

export function registerReport(
  registry: AdminContributionRegistry,
  contribution: ReportContribution
): AdminContributionRegistry {
  return validateAdminRegistry({
    ...registry,
    reports: [...registry.reports, contribution].sort((left, right) => left.route.localeCompare(right.route))
  });
}

export function registerCommand(
  registry: AdminContributionRegistry,
  contribution: CommandContribution
): AdminContributionRegistry {
  return validateAdminRegistry({
    ...registry,
    commands: [...registry.commands, contribution].sort((left, right) => left.id.localeCompare(right.id))
  });
}

export function registerSearchProvider(
  registry: AdminContributionRegistry,
  contribution: SearchContribution
): AdminContributionRegistry {
  return validateAdminRegistry({
    ...registry,
    searchProviders: [...registry.searchProviders, contribution].sort((left, right) => left.id.localeCompare(right.id))
  });
}

export function registerBuilder(
  registry: AdminContributionRegistry,
  contribution: BuilderContribution
): AdminContributionRegistry {
  return validateAdminRegistry({
    ...registry,
    builders: [...registry.builders, contribution].sort((left, right) => left.route.localeCompare(right.route))
  });
}

export function registerZoneLaunch(
  registry: AdminContributionRegistry,
  contribution: ZoneLaunchContribution
): AdminContributionRegistry {
  return validateAdminRegistry({
    ...registry,
    zoneLaunchers: [...registry.zoneLaunchers, contribution].sort((left, right) => left.route.localeCompare(right.route))
  });
}

export function validateAdminRegistry(registry: AdminContributionRegistry): AdminContributionRegistry {
  const workspaceIds = new Set<string>();
  const navIds = new Set<string>();
  const pageIds = new Set<string>();
  const pageRoutes = new Set<string>();
  const widgetIds = new Set<string>();
  const widgetSlots = new Set<string>();
  const reportIds = new Set<string>();
  const reportRoutes = new Set<string>();
  const commandIds = new Set<string>();
  const searchIds = new Set<string>();
  const builderIds = new Set<string>();
  const builderRoutes = new Set<string>();
  const zoneLaunchIds = new Set<string>();
  const zoneLaunchRoutes = new Set<string>();

  for (const workspace of registry.workspaces) {
    requirePermission("workspace", workspace.id, workspace.permission);
    rejectDuplicate(workspaceIds, workspace.id, `duplicate workspace id: ${workspace.id}`);
  }

  for (const nav of registry.nav) {
    if (!registry.workspaces.some((workspace) => workspace.id === nav.workspace)) {
      throw new Error(`navigation group '${nav.workspace}:${nav.group}' references unknown workspace '${nav.workspace}'`);
    }
    for (const item of nav.items) {
      requirePermission("navigation item", item.id, item.permission);
      rejectDuplicate(navIds, item.id, `duplicate nav id: ${item.id}`);
    }
  }

  for (const page of registry.pages) {
    requirePermission("page", page.id, page.permission);
    rejectDuplicate(pageIds, page.id, `duplicate page id: ${page.id}`);
    rejectDuplicate(pageRoutes, page.route, `conflicting admin route: ${page.route}`);
  }

  for (const widget of registry.widgets) {
    requirePermission("widget", widget.id, widget.permission);
    rejectDuplicate(widgetIds, widget.id, `duplicate widget id: ${widget.id}`);
    const slotKey = `${widget.shell}:${widget.slot}:${widget.id}`;
    rejectDuplicate(widgetSlots, slotKey, `conflicting dashboard widget slot: ${slotKey}`);
  }

  for (const report of registry.reports) {
    requirePermission("report", report.id, report.permission);
    rejectDuplicate(reportIds, report.id, `duplicate report id: ${report.id}`);
    rejectDuplicate(reportRoutes, report.route, `conflicting admin route: ${report.route}`);
  }

  for (const command of registry.commands) {
    requirePermission("command", command.id, command.permission);
    rejectDuplicate(commandIds, command.id, `duplicate command id: ${command.id}`);
  }

  for (const provider of registry.searchProviders) {
    requirePermission("search provider", provider.id, provider.permission);
    rejectDuplicate(searchIds, provider.id, `duplicate search provider id: ${provider.id}`);
  }

  for (const builder of registry.builders) {
    requirePermission("builder", builder.id, builder.permission);
    rejectDuplicate(builderIds, builder.id, `duplicate builder id: ${builder.id}`);
    rejectDuplicate(builderRoutes, builder.route, `conflicting builder route: ${builder.route}`);
  }

  for (const zone of registry.zoneLaunchers) {
    requirePermission("zone launcher", zone.id, zone.permission);
    if (!zone.route.startsWith("/apps/")) {
      throw new Error(`invalid zone launch binding '${zone.id}': route must start with /apps/`);
    }
    if (!zone.zoneId) {
      throw new Error(`invalid zone launch binding '${zone.id}': zoneId is required`);
    }
    rejectDuplicate(zoneLaunchIds, zone.id, `duplicate zone launcher id: ${zone.id}`);
    rejectDuplicate(zoneLaunchRoutes, zone.route, `conflicting admin route: ${zone.route}`);
  }

  ensureRouteSeparation(pageRoutes, reportRoutes);
  ensureRouteSeparation(pageRoutes, builderRoutes);
  ensureRouteSeparation(pageRoutes, zoneLaunchRoutes);
  ensureRouteSeparation(reportRoutes, builderRoutes);
  ensureRouteSeparation(reportRoutes, zoneLaunchRoutes);
  ensureRouteSeparation(builderRoutes, zoneLaunchRoutes);

  return registry;
}

function requirePermission(kind: string, id: string, permission: string): void {
  if (!permission.trim()) {
    throw new Error(`permissionless admin contribution rejected: ${kind} '${id}'`);
  }
}

function rejectDuplicate(seen: Set<string>, value: string, message: string): void {
  if (seen.has(value)) {
    throw new Error(message);
  }
  seen.add(value);
}

function ensureRouteSeparation(left: Set<string>, right: Set<string>): void {
  for (const route of left) {
    if (right.has(route)) {
      throw new Error(`conflicting admin route: ${route}`);
    }
  }
}
