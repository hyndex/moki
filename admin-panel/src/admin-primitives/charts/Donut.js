import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { CHART_PALETTE } from "./_helpers";
import { cn } from "@/lib/cn";
export function Donut({ data, size = 160, className, centerLabel }) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const r = size / 2 - 6;
    const cx = size / 2;
    const cy = size / 2;
    let angle = -Math.PI / 2;
    return (_jsxs("div", { className: cn("flex items-center gap-4", className), children: [_jsxs("svg", { width: size, height: size, role: "img", "aria-label": "Donut chart", children: [data.map((d, i) => {
                        const portion = d.value / total;
                        const start = angle;
                        const end = angle + portion * Math.PI * 2;
                        angle = end;
                        const large = end - start > Math.PI ? 1 : 0;
                        const x1 = cx + r * Math.cos(start);
                        const y1 = cy + r * Math.sin(start);
                        const x2 = cx + r * Math.cos(end);
                        const y2 = cy + r * Math.sin(end);
                        const path = [
                            `M ${cx} ${cy}`,
                            `L ${x1} ${y1}`,
                            `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
                            "Z",
                        ].join(" ");
                        return (_jsx("path", { d: path, fill: d.color ?? CHART_PALETTE[i % CHART_PALETTE.length], opacity: 0.9, children: _jsxs("title", { children: [d.label, ": ", d.value.toLocaleString(), " (", Math.round(portion * 100), "%)"] }) }, i));
                    }), _jsx("circle", { cx: cx, cy: cy, r: r * 0.58, fill: "rgb(var(--surface-0))" }), centerLabel && (_jsx("foreignObject", { x: cx - r * 0.55, y: cy - r * 0.3, width: r * 1.1, height: r * 0.6, children: _jsx("div", { className: "w-full h-full flex flex-col items-center justify-center text-center", children: centerLabel }) }))] }), _jsx("ul", { className: "flex flex-col gap-1 text-sm min-w-0", children: data.map((d, i) => (_jsxs("li", { className: "flex items-center gap-2 text-text-secondary", children: [_jsx("span", { className: "inline-block w-3 h-3 rounded-sm shrink-0", style: {
                                background: d.color ?? CHART_PALETTE[i % CHART_PALETTE.length],
                            }, "aria-hidden": true }), _jsx("span", { className: "truncate", children: d.label }), _jsx("span", { className: "text-text-muted ml-auto tabular-nums", children: d.value.toLocaleString() })] }, i))) })] }));
}
