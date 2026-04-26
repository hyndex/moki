import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport, } from "@/primitives/Toast";
import { useRuntime } from "@/runtime/context";
export function Toaster() {
    const runtime = useRuntime();
    const [items, setItems] = React.useState([]);
    React.useEffect(() => {
        return runtime.bus.on("toast:add", (p) => {
            setItems((prev) => [...prev, p]);
        });
    }, [runtime]);
    return (_jsxs(ToastProvider, { swipeDirection: "right", children: [items.map((t) => (_jsxs(Toast, { intent: t.intent ?? "default", duration: t.durationMs ?? 4500, onOpenChange: (open) => {
                    if (!open)
                        setItems((prev) => prev.filter((x) => x.id !== t.id));
                }, children: [_jsx(ToastTitle, { children: t.title }), t.description && _jsx(ToastDescription, { children: t.description })] }, t.id))), _jsx(ToastViewport, {})] }));
}
