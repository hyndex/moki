import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const erpnextRoot = resolve(workspaceRoot, process.argv[2] ?? "ref/Business/ERPNext/erpnext");
const outputJsonPath = join(workspaceRoot, "tooling", "business-os", "erpnext-reference-map.json");
const reportPath = join(
  workspaceRoot,
  "integrations",
  "gutu-ecosystem-integration",
  "reports",
  "erpnext-reference-map.md"
);

if (!existsSync(erpnextRoot)) {
  throw new Error(`ERPNext reference root does not exist: ${erpnextRoot}`);
}

const allFiles = walk(erpnextRoot);
const domainCoverage = loadGutuDomainCoverage();
const adminMetadataCoverage = loadAdminErpMetadataCoverage();
let doctypes = loadDoctypes(allFiles, domainCoverage, adminMetadataCoverage);
const reports = loadGroupedAsset(allFiles, "report");
const workspaces = loadGroupedAsset(allFiles, "workspace");
const pages = loadGroupedAsset(allFiles, "page");
const printFormats = loadGroupedAsset(allFiles, "print_format");
const webForms = loadGroupedAsset(allFiles, "web_form");
const dashboardCharts = loadGroupedAsset(allFiles, "dashboard_chart");
const numberCards = loadGroupedAsset(allFiles, "number_card");
const onboardingSteps = loadGroupedAsset(allFiles, "onboarding_step");
const moduleOnboardings = loadGroupedAsset(allFiles, "module_onboarding");
const formTours = loadGroupedAsset(allFiles, "form_tour");
doctypes = enrichDoctypeParityLedger(doctypes, {
  reports,
  workspaces,
  pages,
  printFormats,
  webForms,
  dashboardCharts,
  numberCards,
  onboardingSteps
});

const modules = summarizeModules({
  doctypes,
  reports,
  workspaces,
  pages,
  printFormats,
  webForms,
  dashboardCharts,
  numberCards,
  onboardingSteps,
  moduleOnboardings,
  formTours
});

const map = {
  generatedAt: new Date().toISOString(),
  referenceRoot: relative(workspaceRoot, erpnextRoot),
  source: {
    product: "ERPNext",
    checkoutPath: "ref/Business/ERPNext",
    branch: "develop"
  },
  summary: {
    modules: modules.length,
    doctypes: doctypes.length,
    reports: reports.length,
    workspaces: workspaces.length,
    pages: pages.length,
    printFormats: printFormats.length,
    webForms: webForms.length,
    dashboardCharts: dashboardCharts.length,
    numberCards: numberCards.length,
    onboardingSteps: onboardingSteps.length,
    moduleOnboardings: moduleOnboardings.length,
    formTours: formTours.length,
    fields: sum(doctypes.map((entry) => entry.fieldCount)),
    childTableFields: sum(doctypes.map((entry) => entry.childTables.length)),
    linkFields: sum(doctypes.map((entry) => entry.linkFields.length)),
    adminMetadataDoctypes: doctypes.filter((entry) => entry.gutu.status === "admin-metadata").length,
    catalogCoveredDoctypes: doctypes.filter((entry) => entry.gutu.status === "catalog-covered").length,
    coveredDoctypes: doctypes.filter((entry) => entry.gutu.status === "catalog-covered" || entry.gutu.status === "admin-metadata").length,
    missingDoctypes: doctypes.filter((entry) => entry.gutu.status === "missing").length
  },
  modules,
  coverage: summarizeCoverage(doctypes),
  doctypes,
  reports,
  workspaces,
  pages,
  printFormats,
  webForms,
  dashboardCharts,
  numberCards,
  onboardingSteps,
  moduleOnboardings,
  formTours
};

