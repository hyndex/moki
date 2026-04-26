/** Locale-aware, SSR-safe formatting utilities used by view renderers. */
const LOCALE = "en-US";
export function formatDate(value) {
    if (value == null)
        return "—";
    const d = typeof value === "string" || typeof value === "number" ? new Date(value) : value;
    if (Number.isNaN(d.getTime()))
        return "—";
    return new Intl.DateTimeFormat(LOCALE, {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(d);
}
export function formatDateTime(value) {
    if (value == null)
        return "—";
    const d = typeof value === "string" || typeof value === "number" ? new Date(value) : value;
    if (Number.isNaN(d.getTime()))
        return "—";
    return new Intl.DateTimeFormat(LOCALE, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}
export function formatRelative(value) {
    if (value == null)
        return "—";
    const d = typeof value === "string" || typeof value === "number" ? new Date(value) : value;
    if (Number.isNaN(d.getTime()))
        return "—";
    const diff = d.getTime() - Date.now();
    const abs = Math.abs(diff);
    const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
    const units = [
        ["year", 365 * 24 * 3600_000],
        ["month", 30 * 24 * 3600_000],
        ["week", 7 * 24 * 3600_000],
        ["day", 24 * 3600_000],
        ["hour", 3600_000],
        ["minute", 60_000],
        ["second", 1_000],
    ];
    for (const [unit, ms] of units) {
        if (abs >= ms)
            return rtf.format(Math.round(diff / ms), unit);
    }
    return rtf.format(0, "second");
}
export function formatCurrency(value, currency = "USD") {
    if (value == null || Number.isNaN(value))
        return "—";
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(value);
}
export function formatNumber(value) {
    if (value == null || Number.isNaN(value))
        return "—";
    return new Intl.NumberFormat(LOCALE).format(value);
}
export function truncate(text, len = 64) {
    if (!text)
        return "";
    return text.length > len ? text.slice(0, len - 1) + "…" : text;
}
