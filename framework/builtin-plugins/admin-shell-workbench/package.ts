import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "admin-shell-workbench",
  kind: "ui-surface",
  version: "0.1.0",
  displayName: "Admin Shell Workbench",
  description: "Default universal admin desk plugin.",
  extends: [],
  dependsOn: ["auth-core", "org-tenant-core", "role-policy-core", "dashboard-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: [
    "ui.shell.admin",
    "ui.admin.widgets",
    "ui.admin.pages",
    "ui.admin.reports",
    "ui.admin.builders"
  ],
  requestedCapabilities: ["ui.mount:admin", "data.read.settings"],
  ownsData: [],
  extendsData: [],
  slotClaims: [
    "primary-admin-shell",
    "admin-nav-host",
    "admin-widget-host",
    "admin-page-host",
    "admin-report-host",
    "admin-builder-host"
  ],
  trustTier: "first-party",
  reviewTier: "R1",
  isolationProfile: "same-process-trusted",
  compatibility: {
    framework: "^0.1.0",
    runtime: "bun>=1.3.12",
    db: ["postgres", "sqlite"]
  }
});
