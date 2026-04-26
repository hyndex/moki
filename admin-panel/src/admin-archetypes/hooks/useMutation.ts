import * as React from "react";
import { invalidateSwr } from "./useSwr";

/** A typed mutation hook with:
 *    - in-flight tracking (`isPending`)
 *    - last-result error / success surfacing
 *    - optimistic-update helper that rolls back on failure
 *    - automatic SWR invalidation on success
 *    - duplicate-call guard (the latest call wins; older results are
 *      discarded so stale responses can't overwrite fresh state).
 *
 *  Returns `{ mutate, isPending, error, lastResult, reset }`. */

export interface MutationOptions<Input, Output> {
  /** Comma-separated SWR keys / prefixes to invalidate after success.
   *  Each entry is treated as a prefix match. */
  invalidate?: readonly string[] | ((output: Output, input: Input) => readonly string[]);
  /** Called on success. Use for routing, toast, telemetry. */
  onSuccess?: (output: Output, input: Input) => void | Promise<void>;
  /** Called on error. Receives the error and the input that produced it. */
  onError?: (error: unknown, input: Input) => void | Promise<void>;
  /** Called regardless of outcome — useful for releasing UI locks. */
  onSettled?: (
    output: Output | undefined,
    error: unknown,
    input: Input,
  ) => void | Promise<void>;
}

export interface MutationResult<Input, Output> {
  /** Run the mutation. Returns the output (or undefined on failure). */
  mutate: (input: Input) => Promise<Output | undefined>;
  isPending: boolean;
  error: unknown;
  lastResult: Output | undefined;
  /** Reset all state to idle. */
  reset: () => void;
}

export function useMutation<Input, Output>(
  fn: (input: Input, signal: AbortSignal) => Promise<Output>,
  options: MutationOptions<Input, Output> = {},
): MutationResult<Input, Output> {
  const fnRef = React.useRef(fn);
  fnRef.current = fn;
  const optsRef = React.useRef(options);
  optsRef.current = options;

  const [, force] = React.useReducer((n: number) => n + 1, 0);
  const isMountedRef = React.useRef(true);
  const callIdRef = React.useRef(0);
  const stateRef = React.useRef<{
    isPending: boolean;
    error: unknown;
    lastResult: Output | undefined;
  }>({ isPending: false, error: undefined, lastResult: undefined });

  React.useEffect(() => () => { isMountedRef.current = false; }, []);

  const mutate = React.useCallback(
    async (input: Input): Promise<Output | undefined> => {
      const controller = new AbortController();
      const callId = ++callIdRef.current;
      stateRef.current = { isPending: true, error: undefined, lastResult: stateRef.current.lastResult };
      if (isMountedRef.current) force();

      try {
        const output = await fnRef.current(input, controller.signal);
        // Drop the result if a newer call has already started.
        if (callId !== callIdRef.current) return undefined;

        stateRef.current = { isPending: false, error: undefined, lastResult: output };
        const opts = optsRef.current;
        const keys =
          typeof opts.invalidate === "function"
            ? opts.invalidate(output, input)
            : opts.invalidate ?? [];
        for (const k of keys) invalidateSwr(k);
        try {
          await opts.onSuccess?.(output, input);
        } catch {
          /* user handler must never break mutation */
        }
        try {
          await opts.onSettled?.(output, undefined, input);
        } catch {/* ignore */}
        if (isMountedRef.current) force();
        return output;
      } catch (err) {
        if (callId !== callIdRef.current) return undefined;
        stateRef.current = { isPending: false, error: err, lastResult: stateRef.current.lastResult };
        try {
          await optsRef.current.onError?.(err, input);
        } catch {/* ignore */}
        try {
          await optsRef.current.onSettled?.(undefined, err, input);
        } catch {/* ignore */}
        if (isMountedRef.current) force();
        return undefined;
      }
    },
    [],
  );

  const reset = React.useCallback(() => {
    callIdRef.current += 1;
    stateRef.current = { isPending: false, error: undefined, lastResult: undefined };
    if (isMountedRef.current) force();
  }, []);

  return {
    mutate,
    isPending: stateRef.current.isPending,
    error: stateRef.current.error,
    lastResult: stateRef.current.lastResult,
    reset,
  };
}

/** Optimistic mutation helper. Wrap any mutation with optimistic state
 *  that is rolled back if the mutation fails.
 *
 *  Returns `[optimisticValue, runOptimistic]`. The optimistic value
 *  reflects the in-flight state until the mutation settles. */
export function useOptimistic<State, Input>(
  base: State,
  reducer: (state: State, input: Input) => State,
): readonly [
  State,
  /** Apply an optimistic input. The async fn runs; on success the
   *  optimistic state stays as the function's resolved next state; on
   *  failure it reverts to `base`. */
  (input: Input, fn: () => Promise<State | void>) => Promise<void>,
] {
  const [state, setState] = React.useState<State>(base);

  React.useEffect(() => {
    setState(base);
  }, [base]);

  const run = React.useCallback(
    async (input: Input, fn: () => Promise<State | void>) => {
      // Optimistically apply.
      const next = reducer(state, input);
      setState(next);
      try {
        const settled = await fn();
        if (settled !== undefined && settled !== null) {
          setState(settled);
        }
      } catch {
        setState(base);
      }
    },
    [base, reducer, state],
  );

  return [state, run] as const;
}
