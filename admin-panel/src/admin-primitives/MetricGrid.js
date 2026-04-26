import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
import { KPI } from "./KPI";
export function MetricGrid({ metrics, columns = 4, className }) {
    const gridCols = columns === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : columns === 3
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            : columns === 4
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                : columns === 5
                    ? "grid-cols-1 sm:grid-cols-3 lg:grid-cols-5"
                    : "grid-cols-1 sm:grid-cols-3 lg:grid-cols-6";
    return (_jsx("div", { className: cn("grid gap-3", gridCols, className), children: metrics.map((m, i) => (_jsx(KPI, { ...m }, i))) }));
}
