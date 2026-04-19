import { definePolicy } from "@platform/permissions";

export const pageBuilderPolicy = definePolicy({
  id: "page-builder-core.default",
  rules: [
    {
      permission: "page-builder.layouts.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "page-builder.layouts.compose",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});