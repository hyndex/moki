import * as React from "react";
import { Page } from "../slots/Page";
import { PageHeaderSlot } from "../slots/PageHeaderSlot";
import { BodyLayout } from "../slots/Layout";
import { MainCanvas } from "../slots/MainCanvas";
import { Rail } from "../slots/Rail";
import { ActionBar } from "../slots/ActionBar";
import { Button } from "@/primitives/Button";
import { cn } from "@/lib/cn";
import type { Density } from "../types";

export interface FormArchetypeProps {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Section nav (e.g., for long forms, a side rail of sections). */
  sectionNav?: React.ReactNode;
  /** Form body. */
  children: React.ReactNode;
  /** Right rail: validation summary, history, AI hints. */
  rail?: React.ReactNode;
  /** When true, the action bar is shown (Save / Cancel). */
  dirty?: boolean;
  /** Submit handler. */
  onSave?: () => void | Promise<void>;
  /** Cancel handler. */
  onCancel?: () => void;
  /** When true, save in-flight. Disables both buttons + shows progress. */
  saving?: boolean;
  /** Save button label. Default "Save". */
  saveLabel?: React.ReactNode;
  /** When true, the save button is destructive coloured (e.g., delete-confirmation forms). */
  destructive?: boolean;
  density?: Density;
  className?: string;
}

/** Half-archetype: a long-running form with validation summary + sticky
 *  action bar that appears once the form becomes dirty. Pair with the
 *  shell's existing FormView primitives — this archetype just provides
 *  the page shell. */
export function FormArchetype({
  id,
  title,
  subtitle,
  sectionNav,
  children,
  rail,
  dirty = false,
  onSave,
  onCancel,
  saving = false,
  saveLabel = "Save",
  destructive = false,
  density = "comfortable",
  className,
}: FormArchetypeProps) {
  return (
    <Page archetype="detail-rich" id={id} density={density} className={className}>
      <PageHeaderSlot title={title} subtitle={subtitle} />
      <BodyLayout
        main={
          <MainCanvas>
            <div className="grid gap-4" style={{ gridTemplateColumns: sectionNav ? "200px minmax(0,1fr)" : "minmax(0,1fr)" }}>
              {sectionNav && (
                <nav role="navigation" aria-label="Form sections" className="text-sm">
                  {sectionNav}
                </nav>
              )}
              <div className="min-w-0">{children}</div>
            </div>
          </MainCanvas>
        }
        rail={rail ? <Rail>{rail}</Rail> : undefined}
        railWidth={320}
      />
      <ActionBar
        open={dirty}
        start={
          <span className={cn("inline-flex items-center gap-1", saving && "text-text-muted")}>
            {saving ? "Saving…" : "Unsaved changes"}
          </span>
        }
        end={
          <>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
            )}
            <Button
              variant={destructive ? "danger" : "primary"}
              onClick={onSave}
              disabled={saving || !onSave}
            >
              {saveLabel}
            </Button>
          </>
        }
      />
    </Page>
  );
}
