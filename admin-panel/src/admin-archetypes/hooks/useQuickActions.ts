import * as React from "react";

/** A page-level quick-action (Cmd-K palette entry).
 *
 *  Plugins describe their actions on the PluginPageDescriptor's
 *  `quickActions` field; pages can also register additional ones at
 *  runtime via this hook. The shell then surfaces them in the global
 *  CommandPalette. */
export interface PageQuickAction {
  id: string;
  label: string;
  /** Optional Lucide icon name. */
  icon?: string;
  /** Search keywords for fuzzy match. */
  keywords?: readonly string[];
  /** Action handler. May be async. */
  run: () => void | Promise<void>;
  /** Optional permission requirement string (e.g. "crm.write"). */
  requires?: string;
}

/** Internal registry: tracks quick-actions registered on the current
 *  page. The shell's CommandPalette subscribes to dispatched events. */
interface QuickActionRegistration extends PageQuickAction {
  pageId: string;
}

const registry = new Map<string, QuickActionRegistration>();
const SUBSCRIBERS = new Set<(actions: readonly QuickActionRegistration[]) => void>();

function notify() {
  const list = Array.from(registry.values());
  for (const fn of SUBSCRIBERS) fn(list);
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("gutu:quick-actions:update", { detail: list }),
    );
  } catch {
    /* CustomEvent unsupported */
  }
}

/** Register a list of quick-actions for the lifetime of the calling
 *  component. The actions appear in the global Cmd-K palette while the
 *  page is mounted. */
export function useQuickActions(
  pageId: string,
  actions: readonly PageQuickAction[],
  options: { enabled?: boolean } = {},
): void {
  const enabled = options.enabled ?? true;
  // Stabilise the actions reference shape so we don't re-register every
  // render unless the *content* actually changed.
  const sig = React.useMemo(
    () =>
      JSON.stringify(
        actions.map((a) => ({ id: a.id, label: a.label, icon: a.icon, keywords: a.keywords, requires: a.requires })),
      ),
    [actions],
  );
  const actionsRef = React.useRef(actions);
  actionsRef.current = actions;

  React.useEffect(() => {
    if (!enabled) return;
    const ids: string[] = [];
    for (const a of actionsRef.current) {
      const key = `${pageId}::${a.id}`;
      ids.push(key);
      registry.set(key, { ...a, pageId });
    }
    notify();
    return () => {
      for (const key of ids) registry.delete(key);
      notify();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, sig, enabled]);
}

/** Subscribe to the registry from outside React (e.g. the shell's
 *  CommandPalette consumer). Returns an `off()` function. */
export function onQuickActionsChange(
  handler: (actions: readonly PageQuickAction[]) => void,
): () => void {
  SUBSCRIBERS.add(handler);
  // Emit current.
  handler(Array.from(registry.values()));
  return () => {
    SUBSCRIBERS.delete(handler);
  };
}

/** Read the current set of registered quick-actions. Mainly for
 *  CommandPalette implementations that prefer reads to subscriptions. */
export function getQuickActionsSnapshot(): readonly PageQuickAction[] {
  return Array.from(registry.values());
}
