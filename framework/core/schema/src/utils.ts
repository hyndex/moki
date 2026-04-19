import { z } from "zod";

import { ValidationError } from "@platform/kernel";

export function normalizeActionInput<TInput>(input: TInput): TInput {
  if (input === null || input === undefined) {
    throw new ValidationError("Action input must be defined", [
      { code: "action-input", message: "input cannot be null or undefined", path: "input" }
    ]);
  }

  if (Array.isArray(input)) {
    const normalizedArray: unknown[] = input.map((value): unknown => normalizeActionInput(value as unknown));
    return normalizedArray as TInput;
  }

  if (typeof input !== "object") {
    return input;
  }

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, normalizeActionInput(value)])
  ) as TInput;
}

export function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const jsonSchema: unknown = z.toJSONSchema(schema);
  return jsonSchema as Record<string, unknown>;
}
