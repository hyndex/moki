import * as React from "react";
import { Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/primitives/DropdownMenu";
import { Button } from "@/primitives/Button";
import { useRuntime } from "@/runtime/context";
import { useRegistries } from "@/host/pluginHostContext";

/** Legacy format type — kept so existing plugin-author code still compiles. */
export type ExportFormat = string;

export interface ExportCenterProps {
  resource: string;
  /** How many records would be exported with current scope (for the label). */
  count?: number;
  /** Produce a row list for the chosen format. Called on click. */
  fetchRows: () => Promise<Record<string, unknown>[]>;
  /** Optional custom file name (without extension). */
  fileName?: string;
  /** Restrict the formats shown. When omitted, every registered exporter
   *  in `registries.exporters` is offered. */
  formats?: readonly ExportFormat[];
  className?: string;
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ExportCenter({
  resource,
  count,
  fetchRows,
  fileName,
  formats,
  className,
}: ExportCenterProps) {
  const { analytics, actions } = useRuntime();
  const registries = useRegistries();
  const [busy, setBusy] = React.useState<string | null>(null);

  /* Discover exporters from the registry. Every plugin-registered
   * exporter appears here automatically. */
  const availableExporters = React.useMemo(() => {
    const all = registries?.exporters.list() ?? [];
    if (!formats) return all;
    const filter = new Set(formats);
    return all.filter((e) => filter.has(e.key));
  }, [registries, formats]);

  const run = async (format: string) => {
    setBusy(format);
    const started = Date.now();
    try {
      const rows = await fetchRows();
      analytics.emit("page.export.started", { resource, format, rows: rows.length });
      const baseName = fileName ?? resource.replace(/\./g, "-");
      const entry = registries?.exporters.list().find((e) => e.key === format);
      if (entry) {
        const blob = await entry.value.export(rows, { fileName: baseName });
        download(blob, `${baseName}.${entry.value.extension}`);
      } else {
        // No registered exporter — server-side / delegated path.
        actions.toast({
          title: `${format.toUpperCase()} export queued`,
          description: "You'll receive a notification when it's ready.",
          intent: "info",
        });
      }
      analytics.emit("page.export.delivered", {
        resource,
        format,
        durationMs: Date.now() - started,
      });
    } catch (err) {
      actions.toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unknown error",
        intent: "danger",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<Download className="h-3.5 w-3.5" />}
          loading={busy !== null}
          className={className}
        >
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs">
          {count !== undefined ? `${count} records · current view` : "Current view"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableExporters.length === 0 ? (
          <DropdownMenuItem disabled>No exporters registered</DropdownMenuItem>
        ) : (
          availableExporters.map((e) => (
            <DropdownMenuItem key={e.key} onSelect={() => void run(e.key)}>
              Export as {e.value.label}
              {e.contributor !== "shell" && (
                <span className="ml-2 text-[10px] text-text-muted">
                  · {e.contributor}
                </span>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
