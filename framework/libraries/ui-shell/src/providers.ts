import React from "react";

import { createNavigationContract } from "./navigation";
import { createShellAuditHook, createShellTelemetryHook } from "./telemetry";
import type {
  CommandEnvelope,
  DesignTokens,
  NotificationEnvelope,
  PermissionIntrospector,
  SessionSnapshot,
  ShellEventBus,
  ShellProviderContract,
  UiRegistry
} from "./types";

export function createPermissionIntrospector(grantedPermissions: string[]): PermissionIntrospector {
  const granted = [...new Set(grantedPermissions)].sort((left, right) => left.localeCompare(right));
  return {
    granted,
    has(permission) {
      return granted.includes(permission);
    },
    hasEvery(permissions) {
      return permissions.every((permission) => granted.includes(permission));
    },
    hasSome(permissions) {
      return permissions.some((permission) => granted.includes(permission));
    }
  };
}

export function createShellEventBus<TEvent>(): ShellEventBus<TEvent> {
  const listeners = new Set<(event: TEvent) => void>();
  return {
    publish(event) {
      for (const listener of listeners) {
        listener(event);
      }
      return event;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

export function createShellProviders(input: {
  registry: UiRegistry;
  session: SessionSnapshot;
  grantedPermissions: string[];
  designTokens?: DesignTokens | undefined;
  commandBus?: ShellEventBus<CommandEnvelope> | undefined;
  notificationBus?: ShellEventBus<NotificationEnvelope> | undefined;
}): ShellProviderContract {
  const permissions = createPermissionIntrospector(input.grantedPermissions);
  const audit = createShellAuditHook();
  const telemetry = createShellTelemetryHook();

  return {
    session: input.session,
    permissions,
    designTokens: {
      ...input.designTokens
    },
    navigation: createNavigationContract(input.registry, permissions),
    audit,
    telemetry,
    commandBus: input.commandBus ?? createShellEventBus<CommandEnvelope>(),
    notificationBus: input.notificationBus ?? createShellEventBus<NotificationEnvelope>()
  };
}

const ShellProviderContext = React.createContext<ShellProviderContract | null>(null);

export function ShellProvider(props: {
  value: ShellProviderContract;
  children?: React.ReactNode;
}) {
  return React.createElement(ShellProviderContext.Provider, { value: props.value }, props.children);
}

export function useShellProviders(): ShellProviderContract {
  const value = React.useContext(ShellProviderContext);
  if (!value) {
    throw new Error("ShellProvider is missing from the React tree");
  }
  return value;
}

export function usePermission(permission: string): boolean {
  return useShellProviders().permissions.has(permission);
}
