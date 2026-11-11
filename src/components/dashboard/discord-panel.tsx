"use client";

import { useState } from "react";
import { discordJoinLabels, discordLinkedDate } from "@/lib/discord";
import { Feedback, joinLine, serverLink, useDiscord } from "../discord-link";
import { PixelIcon } from "../pixel-icons";
import { ConfirmDialog } from "./data-table";

/** "Discord" on Profil, next to the photo: connect, or the linked account with its join status, "Buka server" and "Putuskan". */
export function DiscordPanel() {
  const { state, notice, error, busy, connect, unlink, retry } = useDiscord();
  const [confirm, setConfirm] = useState(false);
  const link = state?.link ?? null;
  return <section className="app-panel dash-discord-panel" aria-labelledby="profile-discord" aria-busy={state === undefined}>
    <h2 id="profile-discord"><span className="dash-discord-mark" aria-hidden="true"><PixelIcon name="discord" size={22} /></span>Discord</h2>
    <p>Server Discord GDGoC IPB dipakai bersama grup WhatsApp: ngobrol, kabar kegiatan, dan kanal khusus member. Hubungkan akunmu supaya kamu langsung masuk ke server.</p>
    <Feedback notice={confirm ? null : notice} error={confirm ? "" : error} />
    {state === undefined ? <p className="app-small" role="status">Memuat Discord…</p>
      : link ? <>
        <dl className="dash-facts dash-discord-facts">
          <div><dt>Akun Discord</dt><dd>{link.username ?? "Menunggu nama dari Discord…"}</dd></div>
          <div><dt>Terhubung</dt><dd>{discordLinkedDate(link.linkedAt)}</dd></div>
          <div><dt>Server</dt><dd><span className="dash-discord-status" data-status={link.joinStatus}>{discordJoinLabels[link.joinStatus]}</span>{link.joinStatus !== "joined" && <span>{joinLine(link)}</span>}</dd></div>
        </dl>
        <div className="dash-photo-buttons">
          {link.joinStatus === "joined" && state?.serverUrl && serverLink(state.serverUrl, "button button-blue")}
          {link.joinStatus === "failed" && <button type="button" className="button button-blue" disabled={busy !== null} onClick={() => void retry()}>{busy === "retry" ? "Mencoba…" : "Coba lagi"}</button>}
          <button type="button" className="button button-quiet" disabled={busy !== null} onClick={() => setConfirm(true)}>Putuskan</button>
        </div>
      </>
      : !state?.configured ? <p className="app-notice" role="status">Discord belum disiapkan pengurus. Bagian ini aktif begitu server GDGoC IPB siap.</p>
      : <div className="dash-photo-buttons">
        <button type="button" className="button button-blue" disabled={busy !== null} onClick={() => void connect()}><PixelIcon name="discord" size={18} />{busy === "connect" ? "Membuka Discord…" : "Hubungkan Discord"}</button>
        <p className="app-small">Kami hanya meminta nama akun Discord-mu dan izin menambahkanmu ke server, tanpa email.</p>
      </div>}
    <ConfirmDialog open={confirm} title="Putuskan Discord?" confirmLabel="Putuskan" danger busy={busy === "unlink"} error={confirm ? error : ""}
      message="Akun Discord-mu tidak lagi terhubung ke akun GDGoC IPB. Kamu tetap di server Discord sampai keluar sendiri, dan bisa menghubungkannya lagi kapan saja."
      onClose={() => setConfirm(false)}
      onConfirm={async () => { if (await unlink()) setConfirm(false); }} />
  </section>;
}
