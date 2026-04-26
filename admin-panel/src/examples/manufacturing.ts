import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_TICKET, PRIORITY, STATUS_ACTIVE } from "./_factory/options";
import { code, daysAgo, daysFromNow, money, personName, pick } from "./_factory/seeds";
import {
  manufacturingControlRoomView,
  manufacturingReportsIndexView,
  manufacturingReportsDetailView,
} from "./manufacturing-dashboard";
import {
  manufacturingArchetypeBomView,
  manufacturingArchetypeNav,
} from "./manufacturing-archetype";

const PRODUCTS = ["Widget A", "Gizmo B", "Part C", "Bracket D", "Motor E", "Sensor F"];
const OPERATORS = ["Sam Hopper", "Alex Knuth", "Taylor Turing", "Jordan Hamilton", "Casey Pappas"];

export const manufacturingPlugin = buildDomainPlugin({
  id: "manufacturing",
  label: "Manufacturing",
  icon: "Factory",
  section: SECTIONS.supplyChain,
  order: 2,
  resources: [
    {
      id: "order",
      singular: "Production Order",
      plural: "Production Orders",
      icon: "Factory",
      path: "/manufacturing/orders",
      displayField: "code",
      defaultSort: { field: "dueAt", dir: "asc" },
      pageSize: 25,
      erp: {
        documentType: "manufacturing.Work Order",
        module: "Manufacturing",
        namingSeries: "MFG-WO-.YYYY.-.#####",
        statusField: "status",
        submittedStatuses: ["in_progress", "resolved"],
        mappingActions: [
          {
            id: "work-order-to-job-card",
            label: "Create Job Card",
            relation: "creates-job-card",
            targetResourceId: "manufacturing.job-card",
            targetDocumentType: "manufacturing.Job Card",
            visibleInStatuses: ["open", "in_progress"],
            fieldMap: { workOrder: "code", product: "sku", workCenter: "workCenter" },
            defaults: { status: "open" }
          },
          {
            id: "work-order-to-stock-entry",
            label: "Issue Materials",
            relation: "issues-materials",
            targetResourceId: "inventory.stock-entry",
            targetDocumentType: "stock.Stock Entry",
            visibleInStatuses: ["open", "in_progress"],
            fieldMap: { workOrder: "code", item: "sku", warehouse: "warehouse" },
            defaults: { status: "draft", kind: "manufacture" }
          }
        ],
        links: [
          { field: "bomCode", targetResourceId: "manufacturing.bom", reverseRelation: "work-orders" },
          { field: "routingCode", targetResourceId: "manufacturing.routing", reverseRelation: "work-orders" },
          { field: "workCenter", targetResourceId: "manufacturing.work-center", reverseRelation: "work-orders" }
        ],
        workspaceLinks: [
          { label: "MRP", path: "/manufacturing/reports/material-requirements", kind: "report", group: "Planning" },
          { label: "Work Order Summary", path: "/manufacturing/reports/work-order-summary", kind: "report", group: "Reports" }
        ],
        printFormats: [{ id: "work-order", label: "Work Order", default: true }]
      },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 120 },
        { name: "product", kind: "text", required: true, sortable: true },
        { name: "bomCode", label: "BOM", kind: "text" },
        { name: "routingCode", label: "Routing", kind: "text" },
        { name: "workCenter", kind: "text" },
        { name: "operator", kind: "text", sortable: true },
        { name: "priority", kind: "enum", options: PRIORITY },
        { name: "quantity", kind: "number", align: "right", required: true, sortable: true },
        { name: "completedQty", kind: "number", align: "right", sortable: true },
        { name: "wipQty", kind: "number", align: "right" },
        { name: "scrapQty", kind: "number", align: "right" },
        { name: "scrapRatePct", label: "Scrap %", kind: "number", align: "right", width: 90 },
        { name: "unitCost", kind: "currency", align: "right" },
        { name: "status", kind: "enum", required: true, options: STATUS_TICKET, sortable: true },
        { name: "startAt", kind: "date", sortable: true },
        { name: "dueAt", kind: "date", required: true, sortable: true, width: 130 },
        { name: "completedAt", kind: "date", sortable: true },
      ],
      seedCount: 30,
      seed: (i) => {
        const qty = 100 + ((i * 43) % 900);
        const completed = i % 3 === 2 ? qty : Math.round(qty * 0.7);
        const scrap = Math.round(qty * 0.03);
        return {
          code: code("MO", i, 6),
          product: pick(PRODUCTS, i),
          bomCode: code("BOM", i % 6, 4),
          routingCode: code("RTG", i % 4, 4),
          workCenter: pick(["WC-ASM-1", "WC-ASM-2", "WC-MACH-1", "WC-PACK-1"], i),
          operator: pick(OPERATORS, i),
          priority: pick(["low", "normal", "high"], i),
          quantity: qty,
          completedQty: completed,
          wipQty: qty - completed - scrap,
          scrapQty: scrap,
          scrapRatePct: Math.round((scrap / qty) * 100),
          unitCost: 10 + ((i * 7) % 80),
          status: pick(["open", "in_progress", "resolved"], i),
          startAt: daysAgo(i - 5),
          dueAt: daysFromNow(i % 20 - 3),
          completedAt: i % 3 === 2 ? daysAgo(i - 6) : "",
        };
      },
    },
    {
      id: "bom",
      singular: "Bill of Materials",
      plural: "BOMs",
      icon: "TreePine",
      path: "/manufacturing/boms",
      displayField: "code",
      erp: {
        documentType: "manufacturing.BOM",
        module: "Manufacturing",
        namingSeries: "BOM-.#####",
        childTables: [
          {
            field: "items",
            label: "Raw Materials",
            itemField: "item",
            quantityField: "qty",
            amountField: "amount",
            fields: [
              { name: "item", kind: "link", referenceTo: "inventory.item", required: true },
              { name: "qty", kind: "number", required: true },
              { name: "rate", kind: "currency" },
              { name: "amount", kind: "currency", readonly: true }
            ]
          },
          {
            field: "operations",
            label: "Operations",
            fields: [
              { name: "operation", kind: "link", referenceTo: "manufacturing.operation", required: true },
              { name: "workCenter", kind: "link", referenceTo: "manufacturing.work-center" },
              { name: "timeInMins", kind: "number" }
            ]
          }
        ],
        mappingActions: [
          {
            id: "bom-to-work-order",
            label: "Create Work Order",
            relation: "explodes-to",
            targetResourceId: "manufacturing.order",
            targetDocumentType: "manufacturing.Work Order",
            visibleInStatuses: ["active"],
            fieldMap: { bomCode: "code", sku: "product" },
            childTableMap: { items: "items", operations: "operations" },
            defaults: { status: "open" }
          }
        ],
        links: [{ field: "product", targetResourceId: "inventory.item", reverseRelation: "boms" }],
        printFormats: [{ id: "bom-costed", label: "Costed BOM", default: true }]
      },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 120 },
        { name: "product", kind: "text", required: true, sortable: true },
        { name: "version", kind: "text", sortable: true, width: 100 },
        { name: "quantity", kind: "number", align: "right" },
        { name: "itemsCount", label: "Items", kind: "number", align: "right", width: 90 },
        { name: "materialCost", kind: "currency", align: "right" },
        { name: "laborCost", kind: "currency", align: "right" },
        { name: "overheadCost", kind: "currency", align: "right" },
        { name: "totalCost", kind: "currency", align: "right", sortable: true },
        { name: "active", kind: "boolean" },
      ],
      seedCount: 10,
      seed: (i) => {
        const mat = money(i, 20, 400);
        const lab = money(i + 1, 10, 200);
        const ovh = Math.round((mat + lab) * 0.15);
        return {
          code: code("BOM", i, 4),
          product: pick(PRODUCTS, i),
          version: `v${1 + (i % 5)}`,
          quantity: 1 + (i % 5),
          itemsCount: 3 + (i % 12),
          materialCost: mat,
          laborCost: lab,
          overheadCost: ovh,
          totalCost: mat + lab + ovh,
          active: i !== 9,
        };
      },
    },
    {
      id: "routing",
      singular: "Routing",
      plural: "Routings",
      icon: "GitBranch",
      path: "/manufacturing/routings",
      displayField: "code",
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 100 },
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "product", kind: "text" },
        { name: "operationsCount", kind: "number", align: "right" },
        { name: "totalMinutes", kind: "number", align: "right" },
        { name: "active", kind: "boolean" },
      ],
      seedCount: 6,
      seed: (i) => ({
        code: code("RTG", i, 4),
        name: pick(["Assembly routing", "Machining routing", "Pack + ship", "QA routing", "Rework routing"], i),
        product: pick(PRODUCTS, i),
        operationsCount: 2 + (i % 6),
        totalMinutes: 30 + (i * 15) % 240,
        active: i !== 5,
      }),
    },
    {
      id: "work-center",
      singular: "Work Center",
      plural: "Work Centers",
      icon: "Settings",
      path: "/manufacturing/work-centers",
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 100 },
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "kind", label: "Type", kind: "enum", options: [
          { value: "assembly", label: "Assembly" },
          { value: "machining", label: "Machining" },
          { value: "welding", label: "Welding" },
          { value: "packaging", label: "Packaging" },
          { value: "qa", label: "QA" },
        ] },
        { name: "location", kind: "text" },
        { name: "capacityHrs", label: "Capacity (hrs/wk)", kind: "number", align: "right", width: 140 },
        { name: "scheduledHrs", label: "Scheduled (hrs/wk)", kind: "number", align: "right", width: 140 },
        { name: "hourlyRate", kind: "currency", align: "right" },
        { name: "status", kind: "enum", options: STATUS_ACTIVE },
      ],
      seedCount: 8,
      seed: (i) => ({
        code: pick(["WC-ASM-1", "WC-ASM-2", "WC-MACH-1", "WC-MACH-2", "WC-WELD-1", "WC-PACK-1", "WC-QA-1", "WC-REWORK-1"], i),
        name: pick(["Assembly Line 1", "Assembly Line 2", "Machining Cell 1", "Machining Cell 2", "Welding Bay", "Packing Line", "QA Cell", "Rework Station"], i),
        kind: pick(["assembly", "assembly", "machining", "machining", "welding", "packaging", "qa", "assembly"], i),
        location: pick(["Plant A", "Plant A", "Plant B", "Plant B"], i),
        capacityHrs: 40 * (1 + (i % 3)),
        scheduledHrs: 30 + (i * 4) % 40,
        hourlyRate: 60 + (i * 5) % 40,
        status: i === 7 ? "inactive" : "active",
      }),
    },
    {
      id: "operation",
      singular: "Operation",
      plural: "Operations",
      icon: "ListOrdered",
      path: "/manufacturing/operations",
      fields: [
        { name: "code", kind: "text", required: true, sortable: true },
        { name: "routingCode", kind: "text", sortable: true },
        { name: "sequence", kind: "number", align: "right", width: 90 },
        { name: "name", kind: "text", required: true },
        { name: "workCenter", kind: "text" },
        { name: "setupMinutes", kind: "number", align: "right" },
        { name: "runMinutesPerUnit", kind: "number", align: "right" },
        { name: "active", kind: "boolean" },
      ],
      seedCount: 20,
      seed: (i) => ({
        code: code("OP", i, 5),
        routingCode: code("RTG", i % 6, 4),
        sequence: (i % 10) + 10,
        name: pick(["Cut", "Drill", "Assemble", "Weld", "Sand", "Paint", "Test", "Pack", "Label", "Inspect"], i),
        workCenter: pick(["WC-ASM-1", "WC-ASM-2", "WC-MACH-1", "WC-PACK-1"], i),
        setupMinutes: 5 + (i % 10),
        runMinutesPerUnit: 0.5 + (i * 0.1) % 3,
        active: true,
      }),
    },
    {
      id: "material-consumption",
      singular: "Material Consumption",
      plural: "Material Consumptions",
      icon: "Boxes",
      path: "/manufacturing/material-consumption",
      defaultSort: { field: "consumedAt", dir: "desc" },
      fields: [
        { name: "orderCode", label: "MO", kind: "text", required: true, sortable: true },
        { name: "itemSku", kind: "text", required: true },
        { name: "itemName", kind: "text" },
        { name: "plannedQty", kind: "number", align: "right" },
        { name: "actualQty", kind: "number", align: "right" },
        { name: "unitCost", kind: "currency", align: "right" },
        { name: "totalCost", kind: "currency", align: "right", sortable: true },
        { name: "consumedAt", kind: "date", sortable: true },
      ],
      seedCount: 30,
      seed: (i) => {
        const planned = 10 + (i * 3) % 50;
        const actual = planned + ((i % 3) - 1);
        const unitCost = 5 + (i * 2) % 50;
        return {
          orderCode: code("MO", i % 30, 6),
          itemSku: `SKU-${String(1000 + i).slice(-5)}`,
          itemName: pick(["Raw Steel", "Bolt M8", "Wire Harness", "Paint", "Solder", "Foam Insert"], i),
          plannedQty: planned,
          actualQty: actual,
          unitCost,
          totalCost: actual * unitCost,
          consumedAt: daysAgo(i),
        };
      },
    },
    {
      id: "job-card",
      singular: "Job Card",
      plural: "Job Cards",
      icon: "Clipboard",
      path: "/manufacturing/job-cards",
      displayField: "code",
      defaultSort: { field: "startedAt", dir: "desc" },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true },
        { name: "orderCode", label: "MO", kind: "text", required: true },
        { name: "operation", kind: "text" },
        { name: "operator", kind: "text" },
        { name: "workCenter", kind: "text" },
        { name: "startedAt", kind: "datetime", sortable: true },
        { name: "completedAt", kind: "datetime" },
        { name: "plannedMinutes", kind: "number", align: "right" },
        { name: "actualMinutes", kind: "number", align: "right" },
        { name: "efficiency", label: "Efficiency %", kind: "number", align: "right", width: 110 },
        { name: "status", kind: "enum", options: STATUS_TICKET, sortable: true },
      ],
      seedCount: 24,
      seed: (i) => {
        const planned = 30 + (i * 5) % 120;
        const actual = planned + ((i * 3) % 30) - 15;
        return {
          code: code("JC", i, 5),
          orderCode: code("MO", i % 30, 6),
          operation: pick(["Cut", "Drill", "Assemble", "Weld", "Test", "Pack"], i),
          operator: pick(OPERATORS, i),
          workCenter: pick(["WC-ASM-1", "WC-ASM-2", "WC-MACH-1", "WC-PACK-1"], i),
          startedAt: daysAgo(i),
          completedAt: daysAgo(i - 0.2),
          plannedMinutes: planned,
          actualMinutes: actual,
          efficiency: Math.round((planned / Math.max(actual, 1)) * 100),
          status: pick(["resolved", "resolved", "in_progress"], i),
        };
      },
    },
  ],
  extraNav: [
    ...manufacturingArchetypeNav,
    { id: "manufacturing.control-room.nav", label: "Manufacturing Control Room", icon: "LayoutDashboard", path: "/manufacturing/control-room", view: "manufacturing.control-room.view", order: 0 },
    { id: "manufacturing.reports.nav", label: "Reports", icon: "BarChart3", path: "/manufacturing/reports", view: "manufacturing.reports.view" },
  ],
  extraViews: [
    manufacturingArchetypeBomView,
    manufacturingControlRoomView,
    manufacturingReportsIndexView,
    manufacturingReportsDetailView,
  ],
  commands: [
    { id: "manufacturing.go.control-room", label: "Manufacturing: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/manufacturing/control-room"; } },
    { id: "manufacturing.go.reports", label: "Manufacturing: Reports", icon: "BarChart3", run: () => { window.location.hash = "/manufacturing/reports"; } },
    { id: "manufacturing.new-mo", label: "New production order", icon: "Plus", run: () => { window.location.hash = "/manufacturing/orders/new"; } },
    { id: "manufacturing.new-bom", label: "New BOM", icon: "TreePine", run: () => { window.location.hash = "/manufacturing/boms/new"; } },
    { id: "manufacturing.new-routing", label: "New routing", icon: "GitBranch", run: () => { window.location.hash = "/manufacturing/routings/new"; } },
    { id: "manufacturing.new-jc", label: "New job card", icon: "Clipboard", run: () => { window.location.hash = "/manufacturing/job-cards/new"; } },
  ],
});
