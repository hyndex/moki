/** Additional edge cases for the key matcher introduced when hardening
 *  the archetype keyboard layer (e.g. `?` matching Shift-/, alt/option
 *  parity, and editable detection on opt-out elements). */

import { describe, test, expect } from "bun:test";
import { comboMatches, isEditableTarget } from "../hooks/_keyMatcher";

const blank = { key: "", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe("comboMatches edge cases", () => {
  test("alt and option are aliases", () => {
    expect(comboMatches("alt+a", { ...blank, key: "a", altKey: true })).toBe(true);
    expect(comboMatches("option+a", { ...blank, key: "a", altKey: true })).toBe(true);
  });

  test("meta and cmd are aliases on mac", () => {
    expect(comboMatches("meta+s", { ...blank, key: "s", metaKey: true }, { mac: true })).toBe(true);
    expect(comboMatches("cmd+s", { ...blank, key: "s", metaKey: true }, { mac: true })).toBe(true);
  });

  test("requires explicit shift unless key is `?`", () => {
    // Explicit `shift+/` must include shift
    expect(comboMatches("shift+/", { ...blank, key: "/", shiftKey: true })).toBe(true);
    expect(comboMatches("shift+/", { ...blank, key: "/" })).toBe(false);
    // Bare `/` does not match Shift-?.
    expect(comboMatches("/", { ...blank, key: "/", shiftKey: true })).toBe(false);
    expect(comboMatches("/", { ...blank, key: "/" })).toBe(true);
  });

  test("Space normalisation", () => {
    expect(comboMatches(" ", { ...blank, key: " " })).toBe(true);
    expect(comboMatches(" ", { ...blank, key: "Space" })).toBe(true);
  });

  test("modifier-only mismatch returns false", () => {
    // Want cmd+s; got cmd+x.
    expect(comboMatches("cmd+s", { ...blank, key: "x", metaKey: true }, { mac: true })).toBe(false);
  });

  test("ctrl is independent of cmd on mac", () => {
    expect(comboMatches("ctrl+c", { ...blank, key: "c", ctrlKey: true }, { mac: true })).toBe(true);
    expect(comboMatches("ctrl+c", { ...blank, key: "c", metaKey: true }, { mac: true })).toBe(false);
  });
});

describe("isEditableTarget", () => {
  test("returns false for plain DIV", () => {
    expect(isEditableTarget({ tagName: "DIV" })).toBe(false);
  });

  test("returns true for INPUT / TEXTAREA / SELECT", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isEditableTarget({ tagName: "SELECT" })).toBe(true);
  });

  test("returns true for [contenteditable]", () => {
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  test("returns false for null / undefined / empty objects", () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
    expect(isEditableTarget({} as unknown)).toBe(false);
  });
});
