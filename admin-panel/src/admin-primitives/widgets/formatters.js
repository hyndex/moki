export function formatValue(value, format, currency = "USD") {
    if (!Number.isFinite(value))
        return "—";
    switch (format) {
        case "currency":
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency,
                maximumFractionDigits: value >= 10_000 ? 0 : 2,
            }).format(value);
        case "percent":
            return new Intl.NumberFormat("en-US", {
                style: "percent",
                maximumFractionDigits: 1,
            }).format(value / 100);
        case "compact":
            return new Intl.NumberFormat("en-US", {
                notation: "compact",
                maximumFractionDigits: 1,
            }).format(value);
        case "duration_ms":
            if (value < 1000)
                return `${Math.round(value)}ms`;
            if (value < 60_000)
                return `${(value / 1000).toFixed(1)}s`;
            return `${(value / 60_000).toFixed(1)}m`;
        case "number":
        default:
            if (Math.abs(value) >= 10_000) {
                return new Intl.NumberFormat("en-US", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                }).format(value);
            }
            return new Intl.NumberFormat("en-US").format(Math.round(value * 100) / 100);
    }
}
export function formatDelta(current, previous) {
    if (previous === 0 || !Number.isFinite(previous)) {
        return { pct: 0, label: "—", positive: current >= 0 };
    }
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    const positive = pct >= 0;
    const label = `${positive ? "+" : ""}${pct.toFixed(1)}%`;
    return { pct, label, positive };
}
