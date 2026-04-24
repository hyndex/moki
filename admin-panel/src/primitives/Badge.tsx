import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium border",
  {
    variants: {
      intent: {
        neutral: "bg-surface-2 text-text-secondary border-border",
        accent: "bg-accent-subtle text-accent border-accent/30",
        success:
          "bg-intent-success-bg text-intent-success border-intent-success/30",
        warning:
          "bg-intent-warning-bg text-intent-warning border-intent-warning/30",
        danger:
          "bg-intent-danger-bg text-intent-danger border-intent-danger/30",
        info: "bg-intent-info-bg text-intent-info border-intent-info/30",
      },
    },
    defaultVariants: { intent: "neutral" },
  },
);

export type Intent = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, intent, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ intent }), className)}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";
