import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
import { NumberCardWidget } from "./NumberCardWidget";
import { ChartWidget } from "./ChartWidget";
import { ShortcutCardWidget } from "./ShortcutCardWidget";
import { HeaderWidget } from "./HeaderWidget";
import { SpacerWidget } from "./SpacerWidget";
import { QuickListWidget } from "./QuickListWidget";
export function WidgetGrid({ widgets, className, }) {
    return (_jsx("div", { className: cn("grid gap-3 [grid-template-columns:repeat(12,minmax(0,1fr))]", className), children: widgets.map((w) => (_jsx("div", { style: { gridColumn: `span ${clampCol(w.col)} / span ${clampCol(w.col)}` }, className: cn(w.row === "tall" ? "row-span-2" : "row-span-1", "min-w-0"), children: _jsx(WidgetSwitch, { widget: w }) }, w.id))) }));
}
function clampCol(col) {
    if (!Number.isFinite(col))
        return 12;
    return Math.min(12, Math.max(1, Math.round(col)));
}
function WidgetSwitch({ widget }) {
    switch (widget.type) {
        case "number_card": return _jsx(NumberCardWidget, { widget: widget });
        case "chart": return _jsx(ChartWidget, { widget: widget });
        case "shortcut": return _jsx(ShortcutCardWidget, { widget: widget });
        case "header": return _jsx(HeaderWidget, { widget: widget });
        case "spacer": return _jsx(SpacerWidget, { widget: widget });
        case "quick_list": return _jsx(QuickListWidget, { widget: widget });
        case "custom": return _jsx(_Fragment, { children: widget.render() });
    }
}
