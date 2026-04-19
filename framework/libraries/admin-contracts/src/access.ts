import type {
  AdminAccessContext,
  BuilderContribution,
  CommandContribution,
  FieldVisibilityRule,
  PageContribution,
  ReportContribution,
  WidgetContribution,
  ZoneLaunchContribution
} from "./types";

export function canViewPage(ctx: AdminAccessContext, page: Pick<PageContribution, "permission"> | string): boolean {
  const permission = typeof page === "string" ? page : page.permission;
  return ctx.has(permission);
}

export function canRunAction(ctx: AdminAccessContext, actionPermission: string): boolean {
  return ctx.has(actionPermission);
}

export function canSeeField(ctx: AdminAccessContext, rule: FieldVisibilityRule): boolean {
  return ctx.has(rule.permission);
}

export function canSeeWidget(ctx: AdminAccessContext, widget: Pick<WidgetContribution, "permission">): boolean {
  return ctx.has(widget.permission);
}

export function canViewReport(ctx: AdminAccessContext, report: Pick<ReportContribution, "permission">): boolean {
  return ctx.has(report.permission);
}

export function canUseBuilder(ctx: AdminAccessContext, builder: Pick<BuilderContribution, "permission">): boolean {
  return ctx.has(builder.permission);
}

export function canLaunchZone(ctx: AdminAccessContext, zone: Pick<ZoneLaunchContribution, "permission">): boolean {
  return ctx.has(zone.permission);
}

export function canUseCommand(ctx: AdminAccessContext, command: Pick<CommandContribution, "permission">): boolean {
  return ctx.has(command.permission);
}
