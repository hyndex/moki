// Signature (bespoke) plugins
export { bookingPlugin } from "./booking/plugin";
export { auditPlugin } from "./audit/plugin";
export { platformCorePlugin } from "./platform-core/plugin";

// Sales & CRM category — rewritten with rich, production-grade pages.
export {
  crmPlugin,
  salesPlugin,
  communityPlugin,
  partyRelationshipsPlugin,
} from "./sales-crm";

// Factory-built plugins — one per core plugin in WORKSPACE_REPOS.md
export { accountingPlugin } from "./accounting";
export { aiCorePlugin } from "./ai-core";
export { aiEvalsPlugin } from "./ai-evals";
export { aiRagPlugin } from "./ai-rag";
export { aiSkillsPlugin } from "./ai-skills";
export { aiAssistPlugin } from "./ai-assist";
export { assetsPlugin } from "./assets";
export { automationPlugin } from "./automation";
export { authPlugin } from "./auth";
export { companyBuilderPlugin } from "./company-builder";
export { contentPlugin } from "./content";
export { contractsPlugin } from "./contracts";
export { dashboardPlugin } from "./dashboard";
export { documentPlugin } from "./document";
export { eInvoicingPlugin } from "./e-invoicing";
export { executionWorkspacesPlugin } from "./execution-workspaces";
export { fieldServicePlugin } from "./field-service";
export { filesPlugin } from "./files";
export { formsPlugin } from "./forms";
export { hrPayrollPlugin } from "./hr-payroll";
export { inventoryPlugin } from "./inventory";
export { integrationPlugin } from "./integration";
export { issuesPlugin } from "./issues";
export { jobsPlugin } from "./jobs";
export { knowledgePlugin } from "./knowledge";
export { manufacturingPlugin } from "./manufacturing";
export { maintenanceCmmsPlugin } from "./maintenance-cmms";
export { notificationsPlugin } from "./notifications";
export { orgTenantPlugin } from "./org-tenant";
export { paymentsPlugin } from "./payments";
export { pageBuilderPlugin } from "./page-builder";
export { businessPortalsPlugin } from "./business-portals";
export { posPlugin } from "./pos";
export { portalPlugin } from "./portal";
export { pricingTaxPlugin } from "./pricing-tax";
export { procurementPlugin } from "./procurement";
export { productCatalogPlugin } from "./product-catalog";
export { projectsPlugin } from "./projects";
export { qualityPlugin } from "./quality";
export { rolePolicyPlugin } from "./role-policy";
export { runtimeBridgePlugin } from "./runtime-bridge";
export { searchPlugin } from "./search";
export { subscriptionsPlugin } from "./subscriptions";
export { supportServicePlugin } from "./support-service";
export { templatePlugin } from "./template";
export { treasuryPlugin } from "./treasury";
export { traceabilityPlugin } from "./traceability";
export { userDirectoryPlugin } from "./user-directory";
export { workflowPlugin } from "./workflow";
export { analyticsBiPlugin } from "./analytics-bi";
export { officePlugin } from "./office/plugin";
