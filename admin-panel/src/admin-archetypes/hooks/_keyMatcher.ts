/** Pure key-combo matcher for `useArchetypeKeyboard`. Extracted to be unit-
 *  testable without React or DOM rendering. */

const isMac =
  typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

export interface KeyEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function comboMatches(
  combo: string,
  e: KeyEventLike,
  options: { mac?: boolean } = {},
): boolean {
  const onMac = options.mac ?? isMac;
  const parts = combo.toLowerCase().split("+").map((p, i, arr) =>
    // Trim non-terminal parts (modifiers); leave the last part raw so a
    // bare " " key combo isn't trimmed to empty string.
    i === arr.length - 1 ? p : p.trim(),
  );
  const rawKey = parts.pop()!;
  const key = rawKey === " " || rawKey.trim() === "" && rawKey.length > 0 ? " " : rawKey.trim();
  const wantCmd = parts.includes("cmd") || parts.includes("meta");
  const wantCtrl = parts.includes("ctrl");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt") || parts.includes("option");

  const cmdActive = onMac ? e.metaKey : e.ctrlKey;
  if (wantCmd !== cmdActive) return false;
  if (wantCtrl && !e.ctrlKey) return false;
  // `?` is special: Shift+/ produces "?" on US keyboards; we accept either
  // form but skip the strict shift check below.
  if (key !== "?" && wantShift !== e.shiftKey) return false;
  if (wantAlt !== e.altKey) return false;

  const k = e.key.toLowerCase();
  if (key === "?") return e.key === "?" || (e.shiftKey && e.key === "/");
  if (key === " ") return e.key === " " || e.key === "Space";
  if (key === "enter") return k === "enter";
  if (key === "esc" || key === "escape") return k === "escape";
  if (key === "up") return k === "arrowup";
  if (key === "down") return k === "arrowdown";
  if (key === "left") return k === "arrowleft";
  if (key === "right") return k === "arrowright";
  return k === key;
}

const editableSelectors = ["INPUT", "TEXTAREA", "SELECT"];

export function isEditableTarget(target: unknown): boolean {
  if (!target) return false;
  const t = target as { tagName?: string; isContentEditable?: boolean };
  if (t.tagName && editableSelectors.includes(t.tagName)) return true;
  if (t.isContentEditable) return true;
  return false;
}
