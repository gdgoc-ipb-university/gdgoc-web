"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { LoadingPanel } from "@/components/appreciation/shared";
import { Arrow } from "@/components/icons";
import { readableError } from "@/lib/draft-session";
import { leagueHref } from "@/lib/league";
import { formatInviteCode, inviteCodeFrom, invitePath, leagueTeamSize, leagueTracks, type LeagueTrack } from "@/lib/league-team";

type Mine = FunctionReturnType<typeof api.league.mine>;
type Team = NonNullable<Extract<Mine, { eligible: true }>["team"]>;

/** The absolute invite link on the league host, which the captain shares. */
export function inviteLink(code: string) {
  return new URL(leagueHref(invitePath(code)), window.location.origin).toString();
}

/** Calls a mutation with a busy flag and its error as readable text. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await action(); return true; } catch (cause) { setError(readableError(cause)); return false; } finally { setBusy(false); }
  }
  return { busy, error, run, errorLine: error ? <p className="field-error" role="alert">{error}</p> : null };
}

/**
 * The signed-in member's Tech League area: their team, or forms to start or join one. An invite they opened, by link or
 * by code, shows alone until they join or close it (#192).
 */
export function LeagueTeamArea({ invite, onInvite }: { invite: string | null; onInvite: (code: string | null) => void }) {
  const mine = useQuery(api.league.mine);
  if (mine === undefined) return <LoadingPanel label="Membuka timmu…" />;
  if (!mine.eligible) return null;
  return <div className="league-team-area">
    {invite ? <InviteConfirm input={invite} team={mine.team} onClose={() => onInvite(null)} />
      : mine.team ? <TeamPanel team={mine.team} /> : <><CreateTeam /><OpenInvite onOpen={onInvite} /></>}
  </div>;
}

/** The team an invite opens, with "Gabung ke tim" only when the member can join it. */
function InviteConfirm({ input, team, onClose }: { input: string; team: Team | null; onClose: () => void }) {
  const code = inviteCodeFrom(input);
  const invite = useQuery(api.league.invite, code ? { code } : "skip");
  const join = useMutation(api.league.join);
  const action = useAction();
  if (code && invite === undefined) return <LoadingPanel label="Membuka undangan…" />;
  if (invite?.joined && team) return <>
    <p className="app-notice league-invite-note" role="status">Kamu sudah ada di tim ini. <button type="button" className="text-button" onClick={onClose}>Tutup</button></p>
    <TeamPanel team={team} />
  </>;
  const canJoin = invite && !invite.otherTeam && !invite.full;
  return <section className="app-panel league-invite" aria-labelledby="league-invite-title">
    <p className="eyebrow">UNDANGAN TIM</p>
    {!invite ? <>
      <h2 id="league-invite-title">Kode undangan ini tidak berlaku.</h2>
      <p>Periksa lagi kodenya, atau minta kode terbaru ke kapten timmu. Kode lama berhenti berlaku saat kapten menggantinya.</p>
    </> : <>
      <h2 id="league-invite-title">{invite.name}</h2>
      <dl className="league-team-facts">
        <div><dt>Kategori</dt><dd>{invite.trackName}</dd></div>
        <div><dt>Kapten</dt><dd>{invite.captain ?? "Belum ada"}</dd></div>
        <div><dt>Anggota</dt><dd>{invite.members} dari {invite.max}</dd></div>
      </dl>
      {invite.otherTeam ? <p className="app-notice" role="status">Kamu sudah ada di {invite.otherTeam}. Keluar dulu dari tim itu untuk bergabung ke {invite.name}.</p>
        : invite.full && <p className="app-notice" role="status">Tim ini sudah penuh. Tim bisa menerima anggota lagi kalau ada yang keluar.</p>}
    </>}
    <div className="league-actions">
      {canJoin && <button type="button" className="button button-blue" disabled={action.busy} onClick={() => void action.run(async () => { await join({ code: code! }); onClose(); })}>{action.busy ? "Bergabung…" : "Gabung ke tim"} <Arrow /></button>}
      <button type="button" className={canJoin ? "text-button" : "button button-quiet"} onClick={onClose}>{canJoin ? "Bukan sekarang" : "Tutup"}</button>
    </div>
    {action.errorLine}
  </section>;
}

function TrackChoice({ value, onChange, disabled, name }: { value: LeagueTrack | ""; onChange: (track: LeagueTrack) => void; disabled?: boolean; name: string }) {
  return <div className="league-tracks">{leagueTracks.map((track) => <label key={track.key} className="league-track">
    <input type="radio" name={name} value={track.key} checked={value === track.key} disabled={disabled} onChange={() => onChange(track.key)} />
    <span>{track.name}</span>
  </label>)}</div>;
}

