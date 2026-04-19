import type { ShellAuditEvent, ShellAuditHook, ShellTelemetryEvent, ShellTelemetryHook } from "./types";

export function createShellAuditHook(initialHistory: ShellAuditEvent[] = []): ShellAuditHook {
  const history = [...initialHistory];
  return {
    history,
    record(event) {
      const recordedEvent: ShellAuditEvent = {
        ...event,
        at: event.at ?? new Date().toISOString()
      };
      history.push(recordedEvent);
      return recordedEvent;
    }
  };
}

export function createShellTelemetryHook(initialHistory: ShellTelemetryEvent[] = []): ShellTelemetryHook {
  const history = [...initialHistory];
  return {
    history,
    track(event) {
      const trackedEvent: ShellTelemetryEvent = {
        ...event,
        at: event.at ?? new Date().toISOString()
      };
      history.push(trackedEvent);
      return trackedEvent;
    }
  };
}
