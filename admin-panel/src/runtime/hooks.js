import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRuntime } from "./context";
export function useList(resource, query = {}) {
    const runtime = useRuntime();
    const key = JSON.stringify({ resource, op: "list", query });
    const snapshot = useSyncExternalStore((onStore) => runtime.resources.cache.subscribe(key, onStore), () => runtime.resources.cache.get(key), () => runtime.resources.cache.get(key));
    // Fetch whenever the key changes.
    useEffect(() => {
        void runtime.resources.list(resource, query).catch(() => {
            /* error is already stored in cache state and surfaced below */
        });
    }, [key, resource, runtime, query]);
    // Auto-refetch when the realtime channel invalidates this resource.
    useEffect(() => {
        const off = runtime.bus.on("realtime:resource-changed", (evt) => {
            if (evt.resource !== resource)
                return;
            void runtime.resources.list(resource, query).catch(() => {
                /* ignore — surfaced via snapshot.error */
            });
        });
        return off;
    }, [resource, runtime, query]);
    return {
        data: snapshot.data,
        loading: snapshot.status === "loading" || snapshot.status === "idle",
        error: snapshot.error,
        refetch: () => {
            runtime.resources.cache.invalidateResource(resource);
            void runtime.resources.list(resource, query).catch(() => undefined);
        },
    };
}
/** Convenience: fetch every record for a resource as a flat array. Pages used
 *  by rich dashboards (CRM overview, Sales pipeline, etc.) need the full
 *  collection — this hook hides pagination. Capped at 1000 rows. */
export function useAllRecords(resource, query = {}) {
    const effective = useMemo(() => ({ ...query, pageSize: 1000 }), [query]);
    const { data, loading, error, refetch } = useList(resource, effective);
    return {
        data: data?.rows ?? [],
        loading,
        error,
        refetch,
    };
}
export function useRecord(resource, id) {
    const runtime = useRuntime();
    const [state, setState] = useState({ loading: true });
    useEffect(() => {
        if (!id) {
            setState({ loading: false, data: null });
            return;
        }
        let cancelled = false;
        setState({ loading: true });
        runtime.resources
            .get(resource, id)
            .then((data) => !cancelled && setState({ loading: false, data }))
            .catch((error) => !cancelled && setState({ loading: false, error }));
        return () => {
            cancelled = true;
        };
    }, [resource, id, runtime]);
    return state;
}
