import { buildControlRoom } from "./controlRoomHelper";
/** Compact builder that creates a Control Room from simpler inputs. */
export function buildCompactControlRoom(args) {
    const cols = Math.floor(12 / Math.min(args.kpis.length, 4));
    const chartCols = args.charts.length <= 2 ? 6 : args.charts.length <= 4 ? 6 : 4;
    const shortcutCols = Math.floor(12 / Math.min(args.shortcuts.length, 4));
    const kpis = args.kpis.map((k, i) => ({
        id: `k-${i}`,
        type: "number_card",
        col: cols,
        label: k.label,
        aggregation: {
            resource: k.resource,
            fn: k.fn ?? "count",
            field: k.field,
            filter: k.filter,
            range: k.range === "mtd" ? { kind: "mtd" }
                : k.range === "ytd" ? { kind: "ytd" }
                    : k.range === "last-7" ? { kind: "last", days: 7 }
                        : k.range === "last-30" ? { kind: "last", days: 30 }
                            : undefined,
        },
        format: k.format,
        drilldown: k.drilldown,
        warnAbove: k.warnAbove,
        dangerAbove: k.dangerAbove,
    }));
    const charts = args.charts.map((c, i) => ({
        id: `c-${i}`,
        type: "chart",
        col: chartCols,
        label: c.label,
        chart: c.chart,
        aggregation: {
            resource: c.resource,
            fn: c.fn ?? "count",
            field: c.field,
            groupBy: c.groupBy,
            period: c.period,
            range: c.lastDays ? { kind: "last", days: c.lastDays } : undefined,
        },
    }));
    const shortcuts = args.shortcuts.map((s, i) => ({
        id: `sc-${i}`,
        type: "shortcut",
        col: shortcutCols,
        label: s.label,
        icon: s.icon,
        href: s.href,
    }));
    const workspace = {
        id: `${args.viewId}.workspace`,
        label: args.title,
        filterBar: args.filterBar,
        widgets: [
            { id: "h1", type: "header", col: 12, label: "Overview", level: 2 },
            ...kpis,
            { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
            ...charts,
            { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
            ...shortcuts,
        ],
    };
    return buildControlRoom({
        viewId: args.viewId,
        resource: args.resource,
        title: args.title,
        description: args.description,
        workspace,
    });
}
