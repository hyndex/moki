import * as React from "react";
import {
  Search,
  Sun,
  Moon,
  LayoutList,
  Rows3,
  Rows4,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/primitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@/primitives/DropdownMenu";
import { getDensity, getTheme, setDensity, setTheme } from "@/tokens";
import type { Density, Theme } from "@/tokens";
import { authStore, logout } from "@/runtime/auth";
import { AlertCenter, type Alert } from "@/admin-primitives/AlertCenter";
import { useRuntime } from "@/runtime/context";
import { Keyboard } from "lucide-react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

export interface TopbarProps {
  onOpenCommand: () => void;
  onOpenShortcuts?: () => void;
  breadcrumbs?: React.ReactNode;
}

export function Topbar({ onOpenCommand, onOpenShortcuts, breadcrumbs }: TopbarProps) {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  const theme: Theme = getTheme();
  const density: Density = getDensity();

  return (
    <header
      className="flex items-center gap-3 h-topbar-h px-4 bg-surface-0 border-b border-border sticky top-0 z-20"
      role="banner"
    >
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <WorkspaceSwitcher />
        {breadcrumbs ?? <div />}
      </div>

      <button
        type="button"
        onClick={onOpenCommand}
        className="inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-surface-1 text-sm text-text-muted hover:bg-surface-2 transition-colors min-w-[240px]"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="text-[10px] px-1 py-0.5 rounded bg-surface-3 text-text-secondary border border-border-subtle font-mono">
          ⌘K
        </kbd>
      </button>

      <AlertCenterMount />

      {onOpenShortcuts && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Keyboard shortcuts"
          onClick={onOpenShortcuts}
        >
          <Keyboard className="h-4 w-4" />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Appearance">
            {theme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => {
              setTheme("light");
              force();
            }}
          >
            <Sun className="h-4 w-4" /> Light
            {theme === "light" && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setTheme("dark");
              force();
            }}
          >
            <Moon className="h-4 w-4" /> Dark
            {theme === "dark" && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Density</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => {
              setDensity("comfortable");
              force();
            }}
          >
            <Rows3 className="h-4 w-4" /> Comfortable
            {density === "comfortable" && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setDensity("compact");
              force();
            }}
          >
            <LayoutList className="h-4 w-4" /> Compact
            {density === "compact" && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setDensity("dense");
              force();
            }}
          >
            <Rows4 className="h-4 w-4" /> Dense
            {density === "dense" && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountMenu />
    </header>
  );
}

function AlertCenterMount() {
  const { bus } = useRuntime();
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  React.useEffect(() => {
    // Mirror toast events into alerts. Real alerts come from notifications plugin.
    return bus.on("toast:add", (t) => {
      if (t.intent === "danger" || t.intent === "warning") {
        const alert: Alert = {
          id: t.id,
          title: t.title,
          body: t.description,
          intent: t.intent,
          createdAt: new Date().toISOString(),
          source: "system",
        };
        setAlerts((prev) => [alert, ...prev].slice(0, 50));
      }
    });
  }, [bus]);
  return (
    <AlertCenter
      alerts={alerts}
      onAck={(id) =>
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acked: true } : a)))
      }
      onSnooze={(id, minutes) => {
        const until = new Date(Date.now() + minutes * 60_000).toISOString();
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, snoozedUntil: until } : a)),
        );
      }}
      onDismiss={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
    />
  );
}

function AccountMenu() {
  // Subscribe to authStore so initials/name/email update on login, logout,
  // profile changes, or tenant switch (all of which fire `change`).
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => authStore.emitter.on("change", () => rerender()), []);
  const user = authStore.user;
  const initials = user
    ? user.name
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 h-8 px-1 rounded-md hover:bg-surface-2 transition-colors"
          aria-label="Account"
        >
          <div className="w-6 h-6 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-medium">
            {initials}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="text-sm font-medium text-text-primary">
            {user?.name ?? "Guest"}
          </div>
          <div className="text-xs text-text-muted font-normal normal-case tracking-normal">
            {user?.email}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => (window.location.hash = "/profile")}>
          <User className="h-4 w-4" /> Profile
          <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => (window.location.hash = "/settings")}>
          <Settings className="h-4 w-4" /> Settings
          <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          intent="danger"
          onSelect={() => {
            void logout();
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
