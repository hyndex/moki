import * as React from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/primitives/Button";
import { cn } from "@/lib/cn";
import { useArchetypeToast } from "../hooks/useArchetypeToast";

export interface BulkAction {
  id: string;
  label: React.ReactNode;
  /** Lucide icon name. */
  icon?: React.ReactNode;
  /** Style variant — matches `@/primitives/Button` variants. */
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
  /** When true, prompt for confirmation before invoking handler. */
  confirm?: { title: string; description?: string };
  /** Toast on completion. Use to confirm async work. */
  toast?:
    | { success?: string; error?: string }
    | ((selectedCount: number) => { success?: string; error?: string });
  onAction: () => void | Promise<void>;
}

export interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: readonly BulkAction[];
  className?: string;
}

/** Compact bulk-action chips. Place inside the S7 ActionBar slot or above
 *  the data grid. Action labels stay short; destructive operations confirm. */
export function BulkActionBar({
  selectedCount,
  onClear,
  actions,
  className,
}: BulkActionBarProps) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<BulkAction | null>(null);
  const toast = useArchetypeToast();

  const execute = async (a: BulkAction) => {
    setPending(a.id);
    try {
      await a.onAction();
      const t = typeof a.toast === "function" ? a.toast(selectedCount) : a.toast;
      if (t?.success) {
        toast({ title: t.success, intent: "success" });
      }
    } catch (err) {
      const t = typeof a.toast === "function" ? a.toast(selectedCount) : a.toast;
      toast({
        title: t?.error ?? "Action failed",
        description: err instanceof Error ? err.message : undefined,
        intent: "danger",
      });
      throw err;
    } finally {
      setPending(null);
    }
  };

  const run = async (a: BulkAction) => {
    if (a.confirm) {
      setConfirming(a);
      return;
    }
    await execute(a).catch(() => {/* surfaced via toast */});
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <span className="text-xs font-medium text-text-primary tabular-nums">
        {selectedCount} selected
      </span>
      <button
        type="button"
        onClick={onClear}
        className="text-xs text-text-muted hover:text-text-primary inline-flex items-center gap-1"
      >
        <X className="h-3 w-3" aria-hidden /> Clear
      </button>
      <span className="h-4 w-px bg-border mx-1" aria-hidden />
      {actions.map((a) => (
        <Button
          key={a.id}
          size="sm"
          variant={a.variant ?? "outline"}
          disabled={pending === a.id}
          onClick={() => run(a)}
        >
          {pending === a.id ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden />
          ) : (
            a.icon
          )}
          {a.label}
        </Button>
      ))}
      {confirming && (
        <ConfirmDialog
          action={confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            const a = confirming;
            setConfirming(null);
            await execute(a).catch(() => {/* surfaced via toast */});
          }}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  action,
  onCancel,
  onConfirm,
}: {
  action: BulkAction;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = React.useState(false);
  const handleConfirm = async () => {
    setBusy(true);
    await onConfirm();
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-surface-raised rounded-lg border border-border shadow-lg max-w-sm w-full p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div id="confirm-title" className="text-base font-semibold">
          {action.confirm!.title}
        </div>
        {action.confirm!.description && (
          <div className="text-sm text-text-muted mt-1">
            {action.confirm!.description}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={action.variant ?? "primary"}
            onClick={handleConfirm}
            disabled={busy}
          >
            {action.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
