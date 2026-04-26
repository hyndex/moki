import { z } from "zod";
import { defineResource } from "@/builders";
import { definePlugin } from "@/contracts/plugin-v2";
import {
  partyEntityDetailView,
  partyGraphView,
  partyListView,
} from "./party-pages";
import { ENTITIES, EDGES } from "./data";
import {
  partyControlRoomView,
  partyReportsIndexView,
  partyReportsDetailView,
} from "./party-dashboard";

const EntitySchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["company", "person", "vendor", "partner"]),
});
const entityResource = defineResource({
  id: "party-relationships.entity",
  singular: "Entity",
  plural: "Entities",
  schema: EntitySchema,
  displayField: "label",
  icon: "Network",
});
(entityResource as unknown as { __seed: Record<string, unknown>[] }).__seed =
  ENTITIES as unknown as Record<string, unknown>[];

const EdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  kind: z.enum(["employs", "partner", "vendor", "customer", "subsidiary"]),
  strength: z.number(),
});
const edgeResource = defineResource({
  id: "party-relationships.relationship",
  singular: "Relationship",
  plural: "Relationships",
  schema: EdgeSchema,
  displayField: "id",
  icon: "Share2",
});
(edgeResource as unknown as { __seed: Record<string, unknown>[] }).__seed =
  EDGES as unknown as Record<string, unknown>[];

const partyNavSections = [{ id: "sales", label: "Sales & CRM", order: 10 }];
const partyNav = [
  { id: "party.control-room", label: "Party Control Room", icon: "LayoutDashboard", path: "/party-relationships/control-room", view: "party-relationships.control-room.view", section: "sales", order: 49 },
  { id: "party.graph", label: "Graph", icon: "Network", path: "/party-relationships/graph", view: "party-relationships.graph.view", section: "sales", order: 50 },
  { id: "party.list", label: "Relationships", icon: "Share2", path: "/party-relationships", view: "party-relationships.list.view", section: "sales", order: 51 },
  { id: "party.reports", label: "Reports", icon: "BarChart3", path: "/party-relationships/reports", view: "party-relationships.reports.view", section: "sales", order: 52 },
];
const partyResources = [entityResource, edgeResource];
const partyViews = [
  partyGraphView, partyListView, partyEntityDetailView,
  partyControlRoomView, partyReportsIndexView, partyReportsDetailView,
];
const partyCommands = [
  { id: "party.go.graph", label: "Relationships: Graph", icon: "Network", run: () => { window.location.hash = "/party-relationships/graph"; } },
  { id: "party.go.control-room", label: "Relationships: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/party-relationships/control-room"; } },
  { id: "party.go.reports", label: "Relationships: Reports", icon: "BarChart3", run: () => { window.location.hash = "/party-relationships/reports"; } },
];

export const partyRelationshipsPlugin = definePlugin({
  manifest: {
    id: "party-relationships",
    version: "0.2.0",
    label: "Relationships",
    description: "Companies, people, and connections.",
    icon: "Network",
    requires: {
      shell: "*",
      capabilities: ["resources:read", "resources:write", "nav", "commands"],
    },
    activationEvents: [{ kind: "onStart" }],
    origin: { kind: "explicit" },
  },
  async activate(ctx) {
    ctx.contribute.navSections(partyNavSections);
    ctx.contribute.nav(partyNav);
    ctx.contribute.resources(partyResources);
    ctx.contribute.views(partyViews);
    ctx.contribute.commands(partyCommands);
  },
});
