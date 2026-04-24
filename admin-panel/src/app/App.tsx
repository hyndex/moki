import { AdminRoot } from "@/host";
import {
  bookingPlugin,
  crmPlugin,
  auditPlugin,
  platformCorePlugin,
  accountingPlugin,
  paymentsPlugin,
  eInvoicingPlugin,
  treasuryPlugin,
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
} from "@/examples";

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
];

/** Bridged legacy plugins.
 *
 *  This list is where you mount existing `@platform/admin-contracts`
 *  plugins (anything exporting `adminContributions`) inside the new shell.
 *
 *  To add one:
 *    import { adminContributions as crmLegacy } from "gutu-plugin-crm-core";
 *    bridgedPlugins.push(
 *      adoptLegacyContributions(crmLegacy, {
 *        sourceId: "crm-core",
 *        plugin: { id: "gutu-plugin-crm-core", label: "CRM Core", version: "1.4.0", icon: "Users" },
 *      }),
 *    );
 *
 *  When a plugin migrates to the next-gen API (see packages/admin-shell-bridge
 *  migration guide), remove it from this list and add its native `definePlugin`
 *  export to `plugins` above.
 */
import { adoptLegacyContributions, type BridgedPlugin } from "@gutu/admin-shell-bridge";
void adoptLegacyContributions; // keep import live for future registration

const bridgedPlugins: BridgedPlugin[] = [
  // Legacy @platform/admin-contracts plugins go here once their repos are
  // linked as workspace dependencies. Example:
  //
  // adoptLegacyContributions(crmCoreContributions, {
  //   sourceId: "crm-core",
  //   plugin: { id: "gutu-plugin-crm-core", label: "CRM Core", version: "1.4.0", icon: "Users" },
  // }),
];

export function App() {
  // Bridged plugins are structurally compatible with the native Plugin shape,
  // so AdminRoot accepts the union. (The `resources: never[]` + `commands` /
  // `views` sub-shapes match @/contracts/plugin.Plugin.)
  const all = [...plugins, ...(bridgedPlugins as unknown as typeof plugins)];
  return <AdminRoot plugins={all} />;
}
