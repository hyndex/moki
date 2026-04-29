import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-md font-medium select-none",
    "transition-colors duration-fast ease-out",
    "focus-visible:outline-none focus-visible:shadow-focus",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent-hover",
        secondary:
          "bg-surface-2 text-text-primary border border-border hover:bg-surface-3",
        ghost: "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
        danger: "bg-intent-danger text-white hover:opacity-90",
        outline:
          "border border-border bg-transparent text-text-primary hover:bg-surface-2",
        link: "text-text-link underline-offset-4 hover:underline px-0",
      },
      size: {
        xs: "h-6 px-2 text-xs",
        sm: "h-8 px-2.5 text-sm",
        md: "h-9 px-3 text-sm",
        lg: "h-10 px-4 text-base",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild,
      loading,
      disabled,
      iconLeft,
      iconRight,
      children,
      type,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    // Default to type="button" to match real-world button-library
    // conventions. HTML's `<button>` defaults to `type="submit"` when
    // nested in a `<form>`, which causes every styled action button
    // (e.g. "New", "Filter", a row's kebab) to accidentally submit
    // the form when clicked. Callers that genuinely need a submit
    // button still pass `type="submit"` explicitly. Skip the default
    // when `asChild` is set — Slot renders the consumer's element
    // (e.g. <a>), and forcing type="button" on a non-button element
    // is invalid markup.
    const resolvedType = asChild ? type : (type ?? "button");
    return (
      <Comp
        ref={ref}
        type={resolvedType}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        data-loading={loading || undefined}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          iconLeft
        )}
        {children}
        {iconRight}
      </Comp>
    );
  },
);
Button.displayName = "Button";
