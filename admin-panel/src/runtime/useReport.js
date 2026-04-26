import * as React from "react";
import { useRuntime } from "./context";
export function useReport(def, filters) {
    const { resources, bus } = useRuntime();
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [nonce, setNonce] = React.useState(0);
    const key = JSON.stringify({ id: def.id, filters });
    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        def
            .execute({ filters, resources })
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
        return bus.on("realtime:resource-changed", (e) => {
            if (e.resource === def.resource)
                setNonce((n) => n + 1);
        });
    }, [bus, def.resource]);
    return { data, loading, error, refetch: () => setNonce((n) => n + 1) };
}
