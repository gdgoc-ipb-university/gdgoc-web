/**
 * Everything Bogor Run needs from Convex and Better Auth, loaded only once the game is on screen so the landing page's
 * first bundle carries neither client. Nothing here throws for expected outcomes; network failures do reject.
 */
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { packInputs, weekKey, weekStart } from "./leaderboard";
import type { FinishedRun, Ticket } from "./runtime";

export type Period = "week" | "all";
export type Board = FunctionReturnType<typeof api.bogorRun.leaderboard>;
export type Saved = Extract<FunctionReturnType<typeof api.bogorRun.submitRun>, { ok: true }>;
export type SubmitResult = Saved | { ok: false; code: string; message: string };
export type FreshTicket = Ticket & { issuedAt: number; fetchedAt: number };
export type PendingRun = FinishedRun & { endedAt: number };

export const PENDING_KEY = "gdgoc:bogor-run:pending:v1";
/** A guest's run waits this long after game over for the Google sign-in round trip. */
export const PENDING_TTL = 30 * 60_000;
/**
 * A prefetched ticket is used for runs that start within this long of its fetch, and never after its week ends (the
 * server files a run under the week its ticket was issued in). keepTicketFresh renews it before either happens.
 */
export const TICKET_TTL = 10 * 60_000;
const RENEW_EARLY = 30_000;
const RENEW_RETRY = 60_000;
const SESSION_TTL = 60_000;
const WEEK = 7 * 86_400_000;

let client: ConvexHttpClient | null = null;
const convex = () => client ??= new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!, { logger: false });

let auth: { at: number; signedIn: Promise<boolean> } | null = null;

/**
 * Signs the Convex client in when a Better Auth session exists. Rejects when the auth server cannot be reached, and
 * when a signed-in session cannot get its Convex token: that is a connection problem, not a guest.
 */
export function signedIn(fresh = false) {
  if (!fresh && auth && Date.now() - auth.at < SESSION_TTL) return auth.signedIn;
  const signedIn = (async () => {
    const session = await authClient.getSession();
    if (session.error) throw new Error("Session unavailable");
    if (!session.data?.user) { convex().clearAuth(); return false; }
    const token = (await authClient.convex.token({ fetchOptions: { throw: false } })).data?.token;
    if (!token) throw new Error("Convex token unavailable");
    convex().setAuth(token);
    return true;
  })();
  auth = { at: Date.now(), signedIn };
  signedIn.catch(() => { if (auth?.signedIn === signedIn) auth = null; });
  return signedIn;
}

/** A signed seed for the next run, or null when the server cannot rank runs (then the game plays unranked). */
export async function issueRun(): Promise<FreshTicket | null> {
  const ticket = await convex().mutation(api.bogorRun.issueRun, {});
  return ticket && { ...ticket, fetchedAt: Date.now() };
}

// One ticket is kept ready so a run can start on a signed seed without waiting for the network.
let ready: FreshTicket | null = null;
let fetching: Promise<FreshTicket | null> | null = null;
/** How long after its fetch a ticket stays in its week, on the local clock (so client clock skew does not matter). */
const weekLeft = (ticket: FreshTicket) => weekStart(weekKey(ticket.issuedAt)) + WEEK - ticket.issuedAt;
const usableUntil = (ticket: FreshTicket) => ticket.fetchedAt + Math.min(TICKET_TTL, weekLeft(ticket));
// Renewed a little before it ages out, but only once its week is over: a new ticket fetched before then is no better.
const renewAt = (ticket: FreshTicket) => ticket.fetchedAt + Math.min(TICKET_TTL - RENEW_EARLY, weekLeft(ticket) + 1_000);
const fresh = (ticket: FreshTicket | null, now = Date.now()) => ticket && now < usableUntil(ticket) ? ticket : null;

/** Makes sure a fresh ticket is ready (or on its way). Resolves to it, or null offline or when ranking is off. */
export function prefetchTicket(): Promise<FreshTicket | null> {
  if (ready && Date.now() < renewAt(ready)) return Promise.resolve(ready);
  fetching ??= issueRun()
    .then((ticket) => (ready = ticket))
    .catch(() => null)
    .finally(() => { fetching = null; });
  return fetching;
}

