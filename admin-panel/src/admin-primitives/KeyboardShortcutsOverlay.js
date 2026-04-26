import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Dialog, DialogContent } from "@/primitives/Dialog";
const DEFAULT_SHORTCUTS = [
    { keys: ["⌘", "K"], description: "Open command palette", category: "Global" },
    { keys: ["/"], description: "Focus search", category: "Global" },
    { keys: ["?"], description: "Show this help", category: "Global" },
    { keys: ["G", "H"], description: "Go to Home", category: "Navigation" },
    { keys: ["G", "I"], description: "Go to Inbox", category: "Navigation" },
    { keys: ["G", "S"], description: "Go to Settings", category: "Navigation" },
    { keys: ["J"], description: "Next row", category: "Table" },
    { keys: ["K"], description: "Previous row", category: "Table" },
    { keys: ["Enter"], description: "Open selected row", category: "Table" },
    { keys: ["E"], description: "Edit selected row", category: "Table" },
    { keys: ["Shift", "Click"], description: "Range-select rows", category: "Table" },
    { keys: ["X"], description: "Toggle row selection", category: "Table" },
    { keys: ["Esc"], description: "Close drawer/dialog", category: "General" },
];
export function KeyboardShortcutsOverlay({ shortcuts = DEFAULT_SHORTCUTS, open, onOpenChange, }) {
    const grouped = React.useMemo(() => {
        const m = new Map();
        for (const s of shortcuts) {
            const cat = s.category ?? "General";
            const list = m.get(cat) ?? [];
            list.push(s);
            m.set(cat, list);
        }
        return m;
    }, [shortcuts]);
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-w-2xl", children: [_jsxs("div", { className: "px-5 py-4 border-b border-border", children: [_jsx("div", { className: "text-sm font-semibold text-text-primary", children: "Keyboard shortcuts" }), _jsxs("div", { className: "text-xs text-text-muted mt-0.5", children: ["Press", " ", _jsx("kbd", { className: "px-1.5 py-0.5 text-xs font-mono bg-surface-2 border border-border rounded", children: "?" }), " ", "anywhere to open this dialog."] })] }), _jsx("div", { className: "p-5 grid grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto", children: Array.from(grouped.entries()).map(([cat, items]) => (_jsxs("div", { children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wider text-text-muted mb-2", children: cat }), _jsx("ul", { className: "flex flex-col gap-1.5", children: items.map((s, i) => (_jsxs("li", { className: "flex items-center justify-between gap-3 text-sm", children: [_jsx("span", { className: "text-text-secondary", children: s.description }), _jsx("span", { className: "flex items-center gap-1 shrink-0", children: s.keys.map((k, j) => (_jsxs(React.Fragment, { children: [j > 0 && (_jsx("span", { className: "text-xs text-text-muted", children: "+" })), _jsx("kbd", { className: "px-1.5 py-0.5 text-xs font-mono bg-surface-2 border border-border rounded", children: k })] }, j))) })] }, i))) })] }, cat))) })] }) }));
}
export { DEFAULT_SHORTCUTS };
