import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CHART_PALETTE, niceScale } from "./_helpers";
import { cn } from "@/lib/cn";
export function LineChart({ xLabels, series, height = 200, className, valueFormatter = (v) => v.toLocaleString(), area = true, }) {
    const maxVal = Math.max(...series.flatMap((s) => s.data), 0);
    const { max: niceMax } = niceScale(maxVal);
    const pad = { top: 14, right: 8, bottom: 28, left: 40 };
    const w = 480;
    const h = height;
    const iw = w - pad.left - pad.right;
    const ih = h - pad.top - pad.bottom;
    const n = xLabels.length;
    const xAt = (i) => n <= 1 ? pad.left + iw / 2 : pad.left + (i * iw) / (n - 1);
    const yAt = (v) => pad.top + ih - (v / (niceMax || 1)) * ih;
    return (_jsxs("svg", { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none", width: "100%", height: h, className: cn("block", className), role: "img", "aria-label": "Line chart", children: [[0, 0.25, 0.5, 0.75, 1].map((t, i) => (_jsxs("g", { children: [_jsx("line", { x1: pad.left, x2: w - pad.right, y1: pad.top + ih * (1 - t), y2: pad.top + ih * (1 - t), stroke: "rgb(var(--border))", strokeDasharray: i === 0 ? undefined : "2 3" }), _jsx("text", { x: pad.left - 6, y: pad.top + ih * (1 - t) + 3, textAnchor: "end", className: "fill-text-muted", fontSize: "10", children: valueFormatter(niceMax * t) })] }, i))), series.map((s, si) => {
                const color = s.color ?? CHART_PALETTE[si % CHART_PALETTE.length];
                const points = s.data
                    .map((v, i) => `${xAt(i)},${yAt(v)}`)
                    .join(" ");
                const areaPath = `M ${xAt(0)},${yAt(s.data[0] ?? 0)} ` +
                    s.data.map((v, i) => `L ${xAt(i)},${yAt(v)}`).join(" ") +
                    ` L ${xAt(s.data.length - 1)},${pad.top + ih} L ${xAt(0)},${pad.top + ih} Z`;
                return (_jsxs("g", { children: [area && (_jsx("path", { d: areaPath, fill: color, opacity: 0.12 })), _jsx("polyline", { points: points, fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }), s.data.map((v, i) => (_jsx("circle", { cx: xAt(i), cy: yAt(v), r: 2, fill: color, children: _jsxs("title", { children: [s.label, " @ ", xLabels[i], ": ", valueFormatter(v)] }) }, i)))] }, si));
            }), xLabels.map((l, i) => (_jsx("text", { x: xAt(i), y: h - 10, textAnchor: "middle", className: "fill-text-muted", fontSize: "10", children: l }, i)))] }));
}