/** True while a ticket is on its way; a run that starts without one waits a moment for it (see RunnerOptions). */
export const ticketPending = () => fetching !== null;

/** Hands out the ready ticket once, or null when none is fresh, and starts fetching the next one. */
export function takeTicket(): Ticket | null {
  const ticket = fresh(ready);
  ready = null;
  void prefetchTicket();
  return ticket && { seed: ticket.seed, token: ticket.token };
}

/**
 * Keeps a fresh ticket ready while the game is on the page: renews it before it ages out or its week ends, and as soon
 * as a hidden tab comes back, so a restart after a long run or a long look at the board still starts ranked. Hidden
 * tabs fetch nothing. Returns the function that stops it.
 */
export function keepTicketFresh() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const renew = () => {
    clearTimeout(timer);
    if (stopped || document.hidden) return;
    void prefetchTicket().then((ticket) => {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(renew, ticket ? Math.max(1_000, renewAt(ticket) - Date.now()) : RENEW_RETRY);
    });
  };
  const visibility = () => { if (!document.hidden) renew(); };
  document.addEventListener("visibilitychange", visibility);
  renew();
  return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); };
}

export async function submitRun(run: FinishedRun): Promise<SubmitResult> {
  if (!run.token) return { ok: false, code: "INVALID", message: "Putaran ini tidak punya tiket papan skor." };
  if (!await signedIn(true)) return { ok: false, code: "UNAUTHENTICATED", message: "Masuk dengan akun Google untuk menyimpan skor." };
  // Always packed: shorter than the JSON array and never over Convex's 8192-element argument limit.
  return convex().mutation(api.bogorRun.submitRun, { token: run.token, inputs: packInputs(run.inputs), endTick: run.endTick, score: run.score });
}

export async function leaderboard(period: Period): Promise<Board> {
  await signedIn().catch(() => false); // guests and an unreachable auth server still see the public board
  // Pass the week explicitly: a query's default week would not roll over on Monday while the page stays open.
  return convex().query(api.bogorRun.leaderboard, period === "week" ? { period, week: weekKey(Date.now()) } : { period });
}

/** Keeps the run for the round trip through Google, then leaves the page. Resolves only when sign-in fails to start. */
export async function signInToSave(run: FinishedRun, endedAt = Date.now()): Promise<{ error: string }> {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...run, endedAt } satisfies PendingRun)); }
  catch { return { error: "Browser ini tidak mengizinkan penyimpanan sementara, jadi skornya tidak bisa dibawa ke halaman login." }; }
  try {
    const result = await authClient.signIn.social({ provider: "google", callbackURL: "/?skor=simpan#join", errorCallbackURL: "/?skor=gagal#join" });
    if (!result.error) return new Promise(() => { /* the browser is leaving for Google */ });
  } catch { /* reported below */ }
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* nothing to clean */ }
  return { error: "Belum bisa membuka Google login. Periksa koneksi, lalu coba lagi." };
}

const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/** The run a guest left to sign in, once: it is removed as it is read, and ignored after PENDING_TTL. */
export function takePendingRun(now = Date.now()): PendingRun | null {
  let raw: string | null = null;
  try { raw = sessionStorage.getItem(PENDING_KEY); sessionStorage.removeItem(PENDING_KEY); } catch { return null; }
  try {
    const run = JSON.parse(raw ?? "null") as Partial<PendingRun> | null;
    if (!run || !isCount(run.seed) || !isCount(run.endTick) || !isCount(run.score) || !isCount(run.endedAt)) return null;
    if (typeof run.token !== "string" || !Array.isArray(run.inputs) || !run.inputs.every(isCount)) return null;
    if (now - run.endedAt > PENDING_TTL || run.endedAt > now + 60_000) return null;
    return { seed: run.seed, token: run.token, inputs: run.inputs, endTick: run.endTick, score: run.score, endedAt: run.endedAt };
  } catch { return null; }
}
