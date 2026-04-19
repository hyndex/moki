export type ValidationIssue = {
  code: string;
  message: string;
  path: string;
  packageId?: string | undefined;
};

export class PlatformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends PlatformError {
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.issues = issues;
  }
}

export class ConflictError extends PlatformError {}

export class PluginActivationError extends PlatformError {
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.issues = issues;
  }
}
