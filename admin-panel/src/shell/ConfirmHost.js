import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/primitives/Dialog";
import { Button } from "@/primitives/Button";
import { useRuntime } from "@/runtime/context";
export function ConfirmHost() {
    const runtime = useRuntime();
    const [req, setReq] = React.useState(null);
    React.useEffect(() => runtime.bus.on("confirm:open", (r) => setReq(r)), [runtime]);
    const close = (result) => {
        if (!req)
            return;
        runtime.bus.emit("confirm:resolve", { id: req.id, result });
        setReq(null);
    };
    return (_jsx(Dialog, { open: !!req, onOpenChange: (open) => !open && close(false), children: _jsxs(DialogContent, { size: "sm", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: req?.title }), req?.description && (_jsx(DialogDescription, { children: req.description }))] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "ghost", onClick: () => close(false), children: "Cancel" }), _jsx(Button, { variant: req?.destructive ? "danger" : "primary", onClick: () => close(true), children: req?.destructive ? "Delete" : "Confirm" })] })] }) }));
}
