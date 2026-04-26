import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { AdminRoot } from "@/host";
import { bookingPlugin, crmPlugin, auditPlugin, platformCorePlugin, accountingPlugin, paymentsPlugin, eInvoicingPlugin, treasuryPlugin, salesPlugin, communityPlugin, partyRelationshipsPlugin, supportServicePlugin, fieldServicePlugin, projectsPlugin, issuesPlugin, productCatalogPlugin, pricingTaxPlugin, posPlugin, subscriptionsPlugin, inventoryPlugin, manufacturingPlugin, procurementPlugin, assetsPlugin, maintenanceCmmsPlugin, qualityPlugin, traceabilityPlugin, authPlugin, hrPayrollPlugin, rolePolicyPlugin, userDirectoryPlugin, contentPlugin, documentPlugin, filesPlugin, contractsPlugin, formsPlugin, knowledgePlugin, templatePlugin, businessPortalsPlugin, portalPlugin, pageBuilderPlugin, companyBuilderPlugin, aiCorePlugin, aiEvalsPlugin, aiRagPlugin, aiSkillsPlugin, aiAssistPlugin, automationPlugin, workflowPlugin, jobsPlugin, notificationsPlugin, integrationPlugin, analyticsBiPlugin, dashboardPlugin, orgTenantPlugin, runtimeBridgePlugin, executionWorkspacesPlugin, searchPlugin, officePlugin, adminToolsPlugin, } from "@/examples";
/** Consumer-level wiring. The shell, router, and every view is driven from
 *  these declarations. Order here is the plugin-activation order; nav ordering
 *  is independent and comes from each plugin's section + order config. */
const plugins = [
    platformCorePlugin, // global Home, Settings, Profile, Inbox, Search
    bookingPlugin, // owns "/" dashboard
    crmPlugin,
    salesPlugin,
    communityPlugin,
    partyRelationshipsPlugin,
    supportServicePlugin,
    fieldServicePlugin,
    projectsPlugin,
    issuesPlugin,
    productCatalogPlugin,
    pricingTaxPlugin,
    posPlugin,
    subscriptionsPlugin,
    accountingPlugin,
    paymentsPlugin,
    eInvoicingPlugin,
    treasuryPlugin,
    inventoryPlugin,
    manufacturingPlugin,
    procurementPlugin,
    assetsPlugin,
    maintenanceCmmsPlugin,
    qualityPlugin,
    traceabilityPlugin,
    authPlugin,
    hrPayrollPlugin,
    rolePolicyPlugin,
    userDirectoryPlugin,
    contentPlugin,
    documentPlugin,
    filesPlugin,
    contractsPlugin,
    formsPlugin,
    knowledgePlugin,
    templatePlugin,
    businessPortalsPlugin,
    portalPlugin,
    pageBuilderPlugin,
    companyBuilderPlugin,
    aiCorePlugin,
    aiEvalsPlugin,
    aiRagPlugin,
    aiSkillsPlugin,
    aiAssistPlugin,
    automationPlugin,
    workflowPlugin,
    jobsPlugin,
    notificationsPlugin,
    integrationPlugin,
    analyticsBiPlugin,
    dashboardPlugin,
    orgTenantPlugin,
    runtimeBridgePlugin,
    executionWorkspacesPlugin,
    searchPlugin,
    auditPlugin,
    officePlugin, // owns /spreadsheets, /documents, /slides, /pages, /whiteboards
    adminToolsPlugin, // /settings/webhooks, /settings/api-tokens
];
export function App() {
    // All first-party plugins are v2. Filesystem-discovered plugins under
    // `src/plugins/*` and npm specifiers from `package.json.gutuPlugins` are
    // merged automatically by AdminRoot. Stable reference — plugins are
    // installed/uninstalled at runtime via the Plugin Inspector, not by
    // mutating this list.
    const all = React.useMemo(() => plugins, []);
    return _jsx(AdminRoot, { plugins: all });
}
