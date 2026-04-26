import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Check, Clock, ShieldCheck, UserCheck, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { Button } from "@/primitives/Button";
import { Textarea } from "@/primitives/Textarea";
import { Badge } from "@/primitives/Badge";
import { StatusDot } from "./StatusDot";
import { cn } from "@/lib/cn";
function intent(s) {
    switch (s) {
        case "approved": return "success";
        case "rejected": return "danger";
        case "delegated": return "info";
        case "skipped": return "neutral";
        default: return "warning";
    }
}
export function ApprovalPanel({ title = "Approvals", steps, canAct, onApprove, onReject, }) {
    const [reason, setReason] = React.useState("");
    const [busy, setBusy] = React.useState(null);
    const pending = steps.find((s) => s.status === "pending");
    const handleApprove = async () => {
        if (!onApprove)
            return;
        setBusy("approve");
        try {
            await onApprove(reason.trim() || undefined);
            setReason("");
        }
        finally {
            setBusy(null);
        }
    };
    const handleReject = async () => {
        if (!onReject || !reason.trim())
            return;
        setBusy("reject");
        try {
            await onReject(reason.trim());
            setReason("");
        }
        finally {
            setBusy(null);
        }
    };
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(ShieldCheck, { className: "h-3.5 w-3.5 text-text-muted" }), _jsx(CardTitle, { children: title })] }) }), _jsxs(CardContent, { children: [_jsx("ol", { className: "space-y-2", children: steps.map((s, i) => (_jsxs("li", { className: "flex items-start gap-3", children: [_jsx("div", { className: cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5", s.status === "approved" && "bg-intent-success text-white", s.status === "rejected" && "bg-intent-danger text-white", s.status === "pending" && "bg-intent-warning-bg text-intent-warning", s.status === "delegated" && "bg-intent-info-bg text-intent-info", s.status === "skipped" && "bg-surface-2 text-text-muted"), children: s.status === "approved" ? (_jsx(Check, { className: "h-3 w-3" })) : s.status === "rejected" ? (_jsx(X, { className: "h-3 w-3" })) : s.status === "pending" ? (_jsx(Clock, { className: "h-3 w-3" })) : (_jsx("span", { className: "text-xs", children: i + 1 })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: s.label }), _jsx(Badge, { intent: intent(s.status), children: s.status })] }), _jsxs("div", { className: "text-xs text-text-muted mt-0.5", children: [s.approver && _jsxs("span", { children: ["by ", s.approver] }), s.approverRole && _jsxs("span", { children: [s.approver ? " · " : "", s.approverRole] }), s.at && _jsxs("span", { children: [" \u00B7 ", new Date(s.at).toLocaleString()] })] }), s.reason && (_jsxs("div", { className: "text-xs text-text-secondary mt-1 italic", children: ["\"", s.reason, "\""] }))] }), _jsx(StatusDot, { intent: intent(s.status) })] }, s.id))) }), canAct && pending && onApprove && onReject && (_jsxs("div", { className: "mt-4 pt-4 border-t border-border flex flex-col gap-2", children: [_jsx(Textarea, { rows: 2, placeholder: "Reason (required to reject, optional to approve)\u2026", value: reason, onChange: (e) => setReason(e.target.value) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "primary", size: "sm", onClick: handleApprove, loading: busy === "approve", iconLeft: _jsx(UserCheck, { className: "h-3.5 w-3.5" }), children: "Approve" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: handleReject, loading: busy === "reject", disabled: !reason.trim(), iconLeft: _jsx(X, { className: "h-3.5 w-3.5" }), children: "Reject" })] })] }))] })] }));
}
