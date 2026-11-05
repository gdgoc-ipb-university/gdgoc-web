"use client";

import { useSyncExternalStore } from "react";
import { PICKED_KEY } from "@/lib/card-print";

// The members staff ticked on the members table, kept for the tab so ticking works across pages and searches.
const listeners = new Set<() => void>();
let pickedCache: { raw: string; ids: string[] } = { raw: "", ids: [] };
function readPicked() {
  let raw = "";
  try { raw = sessionStorage.getItem(PICKED_KEY) ?? ""; } catch { /* storage blocked: nothing is kept */ }
  if (raw !== pickedCache.raw) {
    let ids: string[] = [];
    try { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === "string"); } catch { /* not ours */ }
    pickedCache = { raw, ids };
  }
  return pickedCache.ids;
}
const noIds: string[] = [];
function writePicked(ids: string[]) {
  try { if (ids.length) sessionStorage.setItem(PICKED_KEY, JSON.stringify([...new Set(ids)])); else sessionStorage.removeItem(PICKED_KEY); } catch { /* storage blocked */ }
  for (const listener of listeners) listener();
}
/** The ticked members and a setter; every component that uses it follows the same list. */
export function usePickedMembers() {
  const ids = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, readPicked, () => noIds);
  return [ids, writePicked] as const;
}
