/**
 * Who is signed in, for the public header only. It reads Better Auth's same-origin session endpoint, so the landing
 * page ships no auth client. The answer is kept for a minute so moving between public pages does not flicker, and
 * sign-out clears it.
 */
export type NavViewer = { firstName: string; initial: string };

const FRESH_MS = 60_000;
let cached: { viewer: NavViewer | null; at: number } | null = null;

/** A fresh cached answer: a viewer, null for a guest, or undefined when unknown. */
export function cachedNavViewer(now = Date.now()): NavViewer | null | undefined {
  return cached && now - cached.at < FRESH_MS ? cached.viewer : undefined;
}

export function forgetNavViewer() { cached = null; }

/** First name and initial from the session's user name; a leading lone initial ("M. Rizky") is skipped. */
export function navViewerFrom(data: unknown): NavViewer | null {
  if (!data || typeof data !== "object" || !("user" in data)) return null;
  const user = (data as { user?: { name?: unknown } }).user;
  if (!user) return null;
  const words = typeof user.name === "string" ? user.name.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().split(/\s+/).filter(Boolean) : [];
  const first = words.find((word) => !/^\p{L}\.?$/u.test(word)) ?? words[0] ?? "";
  const firstName = Array.from(first).slice(0, 14).join("") || "Kamu";
  return { firstName, initial: (Array.from(firstName)[0] ?? "?").toLocaleUpperCase("id") };
}

export async function loadNavViewer(signal?: AbortSignal): Promise<NavViewer | null> {
  const response = await fetch("/api/auth/get-session", { credentials: "same-origin", headers: { accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Session check failed: ${response.status}`);
  const viewer = navViewerFrom(await response.json());
  cached = { viewer, at: Date.now() };
  return viewer;
}
