/** View extension helpers — plugins augment another plugin's page.
 *
 *  A plugin can register extensions targeting a specific view id (or a
 *  predicate) that add:
 *    - tabs (to a detail view)
 *    - sections (rail cards) to a detail view
 *    - rowActions, pageActions, bulkActions to a list view
 *    - a `wrap` middleware around any view
 *
 *  The shell's view renderers call the helpers below to discover and
 *  compose extensions at render time. Because they look up from the live
 *  contribution store, adding / removing a plugin takes effect without a
 *  page reload. */

import type { PluginHost2 } from "./pluginHost2";
import type { ViewExtension } from "@/contracts/plugin-v2";
import type { ActionDescriptor } from "@/contracts/actions";
import type { ReactNode } from "react";
import type { View } from "@/contracts/views";

export interface ResolvedViewExtensions {
  readonly tabs: readonly {
    readonly id: string;
    readonly label: string;
    readonly priority: number;
    readonly render: (record: Record<string, unknown>) => ReactNode;
    readonly visibleWhen?: (record: Record<string, unknown>) => boolean;
    readonly contributor: string;
  }[];
  readonly railCards: readonly {
    readonly id: string;
    readonly priority: number;
    readonly render: (record: Record<string, unknown>) => ReactNode;
    readonly contributor: string;
  }[];
  readonly sections: readonly {
    readonly id: string;
    readonly title: string;
    readonly priority: number;
    readonly render: (record: Record<string, unknown>) => ReactNode;
    readonly contributor: string;
  }[];
  readonly rowActions: readonly ActionDescriptor[];
  readonly pageActions: readonly ActionDescriptor[];
  readonly bulkActions: readonly ActionDescriptor[];
  readonly wraps: readonly {
    readonly wrap: ViewExtension["wrap"];
    readonly contributor: string;
  }[];
}

export function resolveViewExtensions(
  host: PluginHost2 | null,
  view: View,
): ResolvedViewExtensions {
  const empty: ResolvedViewExtensions = {
    tabs: [],
    railCards: [],
    sections: [],
    rowActions: [],
    pageActions: [],
    bulkActions: [],
    wraps: [],
  };
  if (!host) return empty;
  const tabs: ResolvedViewExtensions["tabs"][number][] = [];
  const railCards: ResolvedViewExtensions["railCards"][number][] = [];
  const sections: ResolvedViewExtensions["sections"][number][] = [];
  const rowActions: ActionDescriptor[] = [];
  const pageActions: ActionDescriptor[] = [];
  const bulkActions: ActionDescriptor[] = [];
  const wraps: ResolvedViewExtensions["wraps"][number][] = [];

  const resource = "resource" in view && typeof view.resource === "string"
    ? view.resource
    : undefined;

  for (const { extension: ext, pluginId } of host.contributions.viewExtensions.values()) {
    const target = ext.target;
    const hit =
      typeof target === "string"
        ? target === view.id
        : target(view.id, resource);
    if (!hit) continue;
    if (ext.tab) {
      tabs.push({
        id: ext.tab.id,
        label: ext.tab.label,
        priority: ext.tab.priority ?? 50,
        render: ext.tab.render,
        visibleWhen: ext.tab.visibleWhen,
        contributor: pluginId,
      });
    }
    if (ext.railCard) {
      railCards.push({
        id: ext.railCard.id,
        priority: ext.railCard.priority ?? 50,
        render: ext.railCard.render,
        contributor: pluginId,
      });
    }
    if (ext.section) {
      sections.push({
        id: ext.section.id,
        title: ext.section.title,
        priority: ext.section.priority ?? 50,
        render: ext.section.render,
        contributor: pluginId,
      });
    }
    if (ext.rowAction) rowActions.push(ext.rowAction);
    if (ext.pageAction) pageActions.push(ext.pageAction);
    if (ext.bulkAction) bulkActions.push(ext.bulkAction);
    if (ext.wrap) wraps.push({ wrap: ext.wrap, contributor: pluginId });
  }

  tabs.sort((a, b) => a.priority - b.priority);
  railCards.sort((a, b) => a.priority - b.priority);
  sections.sort((a, b) => a.priority - b.priority);

  return {
    tabs,
    railCards,
    sections,
    rowActions,
    pageActions,
    bulkActions,
    wraps,
  };
}
