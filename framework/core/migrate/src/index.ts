import type { MigrationPackManifest, MigrationPhase } from "@platform/kernel";
import { ValidationError, migrationPhaseValues } from "@platform/kernel";

export const packageId = "migrate" as const;
export const packageDisplayName = "Migrate" as const;
export const packageDescription = "Ordered migration planning and execution support." as const;

export type MigrationExecutionContext = {
  dryRun: boolean;
  packageId: string;
  phase: MigrationPhase;
  logger?: ((message: string) => void) | undefined;
};

export type MigrationStepDefinition = {
  id: string;
  packageId: string;
  phase: MigrationPhase;
  description: string;
  up: (context: MigrationExecutionContext) => Promise<void> | void;
  validate?: (context: MigrationExecutionContext) => Promise<void> | void;
  rollback?: (context: MigrationExecutionContext) => Promise<void> | void;
};

export type MigrationPlanEntry = MigrationStepDefinition & {
  order: number;
};

export type RegisteredMigrationPack = {
  manifest: MigrationPackManifest;
  steps: MigrationStepDefinition[];
};

export type MigrationStepResult = {
  stepId: string;
  packageId: string;
  phase: MigrationPhase;
  status: "planned" | "executed" | "rolled-back" | "failed" | "skipped";
  dryRun: boolean;
  message: string;
};

export type MigrationRunResult = {
  success: boolean;
  results: MigrationStepResult[];
};

export function defineMigrationStep(step: MigrationStepDefinition): MigrationStepDefinition {
  return Object.freeze(step);
}

export function registerMigrationPack(input: RegisteredMigrationPack): RegisteredMigrationPack {
  if (input.manifest.kind !== "migration-pack") {
    throw new ValidationError(`Package '${input.manifest.id}' is not a migration pack`, [
      {
        code: "migration-pack-kind",
        message: "registerMigrationPack expects a migration-pack manifest",
        path: "kind",
        packageId: input.manifest.id
      }
    ]);
  }

  for (const step of input.steps) {
    if (!input.manifest.phases.includes(step.phase)) {
      throw new ValidationError(`Migration step '${step.id}' uses an undeclared phase`, [
        {
          code: "migration-phase",
          message: `phase '${step.phase}' must be declared in the package manifest`,
          path: "phases",
          packageId: input.manifest.id
        }
      ]);
    }
  }

  return Object.freeze({
    manifest: input.manifest,
    steps: [...input.steps].sort(compareMigrationSteps)
  });
}

export function createMigrationPlan(packs: RegisteredMigrationPack[]): MigrationPlanEntry[] {
  return packs
    .flatMap((pack) => pack.steps)
    .sort(compareMigrationSteps)
    .map((step, index) => ({
      ...step,
      order: index + 1
    }));
}

export async function runMigrationPlan(
  plan: MigrationPlanEntry[],
  options: {
    dryRun?: boolean;
    logger?: (message: string) => void;
  } = {}
): Promise<MigrationRunResult> {
  const dryRun = options.dryRun ?? false;
  const results: MigrationStepResult[] = [];
  const completed: MigrationPlanEntry[] = [];

  for (const step of plan) {
    const context: MigrationExecutionContext = {
      dryRun,
      packageId: step.packageId,
      phase: step.phase,
      logger: options.logger
    };

    try {
      await step.validate?.(context);
      if (dryRun) {
        results.push({
          stepId: step.id,
          packageId: step.packageId,
          phase: step.phase,
          status: "planned",
          dryRun: true,
          message: `validated ${step.id}`
        });
        continue;
      }

      await step.up(context);
      completed.push(step);
      results.push({
        stepId: step.id,
        packageId: step.packageId,
        phase: step.phase,
        status: "executed",
        dryRun: false,
        message: `executed ${step.id}`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        stepId: step.id,
        packageId: step.packageId,
        phase: step.phase,
        status: "failed",
        dryRun,
        message
      });

      if (!dryRun) {
        for (const completedStep of [...completed].reverse()) {
          if (!completedStep.rollback) {
            continue;
          }
          await completedStep.rollback({
            dryRun: false,
            packageId: completedStep.packageId,
            phase: completedStep.phase,
            logger: options.logger
          });
          results.push({
            stepId: completedStep.id,
            packageId: completedStep.packageId,
            phase: completedStep.phase,
            status: "rolled-back",
            dryRun: false,
            message: `rolled back ${completedStep.id}`
          });
        }
      }

      return {
        success: false,
        results
      };
    }
  }

  return {
    success: true,
    results
  };
}

export function summarizeMigrationPlan(plan: MigrationPlanEntry[]): string[] {
  return plan.map((entry) => `${entry.order}. [${entry.phase}] ${entry.packageId} :: ${entry.id} - ${entry.description}`);
}

export function createMigrationMetadata(pack: RegisteredMigrationPack): {
  packageId: string;
  sourceSystem: string;
  targetDomains: string[];
  phases: MigrationPhase[];
  stepIds: string[];
} {
  return {
    packageId: pack.manifest.id,
    sourceSystem: pack.manifest.sourceSystem,
    targetDomains: [...pack.manifest.targetDomains],
    phases: [...pack.manifest.phases],
    stepIds: pack.steps.map((step) => step.id)
  };
}

export function createExpandBackfillSwitchContractPlan(packageId: string): MigrationStepDefinition[] {
  return [
    defineMigrationStep({
      id: `${packageId}.expand`,
      packageId,
      phase: "import",
      description: "Expand target schemas and add non-breaking structures.",
      up: () => undefined
    }),
    defineMigrationStep({
      id: `${packageId}.backfill`,
      packageId,
      phase: "delta-sync",
      description: "Backfill data into the expanded shape.",
      up: () => undefined
    }),
    defineMigrationStep({
      id: `${packageId}.switch`,
      packageId,
      phase: "cutover",
      description: "Switch readers and writers to the new shape.",
      up: () => undefined
    }),
    defineMigrationStep({
      id: `${packageId}.contract`,
      packageId,
      phase: "reconcile",
      description: "Contract the legacy structures after validation.",
      up: () => undefined
    })
  ];
}

function compareMigrationSteps(left: MigrationStepDefinition, right: MigrationStepDefinition): number {
  const phaseComparison = migrationPhaseValues.indexOf(left.phase) - migrationPhaseValues.indexOf(right.phase);
  if (phaseComparison !== 0) {
    return phaseComparison;
  }

  const packageComparison = left.packageId.localeCompare(right.packageId);
  if (packageComparison !== 0) {
    return packageComparison;
  }

  return left.id.localeCompare(right.id);
}
