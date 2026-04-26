import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, Handle, Position, useNodesState, useEdgesState, addEdge, } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/cn";
import { Play, GitBranch, Zap, Webhook, Bell, Clock, Sparkles, CircleDot } from "lucide-react";
/* ------------------------------------------------------------------- */
/* Node renderers                                                      */
/* ------------------------------------------------------------------- */
const KIND_STYLE = {
    trigger: { border: "border-accent", icon: Play },
    condition: { border: "border-intent-info", icon: GitBranch },
    action: { border: "border-intent-success", icon: Zap },
    notification: { border: "border-intent-warning", icon: Bell },
    webhook: { border: "border-intent-danger", icon: Webhook },
    ai: { border: "border-purple-500", icon: Sparkles },
    delay: { border: "border-text-muted", icon: Clock },
    custom: { border: "border-border", icon: CircleDot },
};
function StandardNode({ data, selected }) {
    const style = KIND_STYLE[data.kind] ?? KIND_STYLE.custom;
    const Icon = style.icon;
    return (_jsxs("div", { className: cn("min-w-[180px] max-w-[260px] rounded-md border bg-surface-0 shadow-sm", style.border, selected && "ring-2 ring-accent"), children: [data.kind !== "trigger" && (_jsx(Handle, { type: "target", position: Position.Top, style: { background: "rgb(var(--border))" } })), _jsxs("div", { className: "px-3 py-2 flex items-start gap-2", children: [_jsx("div", { className: "mt-0.5 h-6 w-6 rounded-md bg-surface-1 flex items-center justify-center shrink-0", children: data.icon ?? _jsx(Icon, { className: "h-3.5 w-3.5 text-text-muted" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [data.status && (_jsx("span", { className: cn("h-1.5 w-1.5 rounded-full", data.status === "ok" && "bg-intent-success", data.status === "running" && "bg-accent animate-pulse", data.status === "error" && "bg-intent-danger", data.status === "idle" && "bg-text-muted") })), _jsx("div", { className: "text-xs font-medium text-text-primary truncate", children: data.label })] }), data.description && (_jsx("div", { className: "text-[11px] text-text-muted mt-0.5 line-clamp-2", children: data.description }))] })] }), data.kind === "condition" ? (_jsxs(_Fragment, { children: [_jsx(Handle, { type: "source", position: Position.Bottom, id: "yes", style: { left: "30%", background: "rgb(var(--intent-success))" } }), _jsx(Handle, { type: "source", position: Position.Bottom, id: "no", style: { left: "70%", background: "rgb(var(--intent-danger))" } })] })) : (_jsx(Handle, { type: "source", position: Position.Bottom, style: { background: "rgb(var(--border))" } }))] }));
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
function CanvasInner({ nodes: initialNodes, edges: initialEdges, onChange, onNodeOpen, readOnly, height = 540, }) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    // Emit changes upstream (debounced via React's batching) so parent can save.
    React.useEffect(() => {
        onChange?.({ nodes, edges });
    }, [nodes, edges, onChange]);
    const onConnect = React.useCallback((conn) => {
        setEdges((eds) => addEdge({ ...conn, animated: true }, eds));
    }, [setEdges]);
    return (_jsx("div", { style: { height, width: "100%" }, className: "rounded-md border border-border bg-surface-0", children: _jsxs(ReactFlow, { nodes: nodes, edges: edges, onNodesChange: readOnly ? undefined : onNodesChange, onEdgesChange: readOnly ? undefined : onEdgesChange, onConnect: readOnly ? undefined : onConnect, onNodeDoubleClick: (_e, n) => onNodeOpen?.(n), nodeTypes: nodeTypes, nodesDraggable: !readOnly, nodesConnectable: !readOnly, elementsSelectable: true, fitView: true, fitViewOptions: { padding: 0.15 }, defaultEdgeOptions: {
                type: "smoothstep",
                animated: true,
                style: { stroke: "rgb(var(--text-muted))", strokeWidth: 1.5 },
            }, proOptions: { hideAttribution: true }, children: [_jsx(Background, { variant: BackgroundVariant.Dots, gap: 16, size: 1, color: "rgb(var(--border-subtle))" }), _jsx(Controls, { showInteractive: !readOnly }), _jsx(MiniMap, { nodeStrokeColor: "rgb(var(--accent))", nodeColor: "rgb(var(--surface-1))", nodeBorderRadius: 4, pannable: true, zoomable: true })] }) }));
}
export function WorkflowCanvas(props) {
    return (_jsx(ReactFlowProvider, { children: _jsx(CanvasInner, { ...props }) }));
}
