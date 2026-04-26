import * as React from "react";
import { useRuntime } from "./context";
import { computeAggregation } from "./aggregations";
export function useAggregation(spec) {
    const { resources, bus } = useRuntime();
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(spec !== null && spec !== undefined);
    const [error, setError] = React.useState(null);
    const [nonce, setNonce] = React.useState(0);
    const key = spec ? JSON.stringify(spec) : "__skip__";
    React.useEffect(() => {
        if (!spec) {
            setLoading(false);
            setData(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        computeAggregation(spec, resources)
            .then((r) => {
            if (!cancelled) {
                setData(r);
                setError(null);
            }
        })
            .catch((e) => {
            if (!cancelled)
                setError(e instanceof Error ? e : new Error(String(e)));
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, resources, nonce]);
    React.useEffect(() => {
        if (!spec)
            return;
        return bus.on("realtime:resource-changed", (e) => {
            if (e.resource === spec.resource)
                setNonce((n) => n + 1);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bus, spec?.resource]);
    return { data, loading, error, refetch: () => setNonce((n) => n + 1) };
}
