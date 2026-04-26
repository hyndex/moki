import { apiFetch } from "./auth";
export class ErpClient {
    mapDocument(input) {
        return apiFetch("/erp/actions/map-document", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
    previewPosting(input) {
        return apiFetch("/erp/actions/postings/preview", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
    postEntries(input) {
        return apiFetch("/erp/actions/postings", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
    transitionWorkflow(input) {
        return apiFetch("/erp/actions/transition", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
    cancelDocument(input) {
        return apiFetch("/erp/actions/cancel", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
    reverseDocument(input) {
        return apiFetch("/erp/actions/reverse", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
    reconcileDocument(input) {
        return apiFetch("/erp/actions/reconcile", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
    relatedLedger(resource, id) {
        return apiFetch(`/erp/ledger/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`);
    }
    relatedStock(resource, id) {
        return apiFetch(`/erp/stock/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`);
    }
    runReport(input) {
        const qs = new URLSearchParams();
        if (input.resource)
            qs.set("resource", input.resource);
        if (input.recordId)
            qs.set("recordId", input.recordId);
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        return apiFetch(`/erp/reports/${encodeURIComponent(input.reportId)}${suffix}`);
    }
    listRelated(resource, id) {
        return apiFetch(`/erp/related/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`);
    }
    renderPrint(resource, id, formatId = "standard") {
        const qs = new URLSearchParams({ format: formatId });
        return apiFetch(`/erp/print/${encodeURIComponent(resource)}/${encodeURIComponent(id)}?${qs.toString()}`);
    }
    createPortalLink(input) {
        return apiFetch("/erp/portal-links", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
    revokePortalLink(id) {
        return apiFetch(`/erp/portal-links/${encodeURIComponent(id)}/revoke`, { method: "POST" });
    }
}
