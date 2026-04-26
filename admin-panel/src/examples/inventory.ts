import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_LIFECYCLE, CURRENCY } from "./_factory/options";
import { code, daysAgo, daysFromNow, money, pick } from "./_factory/seeds";
import { inventoryAlertsView } from "./inventory-pages";
import {
  inventoryControlRoomView,
  inventoryReportsIndexView,
  inventoryReportsDetailView,
} from "./inventory-dashboard";
import {
  inventoryArchetypeDashboardView,
  inventoryArchetypeListView,
  inventoryArchetypeNav,
} from "./inventory-archetype";

const ITEMS = [
  "Widget A", "Gizmo B", "Part C", "Bracket D", "Screw E", "Nut F", "Bolt G", "Washer H",
  "Spring I", "Clip J", "Seal K", "Gear L", "Shaft M", "Bearing N", "Motor O", "Sensor P",
] as const;
const WAREHOUSES = ["SFO", "AUS", "LHR", "FRA", "NRT", "SYD"] as const;
const SUPPLIERS = ["Acme Supply", "Globex Parts", "Initech Components", "Umbrella Hardware", "Hooli Logistics"] as const;
const UOM = [
  { value: "each", label: "Each" },
  { value: "kg", label: "Kilogram" },
  { value: "g", label: "Gram" },
  { value: "l", label: "Litre" },
  { value: "m", label: "Metre" },
  { value: "pack", label: "Pack" },
  { value: "box", label: "Box" },
];

