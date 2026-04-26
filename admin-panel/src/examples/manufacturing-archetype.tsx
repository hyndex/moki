/** Reference Manufacturing BOM (Tree Explorer archetype). */

import * as React from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/primitives/Button";
import { defineCustomView } from "@/builders";
import {
  TreeExplorer,
  WidgetShell,
  RailEntityCard,
  CommandHints,
  useArchetypeKeyboard,
  useUrlState,
} from "@/admin-archetypes";
import { buildTreeFromFlat } from "@/admin-archetypes/widgets/_treeFromFlat";
import { useAllRecords } from "@/runtime/hooks";
import { cn } from "@/lib/cn";

interface BomNode {
  id: string;
  part: string;
  description: string;
  qty: number;
  uom: string;
  cost: number;
  leadDays: number;
  children?: BomNode[];
}

interface BomLineRecord {
  id: string;
  bomCode?: string;
  parentId?: string;
  part?: string;
  description?: string;
  qty?: number;
  uom?: string;
  cost?: number;
  leadDays?: number;
  depth?: number;
  sortKey?: string;
}

/** Reconstruct the tree from a flat parent-pointer list. The shared
 *  `buildTreeFromFlat` helper does the parenting + stable sibling order;
 *  this wrapper projects each row into the BomNode shape and returns
 *  the first root (BOM resources may hold several roots — the archetype
 *  reference page only shows one). */
function buildBomTree(rows: readonly BomLineRecord[]): BomNode | null {
  const roots = buildTreeFromFlat(rows);
  if (roots.length === 0) return null;
  const project = (node: { row: BomLineRecord; children: Array<{ row: BomLineRecord; children: unknown[] }> }): BomNode => ({
    id: node.row.id,
    part: node.row.part ?? node.row.id,
    description: node.row.description ?? "",
    qty: typeof node.row.qty === "number" ? node.row.qty : 1,
    uom: node.row.uom ?? "each",
    cost: typeof node.row.cost === "number" ? node.row.cost : 0,
    leadDays: typeof node.row.leadDays === "number" ? node.row.leadDays : 0,
    children: node.children.map((c) => project(c as typeof node)),
  });
  return project(roots[0] as { row: BomLineRecord; children: Array<{ row: BomLineRecord; children: unknown[] }> });
}

const FALLBACK_BOM: BomNode = {
  id: "WIDGET-1000",
  part: "WIDGET-1000",
  description: "Top-level widget assembly",
  qty: 1,
  uom: "each",
  cost: 84.5,
  leadDays: 14,
  children: [
    {
      id: "ASM-200",
      part: "ASM-200",
      description: "Hinge assembly",
      qty: 2,
      uom: "each",
      cost: 4.2,
      leadDays: 3,
      children: [
        { id: "PART-12", part: "PART-12", description: "Hinge pin", qty: 4, uom: "each", cost: 0.4, leadDays: 1 },
        { id: "PART-13", part: "PART-13", description: "Hinge bushing", qty: 2, uom: "each", cost: 0.6, leadDays: 1 },
      ],
    },
  ],
};

interface NodeRowProps {
  node: BomNode;
  depth: number;
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  selectedId?: string;
  onSelect: (id: string) => void;
}

