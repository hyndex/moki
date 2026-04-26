import { useAllRecords } from "@/runtime/hooks";
export function useSalesReps() {
    return useAllRecords("sales.rep");
}
export function useDealLineItems() {
    return useAllRecords("sales.deal-line-item");
}
export function useDealEvents() {
    return useAllRecords("sales.deal-event");
}
export function useCrmNotes() {
    return useAllRecords("crm.note");
}
export function usePlatformConfig(key) {
    const { data, loading } = useAllRecords("platform.config");
    const row = data.find((d) => d.key === key);
    return { value: row?.value, loading };
}
export function useLostReasons() {
    return useAllRecords("sales.lost-reason");
}
export function useStageVelocity() {
    return useAllRecords("sales.stage-velocity");
}
