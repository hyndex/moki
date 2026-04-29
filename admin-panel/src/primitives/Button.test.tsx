/** Regression tests for the Button primitive's default `type` attribute.
 *
 *  Background: HTML's <button> element defaults to type="submit" when
 *  nested inside a <form>. The historical implementation forwarded
 *  `...props` without a default, so every styled action button (e.g.
 *  "New", "Filter", row kebabs) inside a form silently submitted the
 *  form when clicked. Real impact: rule dialogs, custom-field forms,
 *  workflow editors all triggered unintended saves.
 *
 *  These tests lock in the fix:
 *    - Outside a form: default to type="button"
 *    - Inside a form: still type="button" (don't submit)
 *    - Caller can opt into type="submit" explicitly
 *    - asChild mode (Slot) doesn't force the type — keeps caller
 *      ergonomics for non-button consumers (links etc.) */

import { describe, test, expect } from "bun:test";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { Button } from "./Button";

describe("Button default type", () => {
  test("defaults to type='button' outside a form", () => {
    const html = renderToString(<Button>Click me</Button>);
    expect(html).toContain('type="button"');
  });

  test("still type='button' inside a form (does not submit by default)", () => {
    const html = renderToString(
      <form><Button>Action</Button></form>,
    );
    // The button inside the form must NOT be type="submit".
    expect(html).toContain('type="button"');
    expect(html).not.toContain('type="submit"');
  });

  test("explicit type='submit' wins over the default", () => {
    const html = renderToString(<Button type="submit">Save</Button>);
    expect(html).toContain('type="submit"');
  });

  test("explicit type='reset' wins over the default", () => {
    const html = renderToString(<Button type="reset">Reset</Button>);
    expect(html).toContain('type="reset"');
  });

  // asChild path renders via Radix Slot which has its own children-
  // shape requirements (single React element). We don't exercise that
  // here — the Button source comments document the asChild branch
  // skipping the default type so non-button consumers (e.g. <a>)
  // don't get invalid markup.
});