function CreateTeam() {
  const create = useMutation(api.league.create);
  const [name, setName] = useState("");
  const [track, setTrack] = useState<LeagueTrack | "">("");
  const [missing, setMissing] = useState("");
  const action = useAction();
  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = !name.trim() ? "Isi nama tim." : !track ? "Pilih kategori lomba." : "";
    setMissing(problem);
    if (!problem && track) void action.run(() => create({ name, track }));
  }
  return <form className="app-panel league-create" onSubmit={submit} noValidate aria-labelledby="league-create-title">
    <p className="eyebrow">BUAT TIM</p>
    <h2 id="league-create-title">Bentuk timmu.</h2>
    <p>Kamu jadi kapten: satu-satunya kontak timmu untuk panitia. Setelah tim jadi, ajak {leagueTeamSize.max - 1 > 1 ? `sampai ${leagueTeamSize.max - 1}` : "satu"} teman dengan kode atau tautan undangan. Mereka juga masuk sebagai member GDGoC IPB.</p>
    <fieldset disabled={action.busy}>
      <div className="app-field"><label htmlFor="league-team-name">Nama tim <span className="field-required" aria-hidden="true">*</span></label>
        <input id="league-team-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" /></div>
      <fieldset className="league-track-field"><legend>Kategori <span className="field-required" aria-hidden="true">*</span></legend>
        <TrackChoice name="league-create-track" value={track} onChange={setTrack} /></fieldset>
      <p className="field-hint">Kategori bisa diganti kapten sampai timmu mengumpulkan karya.</p>
      {missing && <p className="field-error" role="alert">{missing}</p>}
      <button type="submit" className="button button-blue">{action.busy ? "Membuat tim…" : "Buat tim"} <Arrow /></button>
    </fieldset>
    {action.errorLine}
  </form>;
}