export const inventoryPlugin = buildDomainPlugin({
  id: "inventory",
  label: "Inventory",
  icon: "Boxes",
  section: SECTIONS.supplyChain,
  order: 1,
  resources: [
    {
      id: "item",
      singular: "Item",
      plural: "Items",
      icon: "Box",
      path: "/inventory/items",
      erp: {
        documentType: "stock.Item",
        module: "Stock",
        titleField: "name",
        childTables: [
          {
            field: "barcodes",
            label: "Barcodes",
            fields: [
              { name: "barcode", kind: "text", required: true },
              { name: "uom", kind: "text" }
            ]
          },
          {
            field: "suppliers",
            label: "Suppliers",
            fields: [
              { name: "supplier", kind: "link", referenceTo: "party.entity", required: true },
              { name: "supplierPartNo", kind: "text" }
            ]
          },
          {
            field: "reorderLevels",
            label: "Reorder Levels",
            quantityField: "reorderQty",
            fields: [
              { name: "warehouse", kind: "link", referenceTo: "inventory.warehouse", required: true },
              { name: "reorderPoint", kind: "number", required: true },
              { name: "reorderQty", kind: "number", required: true }
            ]
          }
        ],
        links: [
          { field: "preferredSupplier", targetResourceId: "party.entity", reverseRelation: "supplied-items" }
        ],
        workspaceLinks: [
          { label: "Stock Ledger", path: "/inventory/reports/stock-ledger", kind: "report", group: "Reports" },
          { label: "Stock Balance", path: "/inventory/reports/stock-balance", kind: "report", group: "Reports" },
          { label: "Item Prices", path: "/inventory/item-prices", kind: "document", group: "Setup" }
        ],
        printFormats: [{ id: "item-label", label: "Item Label", default: true }]
      },
      fields: [
        { name: "sku", label: "SKU", kind: "text", required: true, sortable: true, width: 110 },
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "category", kind: "enum", options: [
          { value: "raw", label: "Raw materials" },
          { value: "wip", label: "Work in progress" },
          { value: "finished", label: "Finished goods" },
          { value: "service", label: "Service" },
        ], sortable: true },
        { name: "uom", label: "UoM", kind: "enum", options: UOM, width: 110 },
        { name: "onHand", label: "On hand", kind: "number", align: "right", sortable: true },
        { name: "reservedQty", label: "Reserved", kind: "number", align: "right" },
        { name: "incomingQty", label: "Incoming", kind: "number", align: "right" },
        { name: "outgoingQty", label: "Outgoing", kind: "number", align: "right" },
        { name: "reorderPoint", label: "Reorder @", kind: "number", align: "right" },
        { name: "reorderQty", label: "Reorder Qty", kind: "number", align: "right" },
        { name: "unitCost", kind: "currency", align: "right", sortable: true },
        { name: "inventoryValue", label: "Value", kind: "currency", align: "right", sortable: true, readonly: true },
        { name: "avgDailyUsage", label: "Avg/day", kind: "number", align: "right" },
        { name: "belowReorder", label: "Below reorder", kind: "boolean", width: 130 },
        { name: "valuationMethod", label: "Valuation", kind: "enum", options: [
          { value: "fifo", label: "FIFO" },
          { value: "lifo", label: "LIFO" },
          { value: "average", label: "Moving Average" },
        ], width: 150 },
        { name: "preferredSupplier", label: "Supplier", kind: "text" },
        { name: "nextPoEta", label: "Next PO ETA", kind: "date" },
        { name: "lastReceivedAt", label: "Last received", kind: "date" },
        { name: "hsCode", label: "HS Code", kind: "text", width: 120 },
        { name: "barcode", label: "Barcode", kind: "text" },
        { name: "active", label: "Active", kind: "boolean" },
        { name: "description", label: "Description", kind: "textarea", formSection: "Notes" },
      ],
      seedCount: 40,
      seed: (i) => {
        const onHand = (i * 13) % 500;
        const reorder = 20 + ((i * 7) % 60);
        const unitCost = money(i, 1, 200);
        return {
          sku: code("SKU", i, 5),
          name: `${pick(ITEMS, i)} #${i}`,
          category: pick(["raw", "wip", "finished", "service"], i),
          uom: pick(["each", "kg", "m", "pack", "box"], i),
          onHand,
          reservedQty: Math.min(onHand, (i * 3) % 40),
          incomingQty: (i * 5) % 60,
          outgoingQty: (i * 7) % 80,
          reorderPoint: reorder,
          reorderQty: reorder * 3,
          unitCost,
          inventoryValue: Math.round(onHand * unitCost),
          avgDailyUsage: Math.max(1, (i * 2) % 20),
          belowReorder: onHand <= reorder,
          valuationMethod: pick(["fifo", "average", "lifo"], i),
          preferredSupplier: pick(SUPPLIERS, i),
          nextPoEta: daysFromNow((i % 30) + 3),
          lastReceivedAt: daysAgo((i * 13) % 180),
          hsCode: `${8400 + (i * 7) % 500}.${String(i % 100).padStart(2, "0")}`,
          barcode: `${1234567800000 + i * 17}`,
          active: i % 20 !== 0,
          description: "",
        };
      },
    },
    {
      id: "warehouse",
      singular: "Warehouse",
      plural: "Warehouses",
      icon: "Warehouse",
      path: "/inventory/warehouses",
      erp: {
        documentType: "stock.Warehouse",
        module: "Stock",
        titleField: "name",
        links: [{ field: "parentId", targetResourceId: "inventory.warehouse", reverseRelation: "children" }],
        workspaceLinks: [
          { label: "Warehouse-wise Balance", path: "/inventory/reports/warehouse-wise-balance", kind: "report", group: "Reports" },
          { label: "Stock Entries", path: "/inventory/stock-entries", kind: "document", group: "Operations" }
        ]
      },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 100 },
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "city", kind: "text" },
        { name: "country", kind: "text", width: 110 },
        { name: "capacity", kind: "number", align: "right", sortable: true },
        { name: "utilization", label: "Utilization %", kind: "number", align: "right" },
        { name: "manager", kind: "text" },
        { name: "kind", label: "Type", kind: "enum", options: [
          { value: "main", label: "Main" },
          { value: "transit", label: "Transit" },
          { value: "quarantine", label: "Quarantine" },
          { value: "rejected", label: "Rejected" },
          { value: "consignment", label: "Consignment" },
        ], width: 140 },
        { name: "status", kind: "enum", options: [
          { value: "active", label: "Active", intent: "success" },
          { value: "inactive", label: "Inactive", intent: "neutral" },
        ] },
      ],
      seedCount: 8,
      seed: (i) => ({
        code: `WH-${pick(WAREHOUSES, i)}`,
        name: pick(["San Francisco", "Austin", "London", "Frankfurt", "Tokyo", "Sydney", "Singapore", "Toronto"], i) + " DC",
        city: pick(["San Francisco", "Austin", "London", "Frankfurt", "Tokyo", "Sydney", "Singapore", "Toronto"], i),
        country: pick(["USA", "USA", "UK", "DE", "JP", "AU", "SG", "CA"], i),
        capacity: 50_000 + ((i * 10_000) % 200_000),
        utilization: 40 + ((i * 7) % 55),
        manager: pick(["Sam", "Alex", "Taylor", "Jordan", "Casey"], i),
        kind: pick(["main", "main", "transit", "quarantine", "consignment"], i),
        status: i === 7 ? "inactive" : "active",
      }),
    },
    {
      id: "bin",
      singular: "Bin",
      plural: "Bins",
      icon: "PackageOpen",
      path: "/inventory/bins",
      displayField: "sku",
      defaultSort: { field: "onHand", dir: "desc" },
      fields: [
        { name: "sku", label: "SKU", kind: "text", required: true, sortable: true, width: 120 },
        { name: "warehouse", label: "Warehouse", kind: "text", required: true, sortable: true, width: 140 },
        { name: "location", label: "Location", kind: "text", width: 120 },
        { name: "onHand", label: "On hand", kind: "number", required: true, align: "right", sortable: true },
        { name: "reserved", kind: "number", align: "right" },
        { name: "available", kind: "number", align: "right" },
        { name: "unitCost", kind: "currency", align: "right" },
      ],
      seedCount: 80,
      seed: (i) => {
        const onHand = (i * 11) % 500;
        const reserved = (i * 3) % 50;
        return {
          sku: code("SKU", i % 40, 5),
          warehouse: pick(["SFO DC", "AUS DC", "LHR DC", "FRA DC", "NRT DC", "SYD DC"], i),
          location: `A-${String(Math.floor(i / 10)).padStart(2, "0")}-${String(i % 10).padStart(2, "0")}`,
          onHand,
          reserved,
          available: Math.max(0, onHand - reserved),
          unitCost: money(i, 1, 200),
        };
      },
    },
    {
      id: "item-variant",
      singular: "Item Variant",
      plural: "Item Variants",
      icon: "Puzzle",
      path: "/inventory/item-variants",
      fields: [
        { name: "sku", label: "Variant SKU", kind: "text", required: true, sortable: true, width: 130 },
        { name: "parentSku", label: "Parent", kind: "text", required: true, sortable: true, width: 130 },
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "attributes", label: "Attributes", kind: "text" },
        { name: "unitCost", kind: "currency", align: "right" },
        { name: "active", kind: "boolean" },
      ],
      seedCount: 20,
      seed: (i) => ({
        sku: code("SKV", i, 6),
        parentSku: code("SKU", i % 10, 5),
        name: `${pick(ITEMS, i)} — ${pick(["Red", "Blue", "Small", "Large", "XL", "Matte", "Glossy"], i)}`,
        attributes: pick(["Color: Red", "Color: Blue, Size: L", "Finish: Matte", "Size: XL", "Color: Black"], i),
        unitCost: money(i, 1, 250),
        active: true,
      }),
    },
    {
      id: "item-price",
      singular: "Item Price",
      plural: "Item Prices",
      icon: "Tag",
      path: "/inventory/item-prices",
      fields: [
        { name: "sku", kind: "text", required: true, sortable: true, width: 120 },
        { name: "priceList", label: "Price list", kind: "enum", options: [
          { value: "standard-selling", label: "Standard Selling" },
          { value: "standard-buying", label: "Standard Buying" },
          { value: "wholesale", label: "Wholesale" },
          { value: "retail", label: "Retail" },
        ], sortable: true, width: 160 },
        { name: "price", kind: "currency", align: "right", required: true, sortable: true },
        { name: "currency", kind: "enum", options: CURRENCY, width: 100 },
        { name: "validFrom", kind: "date" },
        { name: "validTo", kind: "date" },
      ],
      seedCount: 30,
      seed: (i) => ({
        sku: code("SKU", i % 15, 5),
        priceList: pick(["standard-selling", "standard-buying", "wholesale", "retail"], i),
        price: money(i, 5, 400),
        currency: pick(["USD", "EUR", "GBP"], i),
        validFrom: daysAgo(30),
        validTo: daysFromNow(365),
      }),
    },
    {
      id: "stock-entry",
      singular: "Stock Entry",
      plural: "Stock Entries",
      icon: "ArrowLeftRight",
      path: "/inventory/stock-entries",
      displayField: "code",
      defaultSort: { field: "postedAt", dir: "desc" },
      erp: {
        documentType: "stock.Stock Entry",
        module: "Stock",
        namingSeries: "MAT-STE-.YYYY.-.#####",
        statusField: "status",
        submittedStatuses: ["approved", "published"],
        childTables: [
          {
            field: "items",
            label: "Items",
            itemField: "item",
            quantityField: "qty",
            amountField: "amount",
            fields: [
              { name: "item", kind: "link", referenceTo: "inventory.item", required: true },
              { name: "sourceWarehouse", kind: "link", referenceTo: "inventory.warehouse" },
              { name: "targetWarehouse", kind: "link", referenceTo: "inventory.warehouse" },
              { name: "qty", kind: "number", required: true },
              { name: "basicRate", kind: "currency" },
              { name: "amount", kind: "currency", readonly: true },
              { name: "batch", kind: "link", referenceTo: "inventory.batch" },
              { name: "serialNumbers", kind: "textarea" }
            ]
          }
        ],
        mappingActions: [
          {
            id: "stock-entry-to-gl",
            label: "Post Stock Value",
            relation: "posts-to",
            targetResourceId: "accounting.journal-entry",
            targetDocumentType: "accounts.Journal Entry",
            visibleInStatuses: ["approved", "published"],
            fieldMap: { referenceNo: "code", amount: "value" },
            defaults: { status: "draft", entryType: "Stock Value" }
          }
        ],
        links: [
          { field: "sku", targetResourceId: "inventory.item", reverseRelation: "stock-entries" },
          { field: "warehouse", targetResourceId: "inventory.warehouse", reverseRelation: "stock-entries" }
        ],
        printFormats: [{ id: "stock-entry", label: "Stock Entry", default: true }]
      },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 120 },
        { name: "postedAt", label: "Posted", kind: "date", required: true, sortable: true, width: 130 },
        { name: "kind", label: "Type", kind: "enum", required: true, sortable: true, options: [
          { value: "receipt", label: "Receipt", intent: "success" },
          { value: "issue", label: "Issue", intent: "warning" },
          { value: "transfer", label: "Transfer", intent: "info" },
          { value: "reconciliation", label: "Reconciliation", intent: "neutral" },
          { value: "manufacture", label: "Manufacture", intent: "accent" },
        ], width: 130 },
        { name: "sku", kind: "text", required: true, sortable: true, width: 120 },
        { name: "warehouse", kind: "text", required: true, sortable: true, width: 140 },
        { name: "qty", kind: "number", required: true, align: "right", sortable: true },
        { name: "direction", kind: "enum", options: [
          { value: "in", label: "In", intent: "success" },
          { value: "out", label: "Out", intent: "warning" },
        ], width: 90 },
        { name: "reference", kind: "text", width: 150 },
        { name: "unitCost", kind: "currency", align: "right" },
        { name: "postedBy", kind: "text", width: 140 },
        { name: "status", kind: "enum", options: STATUS_LIFECYCLE, sortable: true },
        { name: "notes", kind: "textarea", formSection: "Notes" },
      ],
      seedCount: 60,
      seed: (i) => ({
        code: code("STK", i, 6),
        postedAt: daysAgo(i * 0.5),
        kind: pick(["receipt", "issue", "transfer", "manufacture", "reconciliation"], i),
        sku: code("SKU", i % 20, 5),
        warehouse: pick(["SFO DC", "AUS DC", "LHR DC", "FRA DC"], i),
        qty: 5 + ((i * 17) % 200),
        direction: i % 3 === 0 ? "out" : "in",
        reference: pick(["PO-1201", "SO-3308", "TFR-902", "MO-1104"], i),
        unitCost: money(i, 1, 200),
        postedBy: pick(["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev"], i),
        status: pick(["published", "published", "approved", "pending"], i),
        notes: "",
      }),
    },
    {
      id: "material-request",
      singular: "Material Request",
      plural: "Material Requests",
      icon: "ClipboardList",
      path: "/inventory/material-requests",
      displayField: "code",
      defaultSort: { field: "neededBy", dir: "asc" },
      erp: {
        documentType: "stock.Material Request",
        module: "Stock",
        namingSeries: "MAT-MR-.YYYY.-.#####",
        statusField: "status",
        submittedStatuses: ["submitted", "partially-fulfilled", "fulfilled"],
        childTables: [
          {
            field: "items",
            label: "Items",
            itemField: "item",
            quantityField: "quantity",
            fields: [
              { name: "item", kind: "link", referenceTo: "inventory.item", required: true },
              { name: "quantity", kind: "number", required: true },
              { name: "warehouse", kind: "link", referenceTo: "inventory.warehouse" },
              { name: "requiredBy", kind: "date" }
            ]
          }
        ],
        mappingActions: [
          {
            id: "material-request-to-stock-entry",
            label: "Create Stock Entry",
            relation: "fulfilled-by",
            targetResourceId: "inventory.stock-entry",
            targetDocumentType: "stock.Stock Entry",
            visibleInStatuses: ["submitted", "partially-fulfilled"],
            childTableMap: { items: "items" },
            defaults: { status: "draft", kind: "issue" }
          },
          {
            id: "material-request-to-purchase-order",
            label: "Create Purchase Order",
            relation: "ordered-by",
            targetResourceId: "procurement.purchase-order",
            targetDocumentType: "buying.Purchase Order",
            visibleInStatuses: ["submitted"],
            childTableMap: { items: "items" },
            defaults: { status: "draft" }
          }
        ],
        workspaceLinks: [
          { label: "Stock Entries", path: "/inventory/stock-entries", kind: "document", group: "Fulfillment" },
          { label: "Purchase Orders", path: "/procurement/pos", kind: "document", group: "Procurement" }
        ]
      },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 120 },
        { name: "purpose", label: "Purpose", kind: "enum", required: true, options: [
          { value: "purchase", label: "Purchase" },
          { value: "transfer", label: "Transfer" },
          { value: "issue", label: "Material Issue" },
          { value: "manufacture", label: "Manufacture" },
        ], width: 130 },
        { name: "sku", kind: "text", required: true, sortable: true, width: 120 },
        { name: "qty", kind: "number", required: true, align: "right" },
        { name: "warehouse", kind: "text", width: 140 },
        { name: "neededBy", kind: "date", required: true, sortable: true, width: 130 },
        { name: "requestedBy", label: "Requested by", kind: "text", width: 150 },
        { name: "status", kind: "enum", required: true, sortable: true, options: [
          { value: "draft", label: "Draft", intent: "neutral" },
          { value: "submitted", label: "Submitted", intent: "info" },
          { value: "partially-fulfilled", label: "Partially fulfilled", intent: "warning" },
          { value: "fulfilled", label: "Fulfilled", intent: "success" },
          { value: "cancelled", label: "Cancelled", intent: "danger" },
        ] },
        { name: "linkedPo", label: "Linked PO", kind: "text", width: 130 },
        { name: "notes", kind: "textarea", formSection: "Notes" },
      ],
      seedCount: 24,
      seed: (i) => ({
        code: code("MR", i, 5),
        purpose: pick(["purchase", "transfer", "issue", "manufacture"], i),
        sku: code("SKU", i % 15, 5),
        qty: 20 + ((i * 19) % 300),
        warehouse: pick(["SFO DC", "AUS DC", "LHR DC", "FRA DC"], i),
        neededBy: daysFromNow((i % 30) + 3),
        requestedBy: pick(["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev"], i),
        status: pick(["submitted", "submitted", "partially-fulfilled", "fulfilled", "draft"], i),
        linkedPo: i % 3 === 0 ? code("PO", i, 4) : "",
        notes: "",
      }),
    },
    {
      id: "delivery-note",
      singular: "Delivery Note",
      plural: "Delivery Notes",
      icon: "Truck",
      path: "/inventory/delivery-notes",
      displayField: "code",
      defaultSort: { field: "deliveredAt", dir: "desc" },
      erp: {
        documentType: "stock.Delivery Note",
        module: "Stock",
        namingSeries: "MAT-DN-.YYYY.-.#####",
        statusField: "status",
        submittedStatuses: ["submitted", "in-transit", "delivered"],
        childTables: [
          {
            field: "items",
            label: "Items",
            itemField: "item",
            quantityField: "quantity",
            amountField: "amount",
            fields: [
              { name: "item", kind: "link", referenceTo: "inventory.item", required: true },
              { name: "quantity", kind: "number", required: true },
              { name: "warehouse", kind: "link", referenceTo: "inventory.warehouse", required: true },
              { name: "rate", kind: "currency" },
              { name: "amount", kind: "currency", readonly: true },
              { name: "batch", kind: "link", referenceTo: "inventory.batch" },
              { name: "serialNumbers", kind: "textarea" }
            ]
          }
        ],
        links: [
          { field: "customer", targetResourceId: "party.entity", reverseRelation: "delivery-notes" },
          { field: "linkedSo", targetResourceId: "sales.order", reverseRelation: "delivery-notes" }
        ],
        mappingActions: [
          {
            id: "delivery-note-to-sales-invoice",
            label: "Create Sales Invoice",
            relation: "billed-by",
            targetResourceId: "accounting.invoice",
            targetDocumentType: "accounts.Sales Invoice",
            visibleInStatuses: ["delivered", "submitted"],
            fieldMap: { customer: "customer", salesOrder: "linkedSo", amount: "amount" },
            childTableMap: { items: "items" },
            defaults: { status: "draft" }
          },
          {
            id: "delivery-note-to-packing-slip",
            label: "Create Packing Slip",
            relation: "packed-by",
            targetResourceId: "inventory.packing-slip",
            targetDocumentType: "stock.Packing Slip",
            visibleInStatuses: ["submitted", "in-transit"],
            fieldMap: { customer: "customer", linkedSo: "linkedSo" },
            childTableMap: { items: "items" },
            defaults: { status: "draft" }
          }
        ],
        printFormats: [{ id: "delivery-note", label: "Delivery Note", default: true }],
        portal: { route: "/shipments/:id", audience: "customer", enabledByDefault: true },
        workspaceLinks: [
          { label: "Stock Ledger", path: "/inventory/reports/stock-ledger", kind: "report", group: "Ledger" },
          { label: "Sales Invoices", path: "/accounting/invoices", kind: "document", group: "Billing" }
        ]
      },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 120 },
        { name: "customer", kind: "text", required: true, sortable: true },
        { name: "deliveredAt", kind: "date", required: true, sortable: true, width: 130 },
        { name: "warehouse", kind: "text", width: 140 },
        { name: "carrier", kind: "enum", options: [
          { value: "fedex", label: "FedEx" },
          { value: "ups", label: "UPS" },
          { value: "dhl", label: "DHL" },
          { value: "usps", label: "USPS" },
          { value: "self", label: "Self delivery" },
        ] },
        { name: "tracking", kind: "text", width: 160 },
        { name: "amount", kind: "currency", align: "right" },
        { name: "status", kind: "enum", required: true, sortable: true, options: [
          { value: "draft", label: "Draft", intent: "neutral" },
          { value: "submitted", label: "Submitted", intent: "info" },
          { value: "in-transit", label: "In transit", intent: "warning" },
          { value: "delivered", label: "Delivered", intent: "success" },
          { value: "returned", label: "Returned", intent: "danger" },
        ] },
        { name: "linkedSo", label: "Sales Order", kind: "text", width: 130 },
      ],
      seedCount: 30,
      seed: (i) => ({
        code: code("DN", i, 6),
        customer: pick(["Acme Corp", "Globex", "Initech", "Hooli", "Pied Piper", "Dunder Mifflin"], i),
        deliveredAt: daysAgo(i * 0.5),
        warehouse: pick(["SFO DC", "AUS DC", "LHR DC"], i),
        carrier: pick(["fedex", "ups", "dhl", "usps"], i),
        tracking: `TRK${String(1000000000 + i * 317).slice(-10)}`,
        amount: money(i, 50, 8000),
        status: pick(["delivered", "delivered", "in-transit", "submitted", "returned"], i),
        linkedSo: code("SO", i, 4),
      }),
    },
    {
      id: "purchase-receipt",
      singular: "Purchase Receipt",
      plural: "Purchase Receipts",
      icon: "PackageCheck",
      path: "/inventory/purchase-receipts",
      displayField: "code",
      defaultSort: { field: "receivedAt", dir: "desc" },
      erp: {
        documentType: "stock.Purchase Receipt",
        module: "Stock",
        namingSeries: "MAT-PRE-.YYYY.-.#####",
        statusField: "status",
        submittedStatuses: ["approved", "published"],
        childTables: [
          {
            field: "items",
            label: "Items",
            itemField: "item",
            quantityField: "quantity",
            amountField: "amount",
            fields: [
              { name: "item", kind: "link", referenceTo: "inventory.item", required: true },
              { name: "quantity", kind: "number", required: true },
              { name: "acceptedWarehouse", kind: "link", referenceTo: "inventory.warehouse" },
              { name: "rejectedWarehouse", kind: "link", referenceTo: "inventory.warehouse" },
              { name: "rate", kind: "currency" },
              { name: "amount", kind: "currency" }
            ]
          }
        ],
        links: [
          { field: "supplier", targetResourceId: "procurement.supplier", reverseRelation: "purchase-receipts" },
          { field: "linkedPo", targetResourceId: "procurement.purchase-order", reverseRelation: "purchase-receipts" }
        ],
        mappingActions: [
          {
            id: "purchase-receipt-to-purchase-invoice",
            label: "Create Purchase Invoice",
            relation: "billed-by",
            targetResourceId: "accounting.bill",
            targetDocumentType: "accounts.Purchase Invoice",
            visibleInStatuses: ["approved", "published"],
            fieldMap: { vendor: "supplier", purchaseReceipt: "code", amount: "amount" },
            childTableMap: { items: "items" },
            defaults: { status: "draft" }
          },
          {
            id: "purchase-receipt-to-stock-entry",
            label: "Post Stock Ledger",
            relation: "posts-stock",
            targetResourceId: "inventory.stock-entry",
            targetDocumentType: "stock.Stock Entry",
            visibleInStatuses: ["approved", "published"],
            fieldMap: { supplier: "supplier", linkedPo: "linkedPo" },
            childTableMap: { items: "items" },
            defaults: { status: "draft", kind: "receipt" }
          }
        ],
        printFormats: [{ id: "purchase-receipt", label: "Purchase Receipt", default: true }],
        portal: { route: "/supplier/receipts/:id", audience: "supplier", enabledByDefault: true },
        workspaceLinks: [
          { label: "Stock Ledger", path: "/inventory/reports/stock-ledger", kind: "report", group: "Ledger" },
          { label: "Purchase Invoices", path: "/accounting/bills", kind: "document", group: "Billing" }
        ]
      },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 120 },
        { name: "supplier", kind: "text", required: true, sortable: true },
        { name: "receivedAt", kind: "date", required: true, sortable: true, width: 130 },
        { name: "warehouse", kind: "text", width: 140 },
        { name: "amount", kind: "currency", align: "right" },
        { name: "qcStatus", label: "QC Status", kind: "enum", options: [
          { value: "pending", label: "Pending", intent: "warning" },
          { value: "passed", label: "Passed", intent: "success" },
          { value: "partial", label: "Partial", intent: "info" },
          { value: "rejected", label: "Rejected", intent: "danger" },
        ] },
        { name: "status", kind: "enum", required: true, sortable: true, options: STATUS_LIFECYCLE },
        { name: "linkedPo", label: "Purchase Order", kind: "text", width: 130 },
      ],
      seedCount: 30,
      seed: (i) => ({
        code: code("PR", i, 6),
        supplier: pick(SUPPLIERS, i),
        receivedAt: daysAgo(i * 0.7),
        warehouse: pick(["SFO DC", "AUS DC", "LHR DC"], i),
        amount: money(i, 500, 25000),
        qcStatus: pick(["passed", "passed", "pending", "partial", "rejected"], i),
        status: pick(["published", "approved", "pending"], i),
        linkedPo: code("PO", i, 4),
      }),
    },
    {
      id: "landed-cost",
      singular: "Landed Cost",
      plural: "Landed Costs",
      icon: "Anchor",
      path: "/inventory/landed-costs",
      displayField: "code",
      fields: [
        { name: "code", kind: "text", required: true, sortable: true },
        { name: "linkedReceipt", label: "Receipt", kind: "text", required: true },
        { name: "freight", kind: "currency", align: "right" },
        { name: "customsDuty", label: "Customs Duty", kind: "currency", align: "right" },
        { name: "insurance", kind: "currency", align: "right" },
        { name: "handling", kind: "currency", align: "right" },
        { name: "total", label: "Total landed", kind: "currency", align: "right", sortable: true },
        { name: "allocationMethod", label: "Allocation", kind: "enum", options: [
          { value: "by-weight", label: "By weight" },
          { value: "by-value", label: "By value" },
          { value: "by-quantity", label: "By quantity" },
          { value: "manual", label: "Manual" },
        ] },
        { name: "postedAt", kind: "date", sortable: true },
      ],
      seedCount: 12,
      seed: (i) => {
        const freight = money(i, 100, 3000);
        const duty = money(i + 1, 50, 1500);
        const insurance = money(i + 2, 20, 500);
        const handling = money(i + 3, 10, 300);
        return {
          code: code("LC", i, 5),
          linkedReceipt: code("PR", i, 6),
          freight,
          customsDuty: duty,
          insurance,
          handling,
          total: freight + duty + insurance + handling,
          allocationMethod: pick(["by-value", "by-weight", "by-quantity"], i),
          postedAt: daysAgo(i * 3),
        };
      },
    },
    {
      id: "batch",
      singular: "Batch",
      plural: "Batches",
      icon: "Layers",
      path: "/inventory/batches",
      displayField: "code",
      defaultSort: { field: "expiresAt", dir: "asc" },
      fields: [
        { name: "code", label: "Batch #", kind: "text", required: true, sortable: true, width: 130 },
        { name: "product", kind: "text", required: true, sortable: true },
        { name: "sku", kind: "text", width: 120 },
        { name: "onHand", label: "On hand", kind: "number", align: "right" },
        { name: "manufacturedAt", kind: "date", sortable: true, width: 130 },
        { name: "expiresAt", kind: "date", sortable: true, width: 130 },
        { name: "supplier", kind: "text" },
        { name: "qcPassed", label: "QC passed", kind: "boolean", width: 110 },
      ],
      seedCount: 30,
      seed: (i) => {
        const made = daysAgo(30 + i * 5);
        return {
          code: code("BTH", i, 8),
          product: pick(ITEMS, i),
          sku: code("SKU", i % 10, 5),
          onHand: 10 + ((i * 19) % 200),
          manufacturedAt: made,
          expiresAt: new Date(Date.parse(made) + (30 + i * 10) * 86_400_000).toISOString(),
          supplier: pick(SUPPLIERS, i),
          qcPassed: i % 5 !== 0,
        };
      },
    },
    {
      id: "serial-number",
      singular: "Serial Number",
      plural: "Serial Numbers",
      icon: "Hash",
      path: "/inventory/serial-numbers",
      displayField: "serial",
      fields: [
        { name: "serial", kind: "text", required: true, sortable: true, width: 160 },
        { name: "sku", kind: "text", required: true, sortable: true, width: 120 },
        { name: "warehouse", kind: "text", width: 140 },
        { name: "status", kind: "enum", required: true, options: [
          { value: "in-stock", label: "In stock", intent: "success" },
          { value: "reserved", label: "Reserved", intent: "info" },
          { value: "sold", label: "Sold", intent: "neutral" },
          { value: "returned", label: "Returned", intent: "warning" },
          { value: "scrapped", label: "Scrapped", intent: "danger" },
        ] },
        { name: "customer", kind: "text" },
        { name: "warrantyExpiresAt", kind: "date", sortable: true },
      ],
      seedCount: 40,
      seed: (i) => ({
        serial: `SN-${pick(ITEMS, i).replace(/\s+/g, "").toUpperCase().slice(0, 3)}-${String(10000 + i * 37).slice(-5)}`,
        sku: code("SKU", i % 10, 5),
        warehouse: pick(["SFO DC", "AUS DC", "LHR DC"], i),
        status: pick(["in-stock", "in-stock", "sold", "reserved", "returned", "scrapped"], i),
        customer: i % 4 === 0 ? pick(["Acme Corp", "Globex", "Initech"], i) : "",
        warrantyExpiresAt: daysFromNow(365 + (i * 7) % 365),
      }),
    },
    {
      id: "stock-reconciliation",
      singular: "Stock Reconciliation",
      plural: "Stock Reconciliations",
      icon: "Scale",
      path: "/inventory/stock-reconciliations",
      displayField: "code",
      defaultSort: { field: "postedAt", dir: "desc" },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 120 },
        { name: "postedAt", kind: "date", required: true, sortable: true, width: 130 },
        { name: "warehouse", kind: "text", required: true, width: 140 },
        { name: "scope", kind: "enum", options: [
          { value: "cycle-count", label: "Cycle count" },
          { value: "full-count", label: "Full count" },
          { value: "spot-check", label: "Spot check" },
        ] },
        { name: "itemsCounted", kind: "number", align: "right" },
        { name: "variance", label: "Variance units", kind: "number", align: "right", sortable: true },
        { name: "varianceValue", label: "Variance $", kind: "currency", align: "right", sortable: true },
        { name: "status", kind: "enum", required: true, sortable: true, options: STATUS_LIFECYCLE },
        { name: "postedBy", kind: "text", width: 150 },
      ],
      seedCount: 14,
      seed: (i) => ({
        code: code("REC", i, 5),
        postedAt: daysAgo(i * 15),
        warehouse: pick(["SFO DC", "AUS DC", "LHR DC", "FRA DC"], i),
        scope: pick(["cycle-count", "spot-check", "full-count"], i),
        itemsCounted: 20 + ((i * 13) % 180),
        variance: ((i % 2 === 0 ? -1 : 1) * (i * 3)) % 50,
        varianceValue: Math.round(((i % 2 === 0 ? -1 : 1) * (i * 3)) % 50) * 25,
        status: pick(["published", "approved", "pending"], i),
        postedBy: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
      }),
    },
    {
      id: "pick-list",
      singular: "Pick List",
      plural: "Pick Lists",
      icon: "ListChecks",
      path: "/inventory/pick-lists",
      displayField: "code",
      defaultSort: { field: "createdAt", dir: "desc" },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 120 },
        { name: "warehouse", kind: "text", required: true, width: 140 },
        { name: "assignee", kind: "text" },
        { name: "createdAt", kind: "date", sortable: true, width: 130 },
        { name: "itemsCount", label: "Items", kind: "number", align: "right" },
        { name: "picked", label: "Picked", kind: "number", align: "right" },
        { name: "status", kind: "enum", required: true, sortable: true, options: [
          { value: "pending", label: "Pending", intent: "warning" },
          { value: "in-progress", label: "In progress", intent: "info" },
          { value: "picked", label: "Picked", intent: "accent" },
          { value: "packed", label: "Packed", intent: "success" },
          { value: "shipped", label: "Shipped", intent: "neutral" },
          { value: "cancelled", label: "Cancelled", intent: "danger" },
        ] },
        { name: "linkedOrder", label: "Sales Order", kind: "text", width: 130 },
      ],
      seedCount: 20,
      seed: (i) => {
        const items = 3 + ((i * 5) % 15);
        return {
          code: code("PL", i, 5),
          warehouse: pick(["SFO DC", "AUS DC", "LHR DC"], i),
          assignee: pick(["Alex", "Sam", "Taylor", "Jordan"], i),
          createdAt: daysAgo(i * 0.4),
          itemsCount: items,
          picked: Math.min(items, items - (i % 4)),
          status: pick(["in-progress", "in-progress", "picked", "packed", "shipped", "pending"], i),
          linkedOrder: code("SO", i, 4),
        };
      },
    },
    {
      id: "packing-slip",
      singular: "Packing Slip",
      plural: "Packing Slips",
      icon: "PackageSearch",
      path: "/inventory/packing-slips",
      displayField: "code",
      defaultSort: { field: "packedAt", dir: "desc" },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 120 },
        { name: "linkedDelivery", label: "Delivery Note", kind: "text", required: true, width: 140 },
        { name: "packedAt", kind: "date", sortable: true, width: 130 },
        { name: "packedBy", kind: "text" },
        { name: "boxCount", label: "Boxes", kind: "number", align: "right" },
        { name: "weightKg", label: "Weight (kg)", kind: "number", align: "right" },
        { name: "dimensions", label: "LxWxH", kind: "text" },
      ],
      seedCount: 20,
      seed: (i) => ({
        code: code("PS", i, 5),
        linkedDelivery: code("DN", i, 6),
        packedAt: daysAgo(i * 0.4),
        packedBy: pick(["Alex", "Sam", "Taylor"], i),
        boxCount: 1 + (i % 6),
        weightKg: 2 + ((i * 3) % 50),
        dimensions: `${30 + i % 20} x ${20 + i % 15} x ${10 + i % 10}`,
      }),
    },
    {
      id: "delivery-trip",
      singular: "Delivery Trip",
      plural: "Delivery Trips",
      icon: "Route",
      path: "/inventory/delivery-trips",
      displayField: "code",
      defaultSort: { field: "scheduledAt", dir: "asc" },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 120 },
        { name: "driver", kind: "text", required: true },
        { name: "vehicle", kind: "text", width: 130 },
        { name: "route", kind: "text" },
        { name: "stops", kind: "number", align: "right" },
        { name: "scheduledAt", kind: "date", sortable: true, width: 130 },
        { name: "status", kind: "enum", required: true, sortable: true, options: [
          { value: "planned", label: "Planned", intent: "info" },
          { value: "in-progress", label: "In progress", intent: "warning" },
          { value: "completed", label: "Completed", intent: "success" },
          { value: "cancelled", label: "Cancelled", intent: "danger" },
        ] },
        { name: "totalKm", label: "Distance (km)", kind: "number", align: "right" },
      ],
      seedCount: 12,
      seed: (i) => ({
        code: code("DT", i, 5),
        driver: pick(["Casey Perlman", "Morgan Hamilton", "Riley Liskov"], i),
        vehicle: pick(["VAN-01", "VAN-02", "TRK-01", "TRK-02"], i),
        route: pick(["West Bay loop", "Downtown run", "Airport express", "Peninsula sweep"], i),
        stops: 3 + (i % 8),
        scheduledAt: daysFromNow(i - 3),
        status: pick(["planned", "in-progress", "completed", "completed"], i),
        totalKm: 20 + ((i * 17) % 180),
      }),
    },
    {
      id: "item-supplier",
      singular: "Item Supplier",
      plural: "Item Suppliers",
      icon: "Handshake",
      path: "/inventory/item-suppliers",
      fields: [
        { name: "sku", kind: "text", required: true, sortable: true, width: 120 },
        { name: "supplier", kind: "text", required: true, sortable: true },
        { name: "supplierSku", label: "Supplier SKU", kind: "text", width: 150 },
        { name: "leadTimeDays", label: "Lead time (d)", kind: "number", align: "right" },
        { name: "minOrderQty", label: "MOQ", kind: "number", align: "right" },
        { name: "unitCost", kind: "currency", align: "right" },
        { name: "preferred", kind: "boolean", width: 100 },
        { name: "lastPurchaseAt", kind: "date", sortable: true },
      ],
      seedCount: 30,
      seed: (i) => ({
        sku: code("SKU", i % 15, 5),
        supplier: pick(SUPPLIERS, i),
        supplierSku: `SUP-${pick(SUPPLIERS, i).substring(0, 3).toUpperCase()}-${i + 1000}`,
        leadTimeDays: 3 + ((i * 7) % 30),
        minOrderQty: 10 * (1 + (i % 5)),
        unitCost: money(i, 1, 200),
        preferred: i % 3 === 0,
        lastPurchaseAt: daysAgo(i * 7),
      }),
    },
  ],
  extraNav: [
    ...inventoryArchetypeNav,
    { id: "inventory.control-room.nav", label: "Inventory Control Room", icon: "LayoutDashboard", path: "/inventory/control-room", view: "inventory.control-room.view", order: 0 },
    { id: "inventory.reports.nav", label: "Reports", icon: "BarChart3", path: "/inventory/reports", view: "inventory.reports.view" },
    { id: "inventory.alerts.nav", label: "Low stock", icon: "AlertTriangle", path: "/inventory/alerts", view: "inventory.alerts.view" },
  ],
  extraViews: [
    inventoryArchetypeDashboardView,
    inventoryArchetypeListView,
    inventoryControlRoomView,
    inventoryReportsIndexView,
    inventoryReportsDetailView,
    inventoryAlertsView,
  ],
  commands: [
    { id: "inventory.go.control-room", label: "Inventory: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/inventory/control-room"; } },
    { id: "inventory.go.reports", label: "Inventory: Reports", icon: "BarChart3", run: () => { window.location.hash = "/inventory/reports"; } },
    { id: "inventory.go.alerts", label: "Inventory: Low-stock alerts", icon: "AlertTriangle", run: () => { window.location.hash = "/inventory/alerts"; } },
    { id: "inventory.new-item", label: "New item", icon: "Box", run: () => { window.location.hash = "/inventory/items/new"; } },
    { id: "inventory.new-entry", label: "New stock entry", icon: "ArrowLeftRight", run: () => { window.location.hash = "/inventory/stock-entries/new"; } },
    { id: "inventory.new-request", label: "New material request", icon: "ClipboardList", run: () => { window.location.hash = "/inventory/material-requests/new"; } },
    { id: "inventory.new-pick-list", label: "New pick list", icon: "ListChecks", run: () => { window.location.hash = "/inventory/pick-lists/new"; } },
    { id: "inventory.new-receipt", label: "New purchase receipt", icon: "PackageCheck", run: () => { window.location.hash = "/inventory/purchase-receipts/new"; } },
  ],
});
