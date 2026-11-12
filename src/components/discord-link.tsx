"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { readableError } from "@/lib/draft-session";
import { discordLinkError, discordReturnUrls } from "@/lib/discord";
import { Arrow } from "./icons";
import { PixelIcon } from "./pixel-icons";

export type DiscordLink = NonNullable<NonNullable<FunctionReturnType<typeof api.discord.mine>>["link"]>;
/** A notice to show. `live` marks one built from the join status, which Profil shows in place of the "Server" row's line. */
export type Notice = { tone: "success" | "error"; text: string; live?: boolean };
/** What the member just did: connected Discord or pressed "Coba lagi", told from the join status as it changes; or fixed words. */
type Moment = { after: "linked" | "retried" } | Notice;

/**
 * The notice after connecting Discord or pressing "Coba lagi", built from the join status as `discord.mine` reports it
 * now, so it moves on with the panel below: being added, already in the server (also for someone who was there before
 * linking), or not yet, with the reason (#261).
 */
export function joinNotice(after: "linked" | "retried", link: DiscordLink): Notice {
  const linked = after === "linked";
  if (link.joinStatus === "failed") {
    const lead = linked ? "Discord terhubung, tapi kamu belum masuk server GDGoC IPB." : "Kamu masih belum masuk server GDGoC IPB.";
    return { tone: "error", live: true, text: link.lastError ? `${lead} ${link.lastError}` : lead };
  }
  const join = link.joinStatus === "joined" ? "Kamu sudah di server GDGoC IPB."
    : link.lastError ?? (linked ? "Kami sedang menambahkanmu ke server GDGoC IPB." : "Kami mencoba lagi menambahkanmu ke server GDGoC IPB.");
  return { tone: "success", live: true, text: linked ? `Discord terhubung. ${join}` : join };
}

/**
 * After Discord sends the member back, the page carries `discord=terhubung`, or `discord=gagal` with Better Auth's
 * `error`. Read once, then taken out of the address so a reload doesn't repeat it.
 */
function useReturnMoment() {
  const [moment, setMoment] = useState<Moment | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("discord");
    if (!status) return;
    const next: Moment = status === "terhubung" ? { after: "linked" } : { tone: "error", text: discordLinkError(url.searchParams.get("error")) };
    for (const key of ["discord", "error", "error_description"]) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    requestAnimationFrame(() => setMoment(next));
  }, []);
  return [moment, setMoment] as const;
}

/** The member's Discord link and what they can do with it, shared by Profil (dashboard/discord-panel.tsx) and onboarding (#242). */
export function useDiscord() {
  const state = useQuery(api.discord.mine);
  const unlink = useMutation(api.discord.unlink);
  const retry = useMutation(api.discord.retryJoin);
  const [moment, setMoment] = useReturnMoment();
  const [busy, setBusy] = useState<"connect" | "unlink" | "retry" | null>(null);
  const [error, setError] = useState("");

  async function connect() {
    setBusy("connect"); setError(""); setMoment(null);
    try {
      // Better Auth answers with Discord's consent page and the browser leaves; it comes back with `discord=…`.
      const result = await authClient.linkSocial({ provider: "discord", ...discordReturnUrls(`${window.location.pathname}${window.location.search}`) });
      if (result.error) { setError(result.error.message || "Discord belum bisa dihubungkan. Coba lagi."); setBusy(null); }
    } catch { setError("Belum bisa membuka Discord. Periksa koneksi, lalu coba lagi."); setBusy(null); }
  }
  async function run(kind: "unlink" | "retry", done: Moment) {
    setBusy(kind); setError(""); setMoment(null);
    // Convex shows the mutation's write in `state` before this resolves, so "Coba lagi" never reads the old failure.
    try { await (kind === "unlink" ? unlink({}) : retry({})); setMoment(done); return true; }
    catch (cause) { setError(readableError(cause)); return false; }
    finally { setBusy(null); }
  }
  const notice: Notice | null = !moment ? null : "after" in moment ? (state?.link ? joinNotice(moment.after, state.link) : null) : moment;
  return {
    state, notice, error, busy, connect,
    unlink: () => run("unlink", { tone: "success", text: "Discord diputus. Kamu tetap di server sampai keluar sendiri." }),
    retry: () => run("retry", { after: "retried" }),
  };
}

/** One line on the server join: done, under way (with Discord's wait if any), or why not. */
export function joinLine(link: DiscordLink) {
  if (link.joinStatus === "joined") return "Kamu sudah di server GDGoC IPB.";
  if (link.joinStatus === "pending") return link.lastError ?? "Sedang menambahkanmu ke server GDGoC IPB…";
  return link.lastError ?? "Belum bisa masuk ke server.";
}

/**
 * The notice or an error, styled by each page (`.discord-notice`); an error wins. Keyed by tone, so a join that fails
 * while the page is open arrives as a new alert rather than a status that changed its role.
 */
export function Feedback({ notice, error }: { notice: Notice | null; error: string }) {
  const shown: Notice | null = error ? { tone: "error", text: error } : notice;
  return shown && <p key={shown.tone} className="discord-notice" data-tone={shown.tone} role={shown.tone === "error" ? "alert" : "status"}>{shown.text}</p>;
}

export const serverLink = (url: string, className: string) => <a className={className} href={url} target="_blank" rel="noopener noreferrer">Buka server <Arrow external size={18} /><span className="sr-only"> (buka tab baru)</span></a>;

/**
 * The Discord card on onboarding's community screen, as weighty as WhatsApp's beside it. Skipping it is fine. Its
 * "Terhubung sebagai" line follows the join status the way Profil's notice does, with the same "Coba lagi" (#261).
 */
export function DiscordOnboardingCard() {
  const { state, notice, error, busy, connect, retry } = useDiscord();
  const link = state?.link ?? null;
  return <div className="onboard-invitation onboard-discord">
    <div className="onboard-invite-icon discord-icon" aria-hidden="true"><PixelIcon name="discord" size={24} /></div>
    <div><strong>Server Discord GDGoC IPB</strong><p>Ngobrol, kanal belajar, dan kanal khusus member.{!link && " Hubungkan akunmu supaya kamu langsung masuk ke server."}</p></div>
    {link ? <p className="onboard-discord-linked" data-status={link.joinStatus} role="status"><PixelIcon name="check" size={18} /><span>Terhubung sebagai <b>{link.username ?? "akun Discord-mu"}</b>. {joinLine(link)}</span></p>
      : state && !state.configured ? <p className="onboard-external-note">Server Discord sedang disiapkan. Kamu bisa menghubungkannya nanti dari Profil.</p>
      : <button type="button" className="button onboard-external" disabled={state === undefined || busy !== null} onClick={() => void connect()}>{busy === "connect" ? "Membuka Discord…" : "Hubungkan Discord"} <Arrow /></button>}
    {link?.joinStatus === "failed" && <button type="button" className="button onboard-external" disabled={busy !== null} onClick={() => void retry()}>{busy === "retry" ? "Mencoba…" : "Coba lagi"} <Arrow /></button>}
    {link?.joinStatus === "joined" && state?.serverUrl && serverLink(state.serverUrl, "text-link onboard-discord-server")}
    {/* The line above already says how the join stands, so only an error of its own needs saying here. */}
    <Feedback notice={notice?.tone === "error" && !notice.live ? notice : null} error={error} />
    {!link && state?.configured && <p className="onboard-external-note">Kamu ke Discord sebentar, lalu kembali ke langkah ini. Bisa juga nanti dari Profil.</p>}
  </div>;
}