function OpenInvite({ onOpen }: { onOpen: (code: string) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const code = inviteCodeFrom(text);
    if (!code) { setError(text.trim() ? "Kode undangan terdiri dari 8 huruf dan angka, seperti ABCD-2345." : "Isi kode undangan dari kaptenmu."); return; }
    setError(""); onOpen(code);
  }
  return <form className="app-panel league-open-invite" onSubmit={submit} noValidate aria-labelledby="league-open-title">
    <h2 id="league-open-title">Diajak teman?</h2>
    <p>Masukkan kode undangan dari kaptenmu, atau buka tautan undangannya.</p>
    <div className="league-inline-form">
      <div className="app-field"><label htmlFor="league-invite-code">Kode undangan</label>
        <input id="league-invite-code" value={text} onChange={(event) => setText(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="ABCD-2345"
          aria-invalid={Boolean(error)} aria-describedby={error ? "league-invite-code-error" : undefined} /></div>
      <button type="submit" className="button button-quiet">Buka undangan</button>
    </div>
    {error && <p className="field-error" id="league-invite-code-error" role="alert">{error}</p>}
  </form>;
}

/** A button that asks once more before acting, in place. */
function Confirm({ label, question, confirm, onConfirm, busy, danger = false }: { label: string; question: ReactNode; confirm: string; onConfirm: () => void; busy: boolean; danger?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" className="text-button" onClick={() => setAsking(true)}>{label}</button>;
  return <span className="league-confirm" role="group">
    <span>{question}</span>
    <button type="button" className={danger ? "text-button league-danger" : "text-button"} disabled={busy} onClick={() => { setAsking(false); onConfirm(); }}>{confirm}</button>
    <button type="button" className="text-button" onClick={() => setAsking(false)}>Batal</button>
  </span>;
}

const standingLabels = { forming: `Belum lengkap: minimal ${leagueTeamSize.min} orang`, complete: "Anggota cukup", flagged: "Ditinjau panitia" } as const;

function TeamPanel({ team }: { team: Team }) {
  const [leave, handOver, remove] = [useMutation(api.league.leave), useMutation(api.league.handOver), useMutation(api.league.removeMember)];
  const action = useAction();
  return <section className="app-panel league-team" aria-labelledby="league-team-title">
    <p className="eyebrow">TIMMU</p>
    <h2 id="league-team-title">{team.name}</h2>
    <span className="app-status" data-status={team.standing === "complete" ? "published" : "revision"}>{standingLabels[team.standing]}</span>
    <dl className="league-team-facts">
      <div><dt>Kategori</dt><dd>{team.trackName}</dd></div>
      <div><dt>Anggota</dt><dd>{team.members.length} dari {team.size.max}</dd></div>
    </dl>

    <h3>Anggota</h3>
    <ol className="league-members">{team.members.map((member) => <li key={member._id}>
      <span className="league-member-name">{member.name}{member.you && <small> (kamu)</small>}</span>
      {member.captain && <span className="app-status" data-status="submitted">Kapten</span>}
      {team.captain && !member.you && <span className="league-member-actions">
        <Confirm label="Jadikan kapten" question={`${member.name} jadi kapten?`} confirm="Ya, serahkan" busy={action.busy} onConfirm={() => void action.run(() => handOver({ memberId: member._id }))} />
        <Confirm label="Keluarkan" question={`Keluarkan ${member.name}?`} confirm="Ya, keluarkan" danger busy={action.busy} onConfirm={() => void action.run(() => remove({ memberId: member._id }))} />
      </span>}
    </li>)}</ol>
    {action.errorLine}

    {team.captain && <InvitePanel code={team.inviteCode} full={team.members.length >= team.size.max} />}
    {team.captain && <TeamSettings team={team} />}

    <div className="league-leave">
      <Confirm label="Keluar dari tim" danger busy={action.busy} confirm="Ya, keluar" onConfirm={() => void action.run(() => leave({}))}
        question={team.members.length === 1 ? "Tim ini akan dihapus." : team.captain ? "Kapten pindah ke anggota yang bergabung paling awal." : "Keluar dari tim?"} />
    </div>
  </section>;
}

/** The captain's invite: the code to read out or type, and the link that carries it. Replacing one replaces both. */
function InvitePanel({ code, full }: { code: string | null; full: boolean }) {
  const rotate = useMutation(api.league.rotateInvite);
  const action = useAction();
  // A team made before invite codes has none until the migration runs (#192); its captain can make one now.
  if (!code) return <div className="league-invite-panel">
    <h3>Undang anggota</h3>
    <p className="field-hint">Buat kode undangan untuk mengajak anggota timmu.</p>
    <button type="button" className="button button-quiet" disabled={action.busy} onClick={() => void action.run(() => rotate({}))}>{action.busy ? "Membuat kode…" : "Buat kode undangan"}</button>
    {action.errorLine}
  </div>;
  const link = inviteLink(code);
  return <div className="league-invite-panel">
    <h3>Undang anggota</h3>
    {full ? <p className="app-notice" role="status">Tim sudah penuh. Kode ini baru bisa dipakai lagi kalau ada yang keluar.</p>
      : <p className="field-hint">Siapa pun yang memegang kode atau tautan ini bisa bergabung, jadi kirim hanya ke anggota timmu.</p>}
    <div className="league-invite-code">
      <dl><dt>Kode undangan</dt><dd className="league-code">{formatInviteCode(code)}</dd></dl>
      <CopyButton text={formatInviteCode(code)} label="Salin kode" />
    </div>
    <div className="league-inline-form">
      <div className="app-field"><label htmlFor="league-invite-url">Tautan undangan</label>
        <input id="league-invite-url" readOnly value={link} onFocus={(event) => event.target.select()} /></div>
      <CopyButton text={link} label="Salin tautan" />
    </div>
    <Confirm label="Ganti kode" question="Kode dan tautan lama berhenti berlaku." confirm="Ya, ganti" danger busy={action.busy} onConfirm={() => void action.run(() => rotate({}))} />
    {action.errorLine}
  </div>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2400); } catch { setCopied(false); }
  }
  return <button type="button" className="button button-quiet" onClick={() => void copy()}>{copied ? "Tersalin" : label}</button>;
}

function TeamSettings({ team }: { team: Team }) {
  const [rename, changeTrack] = [useMutation(api.league.rename), useMutation(api.league.changeTrack)];
  const [name, setName] = useState(team.name);
  const action = useAction();
  return <details className="league-settings">
    <summary>Ubah nama atau kategori</summary>
    <form className="league-inline-form" onSubmit={(event) => { event.preventDefault(); void action.run(() => rename({ name })); }}>
      <div className="app-field"><label htmlFor="league-rename">Nama tim</label>
        <input id="league-rename" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" /></div>
      <button type="submit" className="button button-quiet" disabled={action.busy || name.trim() === team.name}>Simpan nama</button>
    </form>
    <fieldset className="league-track-field" disabled={action.busy || team.trackLocked}><legend>Kategori</legend>
      <TrackChoice name="league-change-track" value={team.track} onChange={(track) => void action.run(() => changeTrack({ track }))} />
    </fieldset>
    <p className="field-hint">{team.trackLocked ? "Kategori terkunci karena timmu sudah mengumpulkan karya." : "Kategori bisa diganti sampai timmu mengumpulkan karya."}</p>
    {action.errorLine}
  </details>;
}
