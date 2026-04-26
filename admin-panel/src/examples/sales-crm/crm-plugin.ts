import { z } from "zod";
import { defineResource } from "@/builders";
import { definePlugin } from "@/contracts/plugin-v2";
import {
  crmActivityView,
  crmContactDetailView,
  crmContactsView,
  crmOverviewView,
  crmPipelineView,
  crmSegmentsView,
} from "./crm-pages";
import { CRM_EXTENDED_RESOURCES, CRM_EXTENDED_VIEWS } from "./crm-extended";
import { crmControlRoomView } from "./crm-control-room";
import { crmReportsIndexView, crmReportDetailView } from "./crm-reports";
import { CONTACTS } from "./data";

const ContactSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  title: z.string(),
  company: z.string(),
  stage: z.enum(["lead", "prospect", "customer", "churned"]),
  owner: z.string(),
  vip: z.boolean(),
  lifetimeValue: z.number(),
  createdAt: z.string(),
  lastActivityAt: z.string(),
  tags: z.array(z.string()),
});

const contactResource = defineResource({
  id: "crm.contact",
  singular: "Contact",
  plural: "Contacts",
  schema: ContactSchema,
  displayField: "name",
  searchable: ["name", "email", "company"],
  icon: "Users",
});
(contactResource as unknown as {
  __seed: Record<string, unknown>[];
}).__seed = CONTACTS.map(({ activityTrend: _t, ...rest }) => rest);

const crmNavSections = [{ id: "sales", label: "Sales & CRM", order: 10 }];
const crmNav = [
  { id: "crm.overview", label: "Overview", icon: "LayoutDashboard", path: "/contacts/overview", view: "crm.overview.view", section: "sales", order: 10 },
  { id: "crm.control-room", label: "CRM Control Room", icon: "Gauge", path: "/crm/control-room", view: "crm.control-room.view", section: "sales", order: 10.5 },
  { id: "crm.contacts", label: "Contacts", icon: "Users", path: "/contacts", view: "crm.contacts.view", section: "sales", order: 11 },
  { id: "crm.leads", label: "Leads", icon: "UserRound", path: "/crm/leads", view: "crm.leads.list", section: "sales", order: 11.5 },
  { id: "crm.opportunities", label: "Opportunities", icon: "Target", path: "/crm/opportunities", view: "crm.opportunities.list", section: "sales", order: 11.7 },
  { id: "crm.pipeline", label: "Pipeline", icon: "Layers", path: "/contacts/pipeline", view: "crm.pipeline.view", section: "sales", order: 12 },
  { id: "crm.campaigns", label: "Campaigns", icon: "Megaphone", path: "/crm/campaigns", view: "crm.campaigns.list", section: "sales", order: 12.3 },
  { id: "crm.tasks", label: "Tasks", icon: "CheckSquare", path: "/crm/tasks", view: "crm.tasks.list", section: "sales", order: 12.4 },
  { id: "crm.calls", label: "Calls", icon: "Phone", path: "/crm/calls", view: "crm.calls.list", section: "sales", order: 12.45 },
  { id: "crm.appointments", label: "Appointments", icon: "Calendar", path: "/crm/appointments", view: "crm.appointments.list", section: "sales", order: 12.5 },
  { id: "crm.contracts", label: "Contracts", icon: "FileText", path: "/crm/contracts", view: "crm.contracts.list", section: "sales", order: 12.7 },
  { id: "crm.activity", label: "Activity", icon: "Activity", path: "/contacts/activity", view: "crm.activity.view", section: "sales", order: 13 },
  { id: "crm.segments", label: "Segments", icon: "LayoutGrid", path: "/contacts/segments", view: "crm.segments.view", section: "sales", order: 14 },
  { id: "crm.competitors", label: "Competitors", icon: "Swords", path: "/crm/competitors", view: "crm.competitors.list", section: "sales", order: 14.3 },
  { id: "crm.market-segments", label: "Market Segments", icon: "Target", path: "/crm/market-segments", view: "crm.market-segments.list", section: "sales", order: 14.5 },
  { id: "crm.sales-stages", label: "Sales Stages", icon: "Settings2", path: "/crm/sales-stages", view: "crm.sales-stages.list", section: "sales", order: 14.7 },
  { id: "crm.reports", label: "Reports", icon: "BarChart3", path: "/crm/reports", view: "crm.reports.view", section: "sales", order: 14.9 },
];
const crmResources = [contactResource, ...CRM_EXTENDED_RESOURCES];
const crmViews = [
  crmOverviewView,
  crmContactsView,
  crmPipelineView,
  crmActivityView,
  crmSegmentsView,
  crmContactDetailView,
  crmControlRoomView,
  crmReportsIndexView,
  crmReportDetailView,
  ...CRM_EXTENDED_VIEWS,
];
const crmCommands = [
  { id: "crm.go.overview", label: "CRM: Overview", icon: "LayoutDashboard", run: () => { window.location.hash = "/contacts/overview"; } },
  { id: "crm.go.control-room", label: "CRM: Control Room", icon: "Gauge", run: () => { window.location.hash = "/crm/control-room"; } },
  { id: "crm.new", label: "New contact", icon: "UserPlus", shortcut: "N", run: () => { window.location.hash = "/contacts/new"; } },
  { id: "crm.new-lead", label: "New lead", icon: "UserRound", run: () => { window.location.hash = "/crm/leads/new"; } },
  { id: "crm.new-opportunity", label: "New opportunity", icon: "Target", run: () => { window.location.hash = "/crm/opportunities/new"; } },
  { id: "crm.new-campaign", label: "New campaign", icon: "Megaphone", run: () => { window.location.hash = "/crm/campaigns/new"; } },
  { id: "crm.go.reports", label: "CRM: Reports", icon: "BarChart3", run: () => { window.location.hash = "/crm/reports"; } },
];

export const crmPlugin = definePlugin({
  manifest: {
    id: "crm",
    version: "0.2.0",
    label: "CRM",
    description: "Contacts, activity, and pipeline.",
    icon: "Users",
    requires: {
      shell: "*",
      capabilities: ["resources:read", "resources:write", "resources:delete", "nav", "commands"],
    },
    activationEvents: [{ kind: "onStart" }],
    origin: { kind: "explicit" },
  },
  async activate(ctx) {
    ctx.contribute.navSections(crmNavSections);
    ctx.contribute.nav(crmNav);
    ctx.contribute.resources(crmResources);
    ctx.contribute.views(crmViews);
    ctx.contribute.commands(crmCommands);
  },
});
