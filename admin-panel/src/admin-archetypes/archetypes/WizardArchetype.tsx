import * as React from "react";
import { Check, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/primitives/Button";
import { Page } from "../slots/Page";
import { PageHeaderSlot } from "../slots/PageHeaderSlot";
import { MainCanvas } from "../slots/MainCanvas";
import { cn } from "@/lib/cn";
import type { Density } from "../types";

export interface WizardStep {
  id: string;
  label: string;
  description?: React.ReactNode;
  /** When true, this step renders in the stepper but cannot be navigated
   *  to until preceding steps are complete. Default: true. */
  blocking?: boolean;
  /** Optional validator. Returns false / a string to prevent advancing. */
  validate?: () => true | string | Promise<true | string>;
  /** Renders the step body. Receives `goNext()` / `goBack()` so steps
   *  can drive navigation themselves (e.g., "Save & continue"). */
  render: (ctx: { goNext: () => void; goBack: () => void; index: number; total: number }) => React.ReactNode;
}

export interface WizardArchetypeProps {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  steps: readonly WizardStep[];
  /** Initial step index. Default 0. */
  initialIndex?: number;
  /** Called once the user reaches the last step and clicks Finish. */
  onFinish?: () => void | Promise<void>;
  /** Called whenever the user navigates between steps. */
  onChange?: (index: number) => void;
  density?: Density;
  className?: string;
}

/** Half-archetype: configurator. The user advances through ordered
 *  steps; each step can validate itself; back-navigation is allowed
 *  unless steps mark themselves as terminal.
 *
 *  Implementation choices:
 *    - State (active step + per-step error message) is internal; pages
 *      that need to persist it across visits should pass `initialIndex`
 *      from URL state.
 *    - Step transitions respect validators; failed validation surfaces
 *      a small toast-style error above the body.
 *    - Cmd-Enter advances; Esc returns to previous step. */
export function WizardArchetype({
  id,
  title,
  subtitle,
  steps,
  initialIndex = 0,
  onFinish,
  onChange,
  density = "comfortable",
  className,
}: WizardArchetypeProps) {
  const [index, setIndex] = React.useState(() =>
    Math.max(0, Math.min(initialIndex, steps.length - 1)),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const setIdx = React.useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, steps.length - 1));
      setIndex(clamped);
      setError(null);
      onChange?.(clamped);
    },
    [steps.length, onChange],
  );

  const goNext = React.useCallback(async () => {
    if (busy) return;
    const step = steps[index];
    if (step?.validate) {
      setBusy(true);
      try {
        const result = await step.validate();
        if (result !== true) {
          setError(typeof result === "string" ? result : "Step is incomplete.");
          setBusy(false);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Validation failed.");
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    if (index >= steps.length - 1) {
      if (onFinish) {
        setBusy(true);
        try {
          await onFinish();
        } finally {
          setBusy(false);
        }
      }
      return;
    }
    setIdx(index + 1);
  }, [busy, index, steps, onFinish, setIdx]);

  const goBack = React.useCallback(() => {
    if (index === 0) return;
    setIdx(index - 1);
  }, [index, setIdx]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void goNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goBack]);

  const step = steps[index];
  const last = index === steps.length - 1;

  return (
    <Page archetype="detail-rich" id={id} density={density} className={className}>
      <PageHeaderSlot title={title} subtitle={subtitle} />
      <MainCanvas>
        <ol
          role="list"
          aria-label="Steps"
          className="flex items-center gap-3 text-xs flex-wrap"
        >
          {steps.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center gap-2"
              aria-current={i === index ? "step" : undefined}
            >
              <span
                className={cn(
                  "h-6 w-6 rounded-full border flex items-center justify-center font-mono",
                  i < index && "bg-success text-white border-success",
                  i === index && "border-accent text-accent",
                  i > index && "border-border text-text-muted",
                )}
              >
                {i < index ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              <button
                type="button"
                onClick={() => i <= index && setIdx(i)}
                disabled={i > index || (s.blocking !== false && i > index)}
                className={cn(
                  "text-sm",
                  i === index ? "text-text-primary font-semibold" : "text-text-muted hover:text-text-primary",
                )}
              >
                {s.label}
              </button>
              {i < steps.length - 1 && <span className="text-text-muted">→</span>}
            </li>
          ))}
        </ol>

        {step?.description && (
          <p className="text-sm text-text-muted">{step.description}</p>
        )}

        {error && (
          <div role="alert" className="rounded-md border border-danger/40 bg-danger-soft/30 px-3 py-2 text-sm text-danger-strong">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-border bg-surface-0 p-4">
          {step?.render({ goNext: () => void goNext(), goBack, index, total: steps.length })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={goBack} disabled={index === 0 || busy}>
            <ArrowLeft className="h-4 w-4 mr-1" aria-hidden /> Back
          </Button>
          <span className="text-xs text-text-muted">
            Step {index + 1} of {steps.length}
          </span>
          <Button onClick={() => void goNext()} disabled={busy}>
            {last ? "Finish" : "Next"}
            {!last && <ArrowRight className="h-4 w-4 ml-1" aria-hidden />}
          </Button>
        </div>
      </MainCanvas>
    </Page>
  );
}
