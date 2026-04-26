/** Zero-dep SVG chart helpers. All charts render pure SVG and resolve colors
 *  via CSS custom properties, so theme swaps just work. */
export const CHART_PALETTE = [
    "rgb(var(--accent))",
    "rgb(var(--intent-success))",
    "rgb(var(--intent-warning))",
    "rgb(var(--intent-danger))",
    "rgb(var(--intent-info))",
    "rgb(var(--text-muted))",
];
export function niceScale(max, ticks = 5) {
    if (max <= 0)
        return { max: 1, step: 0.2 };
    const raw = max / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    const niceStep = step * mag;
    return { max: Math.ceil(max / niceStep) * niceStep, step: niceStep };
}
