import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { AlertTriangle, Check, FileUp, UploadCloud } from "lucide-react";
import { Dialog, DialogContent } from "@/primitives/Dialog";
import { Button } from "@/primitives/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/primitives/Select";
import { Badge } from "@/primitives/Badge";
import { cn } from "@/lib/cn";
import { WorkflowStepper } from "./WorkflowStepper";
import { useRuntime } from "@/runtime/context";
function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0)
        return { headers: [], rows: [] };
    const split = (line) => {
        // minimal CSV split handling quoted fields with commas
        const out = [];
        let cur = "";
        let quoted = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
                if (quoted && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                }
                else
                    quoted = !quoted;
            }
            else if (c === "," && !quoted) {
                out.push(cur);
                cur = "";
            }
            else
                cur += c;
        }
        out.push(cur);
        return out;
    };
    const headers = split(lines[0]).map((h) => h.trim());
    const rows = lines.slice(1).map(split);
    return { headers, rows };
}
export function ImportWizard({ open, onOpenChange, resource, fields, onCommit, }) {
    const { analytics } = useRuntime();
    const [step, setStep] = React.useState("upload");
    const [fileName, setFileName] = React.useState("");
    const [parsed, setParsed] = React.useState({ headers: [], rows: [] });
    const [mapping, setMapping] = React.useState({});
    const [result, setResult] = React.useState(null);
    const [committing, setCommitting] = React.useState(false);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        if (!open) {
            setStep("upload");
            setFileName("");
            setParsed({ headers: [], rows: [] });
            setMapping({});
            setResult(null);
            setError(null);
        }
    }, [open]);
    const handleFile = async (file) => {
        setFileName(file.name);
        const text = await file.text();
        const p = parseCsv(text);
        setParsed(p);
        // naive auto-map: exact header → field match
        const auto = {};
        for (const f of fields) {
            const match = p.headers.find((h) => h.toLowerCase() === f.name.toLowerCase() || h.toLowerCase() === f.label.toLowerCase());
            if (match)
                auto[f.name] = match;
        }
        setMapping(auto);
        setStep("map");
        analytics.emit("page.import.started", { resource, source: "csv" });
    };
    const mappedRows = React.useMemo(() => {
        if (parsed.rows.length === 0)
            return [];
        return parsed.rows.map((row) => {
            const r = {};
            for (const f of fields) {
                const col = mapping[f.name];
                if (!col)
                    continue;
                const idx = parsed.headers.indexOf(col);
                if (idx >= 0)
                    r[f.name] = row[idx];
            }
            return r;
        });
    }, [parsed, mapping, fields]);
    const missingRequired = fields
        .filter((f) => f.required && !mapping[f.name])
        .map((f) => f.label);
    const commit = async () => {
        setCommitting(true);
        setError(null);
        try {
            const r = await onCommit(mappedRows);
            setResult(r);
            setStep("done");
            analytics.emit("page.import.committed", {
                resource,
                rows: r.created + r.updated,
                errors: r.errors.length,
            });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Import failed");
        }
        finally {
            setCommitting(false);
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-w-3xl", children: [_jsx("div", { className: "px-5 py-3 border-b border-border", children: _jsxs("div", { className: "text-sm font-semibold text-text-primary", children: ["Import ", resource] }) }), _jsx("div", { className: "p-5 pb-3", children: _jsx(WorkflowStepper, { steps: [
                            { id: "upload", label: "Upload" },
                            { id: "map", label: "Map" },
                            { id: "preview", label: "Preview" },
                            { id: "commit", label: "Commit" },
                        ], activeId: step === "done" ? "commit" : step }) }), _jsxs("div", { className: "p-5 pt-0 min-h-[240px]", children: [step === "upload" && _jsx(UploadStep, { onFile: handleFile }), step === "map" && (_jsx(MapStep, { fields: fields, headers: parsed.headers, mapping: mapping, onChange: setMapping, fileName: fileName, rowCount: parsed.rows.length, missingRequired: missingRequired })), step === "preview" && (_jsx(PreviewStep, { fields: fields, rows: mappedRows.slice(0, 20), total: mappedRows.length })), step === "done" && result && _jsx(DoneStep, { result: result }), error && (_jsx("div", { className: "mt-3 text-xs text-intent-danger", children: error }))] }), _jsxs("div", { className: "px-5 py-3 border-t border-border flex items-center justify-between", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => onOpenChange(false), children: "Cancel" }), _jsxs("div", { className: "flex items-center gap-2", children: [step === "map" && (_jsx(Button, { variant: "primary", size: "sm", disabled: missingRequired.length > 0, onClick: () => setStep("preview"), children: "Preview" })), step === "preview" && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setStep("map"), children: "Back" }), _jsxs(Button, { variant: "primary", size: "sm", onClick: commit, loading: committing, children: ["Commit ", mappedRows.length, " rows"] })] })), step === "done" && (_jsx(Button, { variant: "primary", size: "sm", onClick: () => onOpenChange(false), children: "Done" }))] })] })] }) }));
}
function UploadStep({ onFile }) {
    const [drag, setDrag] = React.useState(false);
    const ref = React.useRef(null);
    return (_jsxs("div", { onDragOver: (e) => { e.preventDefault(); setDrag(true); }, onDragLeave: () => setDrag(false), onDrop: (e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f)
                onFile(f);
        }, className: cn("border-2 border-dashed rounded-md px-6 py-10 text-center transition-colors", drag ? "border-accent bg-accent/5" : "border-border"), children: [_jsx(UploadCloud, { className: "h-8 w-8 mx-auto text-text-muted" }), _jsx("div", { className: "text-sm text-text-primary mt-2 font-medium", children: "Drop a CSV file" }), _jsx("div", { className: "text-xs text-text-muted mt-1", children: "or click to choose a file" }), _jsx("input", { ref: ref, type: "file", accept: ".csv,text/csv", className: "hidden", onChange: (e) => {
                    const f = e.target.files?.[0];
                    if (f)
                        onFile(f);
                } }), _jsx(Button, { variant: "ghost", size: "sm", className: "mt-3", onClick: () => ref.current?.click(), iconLeft: _jsx(FileUp, { className: "h-3.5 w-3.5" }), children: "Choose file" })] }));
}
function MapStep({ fields, headers, mapping, onChange, fileName, rowCount, missingRequired, }) {
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 text-xs text-text-muted mb-3", children: [_jsx("span", { className: "font-mono text-text-secondary", children: fileName }), _jsxs(Badge, { intent: "info", children: [rowCount, " rows"] })] }), missingRequired.length > 0 && (_jsxs("div", { className: "flex items-center gap-2 text-xs text-intent-warning bg-intent-warning-bg border border-intent-warning/30 rounded px-2.5 py-1.5 mb-3", children: [_jsx(AlertTriangle, { className: "h-3 w-3" }), "Required fields unmapped: ", missingRequired.join(", ")] })), _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wider text-text-muted", children: [_jsx("th", { className: "text-left py-2 pr-3", children: "Field" }), _jsx("th", { className: "text-left py-2", children: "CSV column" })] }) }), _jsx("tbody", { children: fields.map((f) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0", children: [_jsxs("td", { className: "py-2 pr-3", children: [_jsx("span", { className: "text-text-primary", children: f.label }), f.required && _jsx("span", { className: "text-intent-danger ml-1", children: "*" })] }), _jsx("td", { className: "py-2", children: _jsxs(Select, { value: mapping[f.name] ?? "", onValueChange: (v) => onChange({ ...mapping, [f.name]: v === "__none__" ? "" : v }), children: [_jsx(SelectTrigger, { className: "h-8 w-60", children: _jsx(SelectValue, { placeholder: "\u2014 none \u2014" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "__none__", children: "\u2014 none \u2014" }), headers.map((h) => (_jsx(SelectItem, { value: h, children: h }, h)))] })] }) })] }, f.name))) })] })] }));
}
function PreviewStep({ fields, rows, total, }) {
    return (_jsxs("div", { children: [_jsxs("div", { className: "text-xs text-text-muted mb-3", children: ["Showing first ", rows.length, " of ", total, " rows."] }), _jsx("div", { className: "border border-border rounded-md overflow-hidden", children: _jsx("div", { className: "max-h-80 overflow-y-auto", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { className: "bg-surface-1 sticky top-0", children: _jsx("tr", { className: "border-b border-border text-text-muted", children: fields.map((f) => (_jsx("th", { className: "text-left px-2.5 py-1.5 font-medium", children: f.label }, f.name))) }) }), _jsx("tbody", { children: rows.map((r, i) => (_jsx("tr", { className: "border-b border-border-subtle last:border-b-0", children: fields.map((f) => (_jsx("td", { className: "px-2.5 py-1.5 text-text-secondary", children: String(r[f.name] ?? "") }, f.name))) }, i))) })] }) }) })] }));
}
function DoneStep({ result, }) {
    return (_jsxs("div", { className: "py-6 text-center", children: [_jsx("div", { className: "h-12 w-12 mx-auto rounded-full bg-intent-success-bg text-intent-success flex items-center justify-center", children: _jsx(Check, { className: "h-6 w-6" }) }), _jsx("div", { className: "mt-3 text-sm font-medium text-text-primary", children: "Import complete" }), _jsxs("div", { className: "mt-1 text-xs text-text-muted", children: [result.created, " created \u00B7 ", result.updated, " updated \u00B7 ", result.skipped, " skipped", result.errors.length > 0 && ` · ${result.errors.length} errors`] }), result.errors.length > 0 && (_jsx("ul", { className: "mt-3 text-xs text-intent-danger text-left max-w-md mx-auto max-h-40 overflow-y-auto", children: result.errors.slice(0, 20).map((e, i) => (_jsxs("li", { children: ["Row ", e.row, ": ", e.message] }, i))) }))] }));
}