mkdirSync(dirname(outputJsonPath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(outputJsonPath, `${JSON.stringify(map, null, 2)}\n`, "utf8");
writeFileSync(reportPath, renderMarkdown(map), "utf8");

console.log(`ERPNext reference map written to ${relative(workspaceRoot, outputJsonPath)}`);
console.log(`ERPNext reference report written to ${relative(workspaceRoot, reportPath)}`);

function walk(root) {
  const output = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const absolute = join(root, entry.name);
    if (entry.isDirectory()) {
      output.push(...walk(absolute));
    } else {
      output.push(absolute);
    }
  }
  return output;
}

function loadDoctypes(files, coverage, adminCoverage) {
  return files
    .filter((file) => file.endsWith(".json") && file.includes(`${sep}doctype${sep}`))
    .map((file) => {
      const json = readJson(file);
      const fields = Array.isArray(json.fields) ? json.fields : [];
      const moduleName = moduleFromPath(file);
      const name = String(json.name ?? json.doctype ?? basenameNoExt(file));
      const normalizedName = normalizeName(name);
      const coveredBy = coverage.get(normalizedName) ?? [];
      const adminMetadataRefs = [
        ...(adminCoverage.get(normalizedName) ?? []),
        ...(adminCoverage.get(normalizeName(`${moduleName}.${name}`)) ?? [])
      ];
      const gutuStatus = adminMetadataRefs.length > 0
        ? "admin-metadata"
        : coveredBy.length > 0
          ? "catalog-covered"
          : "missing";
      return {
        name,
        module: moduleName,
        path: relative(workspaceRoot, file),
        fieldCount: fields.length,
        childTables: fields
          .filter((field) => ["Table", "Table MultiSelect"].includes(String(field.fieldtype ?? "")))
          .map((field) => ({
            fieldname: String(field.fieldname ?? ""),
            label: String(field.label ?? field.fieldname ?? ""),
            options: String(field.options ?? "")
          })),
        linkFields: fields
          .filter((field) => ["Link", "Dynamic Link"].includes(String(field.fieldtype ?? "")))
          .map((field) => ({
            fieldname: String(field.fieldname ?? ""),
            label: String(field.label ?? field.fieldname ?? ""),
            fieldtype: String(field.fieldtype ?? ""),
            options: String(field.options ?? "")
          })),
        layoutBreaks: fields
          .filter((field) => ["Tab Break", "Section Break", "Column Break"].includes(String(field.fieldtype ?? "")))
          .map((field) => ({
            fieldname: String(field.fieldname ?? ""),
            label: String(field.label ?? field.fieldname ?? ""),
            fieldtype: String(field.fieldtype ?? "")
          })),
        permissions: Array.isArray(json.permissions) ? json.permissions.length : 0,
        autoname: json.autoname ?? null,
        isSubmittable: Boolean(json.is_submittable),
        allowImport: Boolean(json.allow_import),
        trackChanges: Boolean(json.track_changes),
        gutu: {
          ownerPlugin: inferGutuOwner(moduleName, name),
          supportingPlugins: inferSupportingPlugins(moduleName, name),
          targetResource: targetResourceFor(moduleName, name),
          status: gutuStatus,
          parityStatus: gutuStatus === "admin-metadata"
            ? "implemented"
            : gutuStatus === "catalog-covered"
              ? "scaffolded"
              : "missing",
          catalogRefs: coveredBy,
          adminMetadataRefs,
          requiredChildTables: [],
          reportLinks: [],
          workspaceLinks: [],
          printPortalSupport: {
            printFormats: [],
            webForms: [],
            portalRequired: false
          },
          workflow: {
            required: Boolean(json.is_submittable),
            stateField: Boolean(json.is_submittable) ? "status" : null,
            submittedStatuses: Boolean(json.is_submittable) ? ["submitted"] : []
          },
          verificationScenario: verificationScenarioFor(moduleName, name)
        }
      };
    })
    .sort((left, right) => left.module.localeCompare(right.module) || left.name.localeCompare(right.name));
}

function enrichDoctypeParityLedger(doctypes, assets) {
  return doctypes.map((entry) => {
    const normalized = normalizeName(entry.name);
    const moduleReports = assets.reports.filter((report) => report.module === entry.module);
    const reportLinks = moduleReports
      .filter((report) => normalizeName(report.name).includes(normalized) || normalized.includes(normalizeName(report.name)))
      .slice(0, 12)
      .map((report) => ({ name: report.name, path: report.path }));
    const workspaceLinks = assets.workspaces
      .filter((workspace) => workspace.module === entry.module)
      .map((workspace) => ({ name: workspace.name, path: workspace.path }));
    const printFormats = assets.printFormats
      .filter((format) => format.module === entry.module && (
        normalizeName(format.name).includes(normalized) ||
        normalized.includes(normalizeName(format.name)) ||
        normalizeName(format.path).includes(normalized)
      ))
      .map((format) => ({ name: format.name, path: format.path }));
    const webForms = assets.webForms
      .filter((form) => form.module === entry.module && (
        normalizeName(form.name).includes(normalized) ||
        normalized.includes(normalizeName(form.name)) ||
        normalizeName(form.path).includes(normalized)
      ))
      .map((form) => ({ name: form.name, path: form.path }));
    return {
      ...entry,
      gutu: {
        ...entry.gutu,
        requiredChildTables: entry.childTables.map((table) => ({
          field: table.fieldname,
          label: table.label,
          targetDoctype: table.options,
          targetResource: table.options ? targetResourceFor(entry.module, table.options) : null
        })),
        reportLinks,
        workspaceLinks,
        printPortalSupport: {
          printFormats,
          webForms,
          portalRequired: entry.isSubmittable || webForms.length > 0 || printFormats.length > 0
        }
      }
    };
  });
}

function loadGroupedAsset(files, folderName) {
  const groups = new Map();
  for (const file of files) {
    const parts = file.split(sep);
    const index = parts.lastIndexOf(folderName);
    if (index === -1 || index + 1 >= parts.length) {
      continue;
    }
    const moduleName = moduleFromPath(file);
    const assetName = parts[index + 1];
    const key = `${moduleName}:${folderName}:${assetName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        name: titleFromSlug(assetName),
        module: moduleName,
        path: relative(workspaceRoot, parts.slice(0, index + 2).join(sep)),
        files: []
      });
    }
    groups.get(key).files.push(relative(workspaceRoot, file));
  }
  return [...groups.values()].sort((left, right) => left.module.localeCompare(right.module) || left.name.localeCompare(right.name));
}

function summarizeModules(assets) {
  const moduleNames = new Set();
  for (const list of Object.values(assets)) {
    for (const entry of list) {
      moduleNames.add(entry.module);
    }
  }
  return [...moduleNames].sort().map((moduleName) => ({
    name: moduleName,
    ownerPlugin: inferGutuOwner(moduleName),
    doctypes: assets.doctypes.filter((entry) => entry.module === moduleName).length,
    reports: assets.reports.filter((entry) => entry.module === moduleName).length,
    workspaces: assets.workspaces.filter((entry) => entry.module === moduleName).length,
    pages: assets.pages.filter((entry) => entry.module === moduleName).length,
    printFormats: assets.printFormats.filter((entry) => entry.module === moduleName).length,
    webForms: assets.webForms.filter((entry) => entry.module === moduleName).length,
    dashboardCharts: assets.dashboardCharts.filter((entry) => entry.module === moduleName).length,
    numberCards: assets.numberCards.filter((entry) => entry.module === moduleName).length,
    onboardingSteps: assets.onboardingSteps.filter((entry) => entry.module === moduleName).length,
    moduleOnboardings: assets.moduleOnboardings.filter((entry) => entry.module === moduleName).length,
    formTours: assets.formTours.filter((entry) => entry.module === moduleName).length,
    fields: sum(assets.doctypes.filter((entry) => entry.module === moduleName).map((entry) => entry.fieldCount)),
    childTableFields: sum(assets.doctypes.filter((entry) => entry.module === moduleName).map((entry) => entry.childTables.length)),
    linkFields: sum(assets.doctypes.filter((entry) => entry.module === moduleName).map((entry) => entry.linkFields.length))
  }));
}

function summarizeCoverage(doctypes) {
  const byPlugin = new Map();
  for (const doctype of doctypes) {
    const plugin = doctype.gutu.ownerPlugin;
    const current = byPlugin.get(plugin) ?? {
      ownerPlugin: plugin,
      totalDoctypes: 0,
      coveredDoctypes: 0,
      missingDoctypes: 0,
      topMissing: []
    };
    current.totalDoctypes += 1;
    if (doctype.gutu.status === "catalog-covered" || doctype.gutu.status === "admin-metadata") {
      current.coveredDoctypes += 1;
    } else {
      current.missingDoctypes += 1;
      current.topMissing.push({
        name: doctype.name,
        module: doctype.module,
        fieldCount: doctype.fieldCount,
        childTables: doctype.childTables.length,
        linkFields: doctype.linkFields.length
      });
    }
    byPlugin.set(plugin, current);
  }
  return [...byPlugin.values()]
    .map((entry) => ({
      ...entry,
      topMissing: entry.topMissing
        .sort((left, right) => right.fieldCount - left.fieldCount)
        .slice(0, 12)
    }))
    .sort((left, right) => right.missingDoctypes - left.missingDoctypes);
}

function loadGutuDomainCoverage() {
  const coverage = new Map();
  const pluginRoot = join(workspaceRoot, "plugins");
  if (!existsSync(pluginRoot)) {
    return coverage;
  }
  for (const repoName of readdirSync(pluginRoot)) {
    const builtinRoot = join(pluginRoot, repoName, "framework", "builtin-plugins");
    if (!existsSync(builtinRoot)) {
      continue;
    }
    for (const packageDir of readdirSync(builtinRoot)) {
      const catalogPath = join(builtinRoot, packageDir, "src", "domain", "catalog.ts");
      if (!existsSync(catalogPath)) {
        continue;
      }
      const source = readFileSync(catalogPath, "utf8");
      const match = source.match(/["'`]?erpnextDoctypes["'`]?\s*:\s*\[([\s\S]*?)\]/m);
      if (!match) {
        continue;
      }
      for (const value of [...match[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((entry) => entry[1])) {
        const key = normalizeName(value);
        const refs = coverage.get(key) ?? [];
        refs.push(packageDir);
        coverage.set(key, refs);
      }
    }
  }
  return coverage;
}

function loadAdminErpMetadataCoverage() {
  const coverage = new Map();
  const examplesRoot = join(workspaceRoot, "admin-panel", "src", "examples");
  if (!existsSync(examplesRoot)) {
    return coverage;
  }
  for (const file of walk(examplesRoot).filter((entry) => /\.(ts|tsx)$/.test(entry))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/documentType\s*:\s*["'`]([^"'`]+)["'`]/g)) {
      const raw = match[1];
      const keys = [normalizeName(raw), normalizeName(raw.split(".").at(-1) ?? raw)];
      for (const key of keys) {
        const refs = coverage.get(key) ?? [];
        refs.push(relative(workspaceRoot, file));
        coverage.set(key, refs);
      }
    }
  }
  return coverage;
}

function inferGutuOwner(moduleName, doctypeName = "") {
  const normalizedModule = moduleName.toLowerCase();
  const normalizedDocType = doctypeName.toLowerCase();
  if (normalizedDocType.includes("subcontract")) return "procurement-core";
  if (normalizedDocType.includes("maintenance")) return "support-service-core";
  if (normalizedModule === "accounts") return "accounting-core";
  if (normalizedModule === "stock") return "inventory-core";
  if (normalizedModule === "manufacturing") return "manufacturing-core";
  if (normalizedModule === "subcontracting") return "procurement-core";
  if (normalizedModule === "buying") return "procurement-core";
  if (normalizedModule === "selling") return "sales-core";
  if (normalizedModule === "crm") return "crm-core";
  if (normalizedModule === "projects") return "projects-core";
  if (normalizedModule === "support") return "support-service-core";
  if (normalizedModule === "maintenance") return "support-service-core";
  if (normalizedModule === "assets") return "assets-core";
  if (normalizedModule === "quality_management" || normalizedModule === "quality") return "quality-core";
  if (normalizedModule === "setup") return "org-tenant-core";
  if (normalizedModule === "bulk_transaction") return "automation-core";
  if (normalizedModule === "communication") return "notifications-core";
  if (normalizedModule === "edi") return "e-invoicing-core";
  if (normalizedModule === "erpnext_integrations") return "integration-core";
  if (normalizedModule === "portal") return "portal-core";
  if (normalizedModule === "regional") return "pricing-tax-core";
  if (normalizedModule === "telephony") return "support-service-core";
  if (normalizedModule === "utilities") return "platform-core";
  if (normalizedModule.includes("hr") || normalizedDocType.includes("employee") || normalizedDocType.includes("salary")) return "hr-payroll-core";
  if (normalizedDocType.includes("tax") || normalizedDocType.includes("pricing rule")) return "pricing-tax-core";
  if (normalizedDocType.includes("item")) return "product-catalog-core";
  if (normalizedDocType.includes("customer") || normalizedDocType.includes("supplier")) return "party-relationships-core";
  return `${normalizedModule || "setup"}-owner-needed`;
}

function inferSupportingPlugins(moduleName, doctypeName = "") {
  const normalizedDocType = doctypeName.toLowerCase();
  const normalizedModule = moduleName.toLowerCase();
  const plugins = [];
  if (normalizedDocType.includes("subcontract") || normalizedModule === "subcontracting") {
    plugins.push("manufacturing-core");
  }
  if (normalizedDocType.includes("maintenance") && (normalizedDocType.includes("item") || normalizedDocType.includes("product") || normalizedModule === "stock")) {
    plugins.push("product-catalog-core");
  }
  if (normalizedModule === "setup") {
    plugins.push("platform-core");
  }
  return plugins;
}

function targetResourceFor(moduleName, doctypeName = "") {
  const owner = inferGutuOwner(moduleName, doctypeName).replace(/-core$/, "");
  return `${owner}.${slugifyDoctype(doctypeName || moduleName)}`;
}

function verificationScenarioFor(moduleName, doctypeName = "") {
  const normalizedModule = moduleName.toLowerCase();
  const normalizedDocType = doctypeName.toLowerCase();
  if (normalizedModule === "accounts") return "accounting-posting-and-financial-report";
  if (normalizedModule === "stock") return "stock-ledger-valuation-and-reservation";
  if (normalizedModule === "selling") return "quote-to-cash";
  if (normalizedModule === "buying" || normalizedDocType.includes("subcontract")) return "source-to-pay";
  if (normalizedModule === "manufacturing") return "bom-to-work-order";
  if (normalizedModule === "projects") return "project-timesheet-to-invoice";
  if (normalizedModule === "support" || normalizedDocType.includes("maintenance")) return "support-sla-or-maintenance-flow";
  if (normalizedModule === "assets") return "asset-depreciation-disposal";
  if (normalizedModule === "setup") return "tenant-setup-and-permission-configuration";
  if (normalizedModule.includes("hr") || normalizedDocType.includes("employee") || normalizedDocType.includes("salary")) return "payroll-to-gl";
  return `${normalizedModule || "business"}-parity-smoke`;
}

function moduleFromPath(file) {
  const relativePath = relative(erpnextRoot, file);
  return relativePath.split(sep)[0] ?? "unknown";
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse ${relative(workspaceRoot, file)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function renderMarkdown(map) {
  const topModules = [...map.modules].sort((left, right) => right.doctypes - left.doctypes).slice(0, 12);
  const topMissing = map.coverage.slice(0, 12);
  const statusCounts = map.doctypes.reduce((acc, entry) => {
    const status = entry.gutu.parityStatus;
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  return `# ERPNext Reference Map

Generated: ${map.generatedAt}

Source: \`${map.referenceRoot}\`

## Summary

| Surface | Count |
| --- | ---: |
| Modules | ${map.summary.modules} |
| DocTypes | ${map.summary.doctypes} |
| Reports | ${map.summary.reports} |
| Workspaces | ${map.summary.workspaces} |
| Pages | ${map.summary.pages} |
| Print formats | ${map.summary.printFormats} |
| Web forms | ${map.summary.webForms} |
| Dashboard charts | ${map.summary.dashboardCharts} |
| Number cards | ${map.summary.numberCards} |
| Fields | ${map.summary.fields} |
| Child table fields | ${map.summary.childTableFields} |
| Link fields | ${map.summary.linkFields} |
| Admin-metadata DocTypes | ${map.summary.adminMetadataDoctypes} |
| Catalog-only DocTypes | ${map.summary.catalogCoveredDoctypes} |
| Catalog-covered DocTypes | ${map.summary.coveredDoctypes} |
| Missing DocTypes | ${map.summary.missingDoctypes} |

## Machine Ledger Fields

Every DocType row in \`tooling/business-os/erpnext-reference-map.json\` now includes:

- owner plugin and supporting plugins
- target Gutu resource id
- parity status
- required child-table targets
- related report/workspace links
- print, web form, and portal requirement signals
- workflow requirement and submitted-state metadata
- verification scenario

## Largest Modules

| Module | Owner | DocTypes | Reports | Fields | Child tables | Links |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${topModules.map((entry) => `| ${entry.name} | ${entry.ownerPlugin} | ${entry.doctypes} | ${entry.reports} | ${entry.fields} | ${entry.childTableFields} | ${entry.linkFields} |`).join("\n")}

## Parity Status

| Status | DocTypes |
| --- | ---: |
${Object.entries(statusCounts).sort(([left], [right]) => left.localeCompare(right)).map(([status, count]) => `| ${status} | ${count} |`).join("\n")}

## Highest Missing Coverage By Owner

| Owner | Total DocTypes | Covered | Missing | Top missing |
| --- | ---: | ---: | ---: | --- |
${topMissing.map((entry) => `| ${entry.ownerPlugin} | ${entry.totalDoctypes} | ${entry.coveredDoctypes} | ${entry.missingDoctypes} | ${entry.topMissing.map((item) => item.name).join(", ")} |`).join("\n")}

## Next Step

Use \`tooling/business-os/erpnext-reference-map.json\` as the machine-readable parity ledger. Each missing or shallow DocType should be assigned a Gutu plugin owner, resource contract, child table model, document mapping, report, print/portal surface, and verification scenario before parity is claimed.
`;
}

function normalizeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function titleFromSlug(value) {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function slugifyDoctype(value) {
  return String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "record";
}

function basenameNoExt(file) {
  const base = file.split(sep).at(-1) ?? file;
  return base.replace(/\.[^.]+$/, "");
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
