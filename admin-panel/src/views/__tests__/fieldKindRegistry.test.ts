/** Pure-function tests for the field-kind registry contract. The
 *  registry is consulted by every field render; a regression here
 *  silently breaks every page that uses an advanced kind. */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  registerFieldKind,
  getFieldKindRenderer,
  registeredFieldKinds,
  _resetFieldKindRegistry_forTest,
} from "../fieldKindRegistry";

describe("fieldKindRegistry", () => {
  beforeEach(() => {
    _resetFieldKindRegistry_forTest();
  });

  test("starts empty", () => {
    expect(registeredFieldKinds()).toEqual([]);
    expect(getFieldKindRenderer("anything")).toBeUndefined();
  });

  test("register + lookup roundtrip", () => {
    const renderer = { Form: undefined, ListCell: undefined, Detail: undefined };
    registerFieldKind("color", renderer);
    expect(getFieldKindRenderer("color")).toBe(renderer);
    expect(registeredFieldKinds()).toEqual(["color"]);
  });

  test("re-registering replaces the previous renderer", () => {
    const a = { Form: undefined };
    const b = { Form: undefined };
    registerFieldKind("color", a);
    registerFieldKind("color", b);
    expect(getFieldKindRenderer("color")).toBe(b);
    expect(registeredFieldKinds()).toEqual(["color"]);
  });

  test("supports plugin-prefixed custom kinds", () => {
    const renderer = { Form: undefined };
    registerFieldKind("acme.search", renderer);
    expect(getFieldKindRenderer("acme.search")).toBe(renderer);
  });
});
