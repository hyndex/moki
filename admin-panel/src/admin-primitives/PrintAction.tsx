/** Print action button + print-format picker.
 *
 *  Drop in on any detail page; pass the resource id and the current
 *  record body. Opens a popover with the available print formats for
 *  the resource (defaults pinned to top); selecting one renders via
 *  the backend (`POST /print-formats/:resource/:id/render`) and
 *  presents the HTML in a new browser window with `window.print()`
 *  triggered on load. The browser's print → "Save as PDF" handles PDF
 *  generation without a server-side rasterizer.
 *
 *  When no formats are configured, the button deep-links to the
 *  Settings → Print formats page scoped to this resource. */

import * as React from "react";
import { Printer, FileText, Plus } from "lucide-react";
import { Button } from "@/primitives/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/primitives/Popover";
import { Spinner } from "@/primitives/Spinner";
import {
  type PrintFormat,
  usePrintFormats,
  renderPrintFormatApi,
} from "@/runtime/useCustomizationApi";

interface Props {
  resource: string;
  record: Record<string, unknown>;
  /** Extra context fed to the template engine (currency, locale, …). */
  context?: Record<string, unknown>;
  size?: "xs" | "sm";
  variant?: "ghost" | "secondary" | "primary";
  label?: string;
}

export function PrintAction({
  resource,
  record,
  context,
  size = "sm",
  variant = "ghost",
  label = "Print",
}: Props): React.JSX.Element {
  const { rows, loading } = usePrintFormats(resource);
  const [open, setOpen] = React.useState(false);
  const [renderingId, setRenderingId] = React.useState<string | null>(null);

  const trigger = async (fmt: PrintFormat) => {
    setRenderingId(fmt.id);
    try {
      const out = await renderPrintFormatApi(resource, fmt.id, { record, context });
      // Open in a separate window. We add a small inline script to
      // call window.print() once the document is fully laid out — that
      // way the user gets the system print dialog immediately and can
      // save-as-PDF if desired. We also set a friendly title so the
      // dialog shows the resource name.
      const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
      if (!printWindow) {
        alert("Pop-ups are blocked. Allow pop-ups for this site to print.");
        return;
      }
      const augmented = out.html.replace(
        "</body>",
        `<script>window.addEventListener('load', () => { setTimeout(() => window.print(), 250); });</script></body>`,
      );
      printWindow.document.open();
      printWindow.document.write(augmented);
      printWindow.document.close();
    } catch (err) {
      alert(`Render failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRenderingId(null);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          iconLeft={<Printer className="h-3.5 w-3.5" />}
        >
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-96 overflow-auto">
        <div className="px-3 py-2 border-b border-border-subtle text-xs uppercase tracking-wider text-text-muted">
          Print formats
        </div>
        {loading ? (
          <div className="px-3 py-6 flex items-center justify-center text-text-muted">
            <Spinner size={12} />
            <span className="ml-2 text-xs">Loading…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-3 flex flex-col gap-2">
            <p className="text-xs text-text-muted">
              No print formats yet for <code className="font-mono">{resource}</code>.
            </p>
            <Button
              size="xs"
              variant="primary"
              iconLeft={<Plus className="h-3 w-3" />}
              onClick={() => {
                window.location.hash = `/settings/print-formats?resource=${encodeURIComponent(resource)}`;
              }}
            >
              Create first format
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            {rows
              .filter((r) => !r.disabled)
              .map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => void trigger(f)}
                  disabled={renderingId !== null}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-left text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed border-b border-border-subtle last:border-b-0"
                >
                  <FileText className="h-3.5 w-3.5 text-text-muted shrink-0" />
                  <span className="flex-1 min-w-0 truncate">
                    {f.name}
                    {f.isDefault ? <span className="ml-1 text-text-muted text-[10px]">(default)</span> : null}
                  </span>
                  {renderingId === f.id ? <Spinner size={10} /> : null}
                </button>
              ))}
            <button
              type="button"
              onClick={() => {
                window.location.hash = `/settings/print-formats?resource=${encodeURIComponent(resource)}`;
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs text-left text-text-muted hover:bg-surface-2 border-t border-border"
            >
              <Plus className="h-3 w-3" />
              Manage print formats…
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
