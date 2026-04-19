export const packageId = "form" as const;
export const packageDisplayName = "Form" as const;
export const packageDescription = "Canonical form wrapper with field access, autosave, and relation helpers." as const;

export * from "@platform/ui-form";

export type PermissionAwareFieldRule = {
  field: string;
  permission: string;
  whenDenied?: "hidden" | "readonly" | "masked";
};

export type PermissionAwareFieldState = {
  hidden: boolean;
  readonly: boolean;
  masked: boolean;
};

export type AutosaveController<TValue> = {
  schedule(value: TValue): void;
  flush(): Promise<void>;
  cancel(): void;
};

export function resolveFieldAccess(input: {
  field: string;
  rules: PermissionAwareFieldRule[];
  grantedPermissions: string[];
}): PermissionAwareFieldState {
  const granted = new Set(input.grantedPermissions);
  const matchingRules = input.rules.filter((rule) => rule.field === input.field);
  const deniedRules = matchingRules.filter((rule) => !granted.has(rule.permission));

  return {
    hidden: deniedRules.some((rule) => (rule.whenDenied ?? "hidden") === "hidden"),
    readonly: deniedRules.some((rule) => rule.whenDenied === "readonly"),
    masked: deniedRules.some((rule) => rule.whenDenied === "masked")
  };
}

export function createAutosaveController<TValue>(input: {
  delayMs?: number | undefined;
  onSave: (value: TValue) => Promise<void> | void;
}): AutosaveController<TValue> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let latestValue: TValue | undefined;

  async function runSave(): Promise<void> {
    if (latestValue === undefined) {
      return;
    }
    const pendingValue = latestValue;
    latestValue = undefined;
    await input.onSave(pendingValue);
  }

  return {
    schedule(value) {
      latestValue = value;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        void runSave();
      }, input.delayMs ?? 250);
    },
    async flush() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      await runSave();
    },
    cancel() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      latestValue = undefined;
    }
  };
}
