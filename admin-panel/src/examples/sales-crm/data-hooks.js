import { useAllRecords } from "@/runtime/hooks";
/** One hook per resource so rich pages pull live rows straight from the API.
 *  Backed by the query cache — multiple components calling the same hook dedupe.
 *  Each hook returns `{ data, loading }`: pages render empty-shell UI while
 *  data is in flight, and re-render automatically when the cache updates. */
export function useContacts() {
    return useAllRecords("crm.contact");
}
export function useActivities() {
    return useAllRecords("crm.activity");
}
export function useDeals() {
    return useAllRecords("sales.deal");
}
export function useQuotes() {
    return useAllRecords("sales.quote");
}
export function useSpaces() {
    return useAllRecords("community.space");
}
export function usePosts() {
    return useAllRecords("community.post");
}
export function useReports() {
    return useAllRecords("community.report");
}
export function useEntities() {
    return useAllRecords("party-relationships.entity");
}
export function useEdges() {
    return useAllRecords("party-relationships.relationship");
}
