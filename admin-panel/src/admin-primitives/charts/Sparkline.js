import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
export function Sparkline({ data, width = 120, height = 28, color = "rgb(var(--accent))", className, area = true, }) {
    if (!data || data.length === 0)
        return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const dx = width / (data.length - 1 || 1);
    const y = (v) => height - ((v - min) / range) * height;
    const poly = data.map((v, i) => `${i * dx},${y(v)}`).join(" ");
    const areaPath = `M 0,${y(data[0])} ` +
        data.map((v, i) => `L ${i * dx},${y(v)}`).join(" ") +
        ` L ${(data.length - 1) * dx},${height} L 0,${height} Z`;
    return (_jsxs("svg", { width: width, height: height, viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", className: cn("inline-block", className), role: "img", "aria-label": "Sparkline", children: [area && _jsx("path", { d: areaPath, fill: color, opacity: 0.16 }), _jsx("polyline", { points: poly, fill: "none", stroke: color, strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
