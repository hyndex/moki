import * as React from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/cn";
import { Play, GitBranch, Zap, Webhook, Bell, Clock, Sparkles, CircleDot } from "lucide-react";

/** Workflow canvas built on @xyflow/react.
 *
 *  Ships typed node kinds for the automation domain:
 *    - trigger (on event / on schedule) — source-only
 *    - condition (if / branch) — two outputs (yes/no)
 *    - action (do something) — single output
 *    - notification — terminal
 *    - webhook — terminal
 *    - ai — calls an AI skill
 *    - delay — sleeps N seconds
 *    - custom — caller renders anything
 *
 *  Each node has a label, optional icon override, optional status pulse,
 *  typed in/out handles. Nodes can be inspected by double-click (emit
 *  onNodeOpen) or moved around; edges are auto-routed.
 *
 *  Canvas reads density + theme from the DOM attributes so the minimap,
 *  controls, and background match the shell.
 */

export type WorkflowNodeKind =
  | "trigger"
  | "condition"
  | "action"
  | "notification"
  | "webhook"
  | "ai"
  | "delay"
  | "custom";

export interface WorkflowNodeData {
  kind: WorkflowNodeKind;
  label: string;
  description?: string;
  /** When set, renders a colored dot next to the label. */
  status?: "idle" | "running" | "ok" | "error";
  /** Optional override for the header icon. */
  icon?: React.ReactNode;
  /** Arbitrary payload the caller can inspect on click. */
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

export interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onChange?: (state: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => void;
  /** Double-click or Enter — open an inspector. */
  onNodeOpen?: (node: WorkflowNode) => void;
  readOnly?: boolean;
  height?: number | string;
  className?: string;
}

/* ------------------------------------------------------------------- */
/* Node renderers                                                      */
/* ------------------------------------------------------------------- */

const KIND_STYLE: Record<WorkflowNodeKind, { border: string; icon: React.ComponentType<{ className?: string }> }> = {
  trigger:      { border: "border-accent", icon: Play },
  condition:    { border: "border-intent-info", icon: GitBranch },
  action:       { border: "border-intent-success", icon: Zap },
  notification: { border: "border-intent-warning", icon: Bell },
  webhook:      { border: "border-intent-danger", icon: Webhook },
  ai:           { border: "border-purple-500", icon: Sparkles },
  delay:        { border: "border-text-muted", icon: Clock },
  custom:       { border: "border-border", icon: CircleDot },
};

function StandardNode({ data, selected }: NodeProps<WorkflowNode>) {
  const style = KIND_STYLE[data.kind] ?? KIND_STYLE.custom;
  const Icon = style.icon;
  return (
    <div
      className={cn(
        "min-w-[180px] max-w-[260px] rounded-md border bg-surface-0 shadow-sm",
        style.border,
        selected && "ring-2 ring-accent",
      )}
    >
      {data.kind !== "trigger" && (
        <Handle type="target" position={Position.Top} style={{ background: "rgb(var(--border))" }} />
      )}
      <div className="px-3 py-2 flex items-start gap-2">
        <div className="mt-0.5 h-6 w-6 rounded-md bg-surface-1 flex items-center justify-center shrink-0">
          {data.icon ?? <Icon className="h-3.5 w-3.5 text-text-muted" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {data.status && (
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  data.status === "ok" && "bg-intent-success",
                  data.status === "running" && "bg-accent animate-pulse",
                  data.status === "error" && "bg-intent-danger",
                  data.status === "idle" && "bg-text-muted",
                )}
              />
            )}
            <div className="text-xs font-medium text-text-primary truncate">
              {data.label}
            </div>
          </div>
          {data.description && (
            <div className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
              {data.description}
            </div>
          )}
        </div>
      </div>
      {/* Condition nodes have two outputs: yes/no */}
      {data.kind === "condition" ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            style={{ left: "30%", background: "rgb(var(--intent-success))" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            style={{ left: "70%", background: "rgb(var(--intent-danger))" }}
          />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} style={{ background: "rgb(var(--border))" }} />
      )}
    </div>
  );
}

const nodeTypes = {
  trigger: StandardNode,
  condition: StandardNode,
  action: StandardNode,
  notification: StandardNode,
  webhook: StandardNode,
  ai: StandardNode,
  delay: StandardNode,
  custom: StandardNode,
};

/* ------------------------------------------------------------------- */
/* Canvas                                                               */
/* ------------------------------------------------------------------- */

function CanvasInner({
  nodes: initialNodes,
  edges: initialEdges,
  onChange,
  onNodeOpen,
  readOnly,
  height = 540,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(initialEdges);

  // Emit changes upstream (debounced via React's batching) so parent can save.
  React.useEffect(() => {
    onChange?.({ nodes, edges });
  }, [nodes, edges, onChange]);

  const onConnect = React.useCallback(
    (conn: Connection) => {
      setEdges((eds) => addEdge({ ...conn, animated: true }, eds));
    },
    [setEdges],
  );

  return (
    <div style={{ height, width: "100%" }} className="rounded-md border border-border bg-surface-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onNodeDoubleClick={(_e, n) => onNodeOpen?.(n as WorkflowNode)}
        nodeTypes={nodeTypes}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.15 }}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
          style: { stroke: "rgb(var(--text-muted))", strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="rgb(var(--border-subtle))"
        />
        <Controls showInteractive={!readOnly} />
        <MiniMap
          nodeStrokeColor="rgb(var(--accent))"
          nodeColor="rgb(var(--surface-1))"
          nodeBorderRadius={4}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
