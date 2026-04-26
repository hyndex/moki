/** Per-page permissions enforcement.
 *
 *  The shell reads `permissions` from the resolved view (via the
 *  PluginPageDescriptor `permissions` field plus any inherited
 *  resource-level requirements) and gates rendering with a single
 *  React context that descendants can also query.
 *
 *  Two layers:
 *
 *    1. <PermissionsProvider grants={{...}}>  →  app-level grants of
 *       what the current user can do (e.g. `["crm.read", "crm.write",
 *       "accounting.read"]`).
 *
 *    2. <RequirePermissions need={["crm.read"]}>  →  gates a subtree;
 *       renders the fallback if the active grants don't cover `need`.
 *
 *  The shell uses both: the context gets populated from the auth /
 *  user-roles plugin once per session; the gate wraps every plugin
 *  page automatically inside ArchetypeAwareMain. */

import * as React from "react";
import { ShieldOff } from "lucide-react";
import { Button } from "@/primitives/Button";
import { cn } from "@/lib/cn";

export type Permission = string;

export interface PermissionsContextValue {
  /** Set of grants the current user has. */
  grants: ReadonlySet<Permission>;
  /** Helper that evaluates a single requirement (single perm, AND-set,
   *  OR-set). */
  has: (need: PermissionRequirement | undefined) => boolean;
}

/** A permission requirement is either:
 *    - a single permission string (must be present)
 *    - an array (AND — all must be present)
 *    - an object `{ anyOf: [...] }` (OR — at least one must be present)
 */
export type PermissionRequirement =
  | Permission
  | readonly Permission[]
  | { anyOf: readonly Permission[] };

const Context = React.createContext<PermissionsContextValue>({
  grants: new Set<Permission>(),
  has: () => true,
});

export function evaluateRequirement(
  grants: ReadonlySet<Permission>,
  need: PermissionRequirement | undefined,
): boolean {
  if (need == null) return true;
  if (typeof need === "string") return grants.has(need);
  if (Array.isArray(need)) return need.every((n) => grants.has(n));
  if ("anyOf" in need) return need.anyOf.some((n) => grants.has(n));
  return true;
}

export interface PermissionsProviderProps {
  children: React.ReactNode;
  /** Iterable of permission grants. Pass an empty array for an unauth user. */
  grants: Iterable<Permission>;
  /** When true, every requirement is satisfied (super-admin / dev mode). */
  bypass?: boolean;
}

export function PermissionsProvider({
  children,
  grants,
  bypass,
}: PermissionsProviderProps) {
  const value = React.useMemo<PermissionsContextValue>(() => {
    const set = new Set<Permission>(grants);
    return {
      grants: set,
      has: (need) => bypass === true || evaluateRequirement(set, need),
    };
  }, [grants, bypass]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePermissions(): PermissionsContextValue {
  return React.useContext(Context);
}

/** Returns true when the current user satisfies the given requirement. */
export function useHasPermission(
  need: PermissionRequirement | undefined,
): boolean {
  const ctx = usePermissions();
  return React.useMemo(() => ctx.has(need), [ctx, need]);
}

export interface RequirePermissionsProps {
  need?: PermissionRequirement;
  children: React.ReactNode;
  /** Rendered when the user is not granted; defaults to <AccessDenied />. */
  fallback?: React.ReactNode;
}

/** Subtree gate. Use freely inside any archetype page or widget. */
export function RequirePermissions({
  need,
  children,
  fallback,
}: RequirePermissionsProps) {
  const allowed = useHasPermission(need);
  if (allowed) return <>{children}</>;
  return <>{fallback ?? <AccessDenied need={need} />}</>;
}

export interface AccessDeniedProps {
  /** Optional rendered context (e.g., the missing permission). */
  need?: PermissionRequirement;
  className?: string;
  /** When provided, shown as a CTA below the message. */
  primary?: { label: React.ReactNode; onAction: () => void };
}

/** Default access-denied surface. Plugins can pass their own fallback
 *  to <RequirePermissions> if they want a tailored UX. */
export function AccessDenied({ need, className, primary }: AccessDeniedProps) {
  const reason =
    need == null
      ? "You do not have permission to view this content."
      : typeof need === "string"
        ? `You need the ${need} permission.`
        : Array.isArray(need)
          ? `You need: ${need.join(", ")}.`
          : `You need one of: ${(need as { anyOf: readonly string[] }).anyOf.join(", ")}.`;
  return (
    <div
      role="alert"
      data-archetype-widget="access-denied"
      className={cn(
        "rounded-lg border border-warning/40 bg-warning-soft/20 p-6 flex flex-col items-center text-center gap-3",
        className,
      )}
    >
      <div className="h-12 w-12 rounded-full bg-warning-soft flex items-center justify-center">
        <ShieldOff className="h-6 w-6 text-warning-strong" aria-hidden />
      </div>
      <div>
        <div className="text-base font-semibold text-text-primary">Access denied</div>
        <div className="text-sm text-text-muted mt-1">{reason}</div>
      </div>
      {primary && (
        <Button onClick={primary.onAction}>{primary.label}</Button>
      )}
    </div>
  );
}
