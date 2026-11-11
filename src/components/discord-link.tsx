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
type Notice = { tone: "success" | "error"; text: string };

/**
 * After Discord sends the member back, the page carries `discord=terhubung`, or `discord=gagal` with Better Auth's
 * `error`. Read once into a notice, then taken out of the address so a reload doesn't repeat it.
 */
function useReturnNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("discord");
    if (!status) return;
    const next: Notice = status === "terhubung"
      ? { tone: "success", text: "Discord terhubung. Kami sedang menambahkanmu ke server GDGoC IPB." }
      : { tone: "error", text: discordLinkError(url.searchParams.get("error")) };
    for (const key of ["discord", "error", "error_description"]) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    requestAnimationFrame(() => setNotice(next));
  }, []);
  return [notice, setNotice] as const;
}

/** The member's Discord link and what they can do with it, shared by Profil (dashboard/discord-panel.tsx) and onboarding (#242). */
export function useDiscord() {
  const state = useQuery(api.discord.mine);
  const unlink = useMutation(api.discord.unlink);
  const retry = useMutation(api.discord.retryJoin);
  const [notice, setNotice] = useReturnNotice();
  const [busy, setBusy] = useState<"connect" | "unlink" | "retry" | null>(null);
  const [error, setError] = useState("");

  async function connect() {
    setBusy("connect"); setError(""); setNotice(null);
    try {
      // Better Auth answers with Discord's consent page and the browser leaves; it comes back with `discord=…`.
      const result = await authClient.linkSocial({ provider: "discord", ...discordReturnUrls(`${window.location.pathname}${window.location.search}`) });
      if (result.error) { setError(result.error.message || "Discord belum bisa dihubungkan. Coba lagi."); setBusy(null); }
    } catch { setError("Belum bisa membuka Discord. Periksa koneksi, lalu coba lagi."); setBusy(null); }
  }
  async function run(kind: "unlink" | "retry", done: string) {
    setBusy(kind); setError(""); setNotice(null);
    try { await (kind === "unlink" ? unlink({}) : retry({})); setNotice({ tone: "success", text: done }); return true; }
    catch (cause) { setError(readableError(cause)); return false; }
    finally { setBusy(null); }
  }
  return { state, notice, error, busy, connect, unlink: () => run("unlink", "Discord diputus. Kamu tetap di server sampai keluar sendiri."), retry: () => run("retry", "Kami mencoba lagi menambahkanmu ke server.") };
}

/** One line on the server join: done, under way (with Discord's wait if any), or why not. */
export function joinLine(link: DiscordLink) {
  if (link.joinStatus === "joined") return "Kamu sudah di server GDGoC IPB.";
  if (link.joinStatus === "pending") return link.lastError ?? "Sedang menambahkanmu ke server GDGoC IPB…";
  return link.lastError ?? "Belum bisa masuk ke server.";
}

/** The return notice or an error, styled by each page (`.discord-notice`); an error wins. */
export function Feedback({ notice, error }: { notice: Notice | null; error: string }) {
  const shown: Notice | null = error ? { tone: "error", text: error } : notice;
  return shown && <p className="discord-notice" data-tone={shown.tone} role={shown.tone === "error" ? "alert" : "status"}>{shown.text}</p>;
}

export const serverLink = (url: string, className: string) => <a className={className} href={url} target="_blank" rel="noopener noreferrer">Buka server <Arrow external size={18} /><span className="sr-only"> (buka tab baru)</span></a>;

/** The Discord card on onboarding's community screen, as weighty as WhatsApp's beside it. Skipping it is fine. */
export function DiscordOnboardingCard() {
  const { state, notice, error, busy, connect } = useDiscord();
  const link = state?.link ?? null;
  return <div className="onboard-invitation onboard-discord">
    <div className="onboard-invite-icon discord-icon" aria-hidden="true"><PixelIcon name="discord" size={24} /></div>
    <div><strong>Server Discord GDGoC IPB</strong><p>Ngobrol, kanal belajar, dan kanal khusus member. Hubungkan akunmu supaya kamu langsung masuk ke server.</p></div>
    {link ? <p className="onboard-discord-linked" role="status"><PixelIcon name="check" size={18} /><span>Terhubung sebagai <b>{link.username ?? "akun Discord-mu"}</b>. {joinLine(link)}</span></p>
      : state && !state.configured ? <p className="onboard-external-note">Server Discord sedang disiapkan. Kamu bisa menghubungkannya nanti dari Profil.</p>
      : <button type="button" className="button onboard-external" disabled={state === undefined || busy !== null} onClick={() => void connect()}>{busy === "connect" ? "Membuka Discord…" : "Hubungkan Discord"} <Arrow /></button>}
    {link?.joinStatus === "joined" && state?.serverUrl && serverLink(state.serverUrl, "text-link onboard-discord-server")}
    {/* Linked shows above, so only a failure needs saying here. */}
    <Feedback notice={notice?.tone === "error" ? notice : null} error={error} />
    {!link && state?.configured && <p className="onboard-external-note">Kamu ke Discord sebentar, lalu kembali ke langkah ini. Bisa juga nanti dari Profil.</p>}
  </div>;
}
