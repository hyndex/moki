import React from "react";

import { ShellProvider } from "./providers";
import type { ShellKind, ShellProviderContract, UiRegistry } from "./types";

type ShellProps = {
  title: string;
  shell: ShellKind;
  registry: UiRegistry;
  providers?: ShellProviderContract | undefined;
  children?: React.ReactNode;
};

function ShellFrame({ title, shell, registry, providers, children }: ShellProps) {
  const routeCount = registry.embeddedPages.filter((entry) => entry.shell === shell).length;
  const content = (
    <div data-shell={shell}>
      <header>
        <h1>{title}</h1>
        <p>{routeCount} route(s) registered</p>
      </header>
      <main>{children}</main>
    </div>
  );

  if (!providers) {
    return content;
  }

  return <ShellProvider value={providers}>{content}</ShellProvider>;
}

export function AdminShell(props: Omit<ShellProps, "title" | "shell">) {
  return <ShellFrame title="Admin Shell" shell="admin" {...props} />;
}

export function PortalShell(props: Omit<ShellProps, "title" | "shell">) {
  return <ShellFrame title="Portal Shell" shell="portal" {...props} />;
}

export function SiteShell(props: Omit<ShellProps, "title" | "shell">) {
  return <ShellFrame title="Site Shell" shell="site" {...props} />;
}
