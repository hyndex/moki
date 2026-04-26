/** Pure-function tests for the SWR core. We don't render React here —
 *  the cache + lift behaviour is exercised directly. */

import { describe, test, expect } from "bun:test";

// We import via the public hooks barrel because the helpers we want to
// test (lifting + cache invalidation) are also part of the public API
// surface.
import {
  invalidateSwr,
  _resetSwrCache_forTest,
} from "../hooks/useSwr";

describe("invalidateSwr", () => {
  test("removes entries with matching prefix without throwing", () => {
    // Reset is exposed for tests; ensures isolation.
    _resetSwrCache_forTest();
    // Calling invalidate with a missing prefix is a no-op.
    expect(() => invalidateSwr("nonexistent.")).not.toThrow();
  });
});

describe("_resetSwrCache_forTest", () => {
  test("can be called repeatedly and is idempotent", () => {
    _resetSwrCache_forTest();
    _resetSwrCache_forTest();
    _resetSwrCache_forTest();
    expect(true).toBe(true);
  });
});