function NodeRow({ node, depth, expanded, onToggle, selectedId, onSelect }: NodeRowProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  return (
    <>
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" && hasChildren && !isOpen) onToggle(node.id);
          if (e.key === "ArrowLeft" && hasChildren && isOpen) onToggle(node.id);
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
        className={cn(
          "flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer text-sm",
          isSelected ? "bg-info-soft/40" : "hover:bg-surface-1",
        )}
        style={{ paddingLeft: 8 + depth * 18 }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={isOpen ? "Collapse" : "Expand"}
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            className="h-5 w-5 flex items-center justify-center text-text-muted hover:text-text-primary"
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
          </button>
        ) : (
          <span className="h-5 w-5" aria-hidden />
        )}
        <span className="font-mono text-xs text-text-muted shrink-0">{node.part}</span>
        <span className="text-text-primary truncate">{node.description}</span>
        <span className="ml-auto text-xs text-text-muted tabular-nums whitespace-nowrap">
          qty {node.qty} {node.uom}
        </span>
      </div>
      {hasChildren && isOpen && node.children!.map((child) => (
        <NodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function findNode(node: BomNode, id: string): BomNode | null {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function ManufacturingArchetypeBom() {
  // Read every BOM line from the real backend. The page reconstructs the
  // tree client-side; pagination is hidden because BOMs are typically small
  // (a few hundred lines at most) and the user expects to see the entire
  // structure at once.
  const lines = useAllRecords<BomLineRecord>("manufacturing.bom-line");
  const built = React.useMemo(() => buildBomTree(lines.data), [lines.data]);
  const root: BomNode = built ?? FALLBACK_BOM;
  const state = lines.error
    ? ({ status: "error" as const, error: lines.error })
    : lines.loading && lines.data.length === 0
      ? ({ status: "loading" as const })
      : ({ status: "ready" as const });

  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set([root.id, "ASM-200", "ASM-300"]),
  );
  const [params, setParams] = useUrlState(["sel"] as const);
  const selectedId = params.sel ?? root.id;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    const walk = (n: BomNode) => {
      all.add(n.id);
      for (const c of n.children ?? []) walk(c);
    };
    walk(root);
    setExpanded(all);
  };

  const collapseAll = () => setExpanded(new Set([root.id]));

  useArchetypeKeyboard([
    { label: "Expand all", combo: "shift+e", run: expandAll },
    { label: "Collapse all", combo: "shift+c", run: collapseAll },
  ]);

  const selected = findNode(root, selectedId) ?? root;

  return (
    <TreeExplorer
      id="manufacturing.bom"
      title="Bill of Materials"
      subtitle={`Top-level: ${root.part}`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand all
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse all
          </Button>
        </>
      }
      toolbarEnd={
        <CommandHints hints={[
          { keys: "→", label: "Expand" },
          { keys: "←", label: "Collapse" },
          { keys: "↵", label: "Open" },
        ]} />
      }
      tree={
        <WidgetShell label="BOM" state={state} skeleton="list" onRetry={lines.refetch}>
          <div role="tree" aria-label="Bill of materials" className="rounded-lg border border-border bg-surface-0 p-1">
            <NodeRow
              node={root}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              selectedId={selectedId}
              onSelect={(id) => setParams({ sel: id })}
            />
          </div>
        </WidgetShell>
      }
      rail={
        <>
          <RailEntityCard
            title={selected.part}
            subtitle={selected.description}
            facts={[
              { label: "Quantity", value: `${selected.qty} ${selected.uom}` },
              { label: "Cost", value: `$${selected.cost.toFixed(2)}` },
              { label: "Lead time", value: `${selected.leadDays}d` },
              { label: "Children", value: selected.children?.length ?? 0 },
            ]}
          />
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted px-1">
            Where used
          </div>
          <div className="rounded-lg border border-border bg-surface-0 p-3 text-xs text-text-muted">
            • {root.part} (this BOM)
          </div>
        </>
      }
    />
  );
}

export const manufacturingArchetypeBomView = defineCustomView({
  id: "manufacturing.archetype-bom.view",
  title: "BOM (archetype)",
  description: "Reference Tree Explorer for bill of materials.",
  resource: "manufacturing.bom",
  archetype: "tree",
  render: () => <ManufacturingArchetypeBom />,
});

export const manufacturingArchetypeNav = [
  {
    id: "manufacturing.archetype-bom",
    label: "BOM (new)",
    icon: "ListTree",
    path: "/manufacturing/archetype-bom",
    view: "manufacturing.archetype-bom.view",
    section: "supply-chain",
    order: 0.7,
  },
];
