import { Command } from "cmdk";
import React from "react";

import { cn } from "@platform/ui";

export const packageId = "command-palette" as const;
export const packageDisplayName = "Command Palette" as const;
export const packageDescription = "cmdk-backed command palette primitives for governed admin actions." as const;

export type CommandPaletteItem = {
  id: string;
  label: string;
  hint?: string | undefined;
  href?: string | undefined;
  group?: string | undefined;
  keywords?: string[] | undefined;
  permission?: string | undefined;
};

export type CommandPaletteGroup = {
  label: string;
  items: CommandPaletteItem[];
};

export function rankCommandPaletteItems(query: string, items: CommandPaletteItem[]): CommandPaletteItem[] {
  const normalizedQuery = normalizeQuery(query);
  return [...items]
    .map((item) => ({
      item,
      score: scoreCommandItem(normalizedQuery, item)
    }))
    .filter((entry) => normalizedQuery.length === 0 || entry.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return left.item.label.localeCompare(right.item.label);
    })
    .map((entry) => entry.item);
}

export function filterCommandPaletteItems(input: {
  query: string;
  items: CommandPaletteItem[];
  grantedPermissions?: string[] | undefined;
}): CommandPaletteItem[] {
  const granted = new Set(input.grantedPermissions ?? []);
  const visible = input.items.filter((item) => !item.permission || granted.has(item.permission));
  return rankCommandPaletteItems(input.query, visible);
}

export function groupCommandPaletteItems(items: CommandPaletteItem[]): CommandPaletteGroup[] {
  const groups = new Map<string, CommandPaletteItem[]>();
  for (const item of items) {
    const label = item.group ?? "Commands";
    const existing = groups.get(label) ?? [];
    existing.push(item);
    groups.set(label, existing);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, groupedItems]) => ({
      label,
      items: groupedItems.sort((left, right) => left.label.localeCompare(right.label))
    }));
}

export function PlatformCommandPalette(props: {
  query: string;
  items: CommandPaletteItem[];
  emptyLabel?: string | undefined;
}) {
  const groups = groupCommandPaletteItems(props.items);
  return React.createElement(
    "section",
    {
      className: "awb-command-dialog",
      "data-testid": "command-dialog"
    },
    React.createElement(
      Command,
      {
        label: "Command palette",
        className: "awb-command-host"
      },
      React.createElement(Command.Input, {
        value: props.query,
        readOnly: true,
        className: "awb-command-query",
        placeholder: "Type a command or jump target"
      }),
      React.createElement(
        Command.List,
        { className: "awb-command-list" },
        props.items.length === 0
          ? React.createElement(Command.Empty, { className: "awb-muted-copy" }, props.emptyLabel ?? "No commands available.")
          : groups.map((group) =>
              React.createElement(
                Command.Group,
                { key: group.label, heading: group.label },
                group.items.map((item) =>
                  React.createElement(
                    Command.Item,
                    {
                      key: item.id,
                      value: `${item.label} ${(item.keywords ?? []).join(" ")}`.trim(),
                      className: cn("awb-command-item")
                    },
                    React.createElement("div", { className: "awb-command-label" }, item.label),
                    item.hint ? React.createElement("div", { className: "awb-command-hint" }, item.hint) : null
                  )
                )
              )
            )
      )
    )
  );
}

export const PlatformCommandDialog = PlatformCommandPalette;

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function scoreCommandItem(query: string, item: CommandPaletteItem): number {
  if (!query) {
    return 1;
  }

  const haystacks = [item.label, ...(item.keywords ?? []), item.hint ?? ""].map((value) => value.toLowerCase());
  if (haystacks.some((value) => value === query)) {
    return 6;
  }
  if (haystacks.some((value) => value.startsWith(query))) {
    return 5;
  }
  if (haystacks.some((value) => value.includes(query))) {
    return 3;
  }
  return 0;
}
