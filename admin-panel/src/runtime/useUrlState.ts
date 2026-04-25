/** URL query-param state hooks.
 *
 *  Promotes filter/sort/saved-view selections from React state into
 *  the URL hash query string so a user can copy-paste a URL and
 *  share a fully-reproducible view. Same approach Twenty / Linear /
 *  GitHub use.
 *
 *  We use the HASH part of the URL (after `#`) for these params
 *  because the rest of the shell already routes via hash (`#/contacts`
 *  rather than `/contacts`). A URL like
 *      http://host/#/contacts?view=qualified-eu&q=acme
 *  is what a user pastes into Slack.
 *
 *  Read: parses location.hash → params object, subscribes to
 *  `hashchange` so back/forward + manual edits both flow through.
 *  Write: merges new params into the hash + pushes to history. */
import { useEffect, useMemo, useState, useCallback } from "react";

interface HashParts {
  path: string;
  params: URLSearchParams;
}

function parseHash(): HashParts {
  if (typeof window === "undefined") return { path: "/", params: new URLSearchParams() };
  // location.hash starts with `#` (or empty). Strip the `#` then split
  // on `?` to separate path from query.
  let hash = window.location.hash || "#/";
  if (hash.startsWith("#")) hash = hash.slice(1);
  const qIdx = hash.indexOf("?");
  if (qIdx === -1) return { path: hash || "/", params: new URLSearchParams() };
  return {
    path: hash.slice(0, qIdx) || "/",
    params: new URLSearchParams(hash.slice(qIdx + 1)),
  };
}

function buildHash(parts: HashParts): string {
  const qs = parts.params.toString();
  return qs ? `#${parts.path}?${qs}` : `#${parts.path}`;
}

/** Subscribe to all hash params as a Map. Updating the URL preserves
 *  the path part. Returns `[params, setParams]`. */
export function useUrlParams(): [URLSearchParams, (next: URLSearchParams) => void] {
  const [, force] = useState(0);
  useEffect(() => {
    const handler = () => force((n) => n + 1);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const parts = useMemo(parseHash, []);
  const params = useMemo(() => parseHash().params, []);
  void parts;

  const setParams = useCallback((next: URLSearchParams) => {
    const cur = parseHash();
    const merged = buildHash({ path: cur.path, params: next });
    if (window.location.hash !== merged) {
      // pushState avoids touching the page; the hashchange event still
      // fires for in-app subscribers.
      window.history.replaceState(null, "", merged);
      // Some browsers (Firefox) don't dispatch hashchange when only
      // the query part changes via replaceState. Dispatch manually.
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }, []);

  return [params, setParams];
}

/** Read a single string param. */
export function useUrlParam(key: string): [string | null, (value: string | null) => void] {
  const [params, setParams] = useUrlParams();
  const value = params.get(key);
  const setValue = useCallback(
    (next: string | null) => {
      const ps = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
      if (next === null || next === "") ps.delete(key);
      else ps.set(key, next);
      setParams(ps);
    },
    [key, setParams],
  );
  return [value, setValue];
}

/** Read a JSON-encoded param (filter tree, sort spec, etc.). Returns
 *  `[parsed, setParsed]`. The serialized form is `JSON.stringify` →
 *  `encodeURIComponent`-handled by URLSearchParams. */
export function useUrlJsonParam<T>(key: string): [T | null, (value: T | null) => void] {
  const [raw, setRaw] = useUrlParam(key);
  const parsed = useMemo<T | null>(() => {
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }, [raw]);
  const setParsed = useCallback(
    (next: T | null) => {
      if (next === null || next === undefined) setRaw(null);
      else setRaw(JSON.stringify(next));
    },
    [setRaw],
  );
  return [parsed, setParsed];
}

/** Get current path without query — useful for deep-linking back. */
export function getCurrentRoutePath(): string {
  return parseHash().path;
}

/** Build a shareable URL for a given path + params. Always uses the
 *  current origin. */
export function buildShareableUrl(path: string, params: Record<string, unknown>): string {
  const ps = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") ps.set(k, v);
    else if (typeof v === "number" || typeof v === "boolean") ps.set(k, String(v));
    else ps.set(k, JSON.stringify(v));
  }
  const qs = ps.toString();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/${qs ? `#${path}?${qs}` : `#${path}`}`;
}
