"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { leagueTeamSize, leagueTracks, registrationLabels, registrationState, standingLabels, teamsCsv, teamsFileName, type RegistrationState, type TeamStanding } from "@/lib/league-team";
import { LoadingPanel } from "../appreciation/shared";
import { PixelIcon } from "../pixel-icons";
import { Select } from "../select";
import { StaffOnly } from "./assignments";
import { isStaff, useDashboardViewer } from "./viewer";

export const techLeaguePath = "/dashboard/tech-league";

type Team = FunctionReturnType<typeof api.league.staffTeams>[number];
const standingTone: Record<TeamStanding, string> = { complete: "done", forming: "missing", flagged: "late" };
const registrationTone: Record<RegistrationState, string> = { paid: "done", unpaid: "missing", none: "closed" };

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Staff: every Tech League team of the season by track and status, with the captain as contact and a CSV of all of them. */
export function TechLeagueTeams() {
  const viewer = useDashboardViewer();
  const teams = useQuery(api.league.staffTeams, isStaff(viewer) ? {} : "skip");
  const [search, setSearch] = useState("");
  const [track, setTrack] = useState("all");
  const [standing, setStanding] = useState<"all" | TeamStanding>("all");
  const [registration, setRegistration] = useState<"all" | RegistrationState>("all");
  if (!isStaff(viewer)) return <StaffOnly />;
  if (teams === undefined) return <LoadingPanel label="Memuat tim Tech League…" />;
  const needle = search.trim().toLowerCase();
  const shown = teams
    .filter((team) => (track === "all" || team.track === track) && (standing === "all" || team.standing === standing) && (registration === "all" || registrationState(team.registration) === registration))
    .filter((team) => !needle || [team.name, team.code, team.captain.name, team.captain.email ?? "", ...team.members.map((member) => member.name)].some((value) => value.toLowerCase().includes(needle)))
    .sort((a, b) => a.trackName.localeCompare(b.trackName) || a.name.localeCompare(b.name, "id", { numeric: true }));
  const people = teams.reduce((sum, team) => sum + team.members.length, 0);

  return <>
    <div className="dash-intro dash-intro-action"><div><p className="eyebrow">ADMIN · TECH LEAGUE</p><h1>Tech League.</h1>
      <p>{teams.length} tim, {people} peserta. Tim dibentuk member di halaman Tech League; ukuran tim {leagueTeamSize.min}–{leagueTeamSize.max} orang. Kapten satu-satunya kontak tim untuk panitia.</p></div>
      <div className="dash-roster-actions">
        <button type="button" className="button button-quiet" disabled={!teams.length} onClick={() => download(teamsCsv(teams), teamsFileName(Date.now()))}><PixelIcon name="download" size={18} />Unduh CSV</button>
      </div>
    </div>

    <ul className="dash-league-tracks" aria-label="Tim per kategori">{leagueTracks.map((item) => {
      const inTrack = teams.filter((team) => team.track === item.key);
      return <li key={item.key} className="app-panel"><span className="app-small">{item.name}</span><strong>{inTrack.length}</strong>
        <span className="app-small">{inTrack.filter((team) => team.registration?.paid).length} lunas · {inTrack.filter((team) => team.standing === "forming").length} belum lengkap</span></li>;
    })}</ul>

    <div className="dash-toolbar dash-roster-toolbar" role="search" aria-label="Cari dan saring tim">
      <div className="dash-search-control"><PixelIcon name="search" size={18} />
        <input type="search" aria-label="Cari tim, kode, atau anggota" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari tim, kode, atau anggota" autoComplete="off" />
      </div>
      <Select variant="inline" label="Kategori" value={track} onChange={setTrack} options={[{ value: "all", label: "Semua" }, ...leagueTracks.map((item) => ({ value: item.key, label: item.name }))]} />
      <Select variant="inline" label="Status" value={standing} onChange={setStanding} options={[{ value: "all", label: "Semua" }, ...(Object.keys(standingLabels) as TeamStanding[]).map((key) => ({ value: key, label: standingLabels[key] }))]} />
      <Select variant="inline" label="Pendaftaran" value={registration} onChange={setRegistration} options={[{ value: "all", label: "Semua" }, ...(Object.keys(registrationLabels) as RegistrationState[]).map((key) => ({ value: key, label: registrationLabels[key] }))]} />
    </div>

    {!teams.length ? <div className="app-empty"><h2>Belum ada tim.</h2><p>Tim muncul di sini begitu member membentuknya di halaman Daftar Tech League.</p></div>
      : !shown.length ? <div className="app-empty"><h2>Tidak ada tim yang cocok.</h2><p>Ubah pencarian atau filternya.</p></div>
      : <div className="dash-table-wrap" role="region" aria-labelledby="league-caption" tabIndex={0}>
        <table className="dash-table">
          <caption id="league-caption" className="sr-only">Tim Tech League, {shown.length} dari {teams.length}</caption>
          <thead><tr><th scope="col">Tim</th><th scope="col">Kategori</th><th scope="col">Anggota</th><th scope="col">Kapten</th><th scope="col">Status</th><th scope="col">Pendaftaran</th></tr></thead>
          <tbody>{shown.map((team) => <TeamRow key={team._id} team={team} />)}</tbody>
        </table>
      </div>}
  </>;
}

function TeamRow({ team }: { team: Team }) {
  const state = registrationState(team.registration);
  return <tr>
    <th scope="row" className="dash-table-member"><span className="dash-table-stack">{team.name}<small className="dash-league-code">{team.code}</small></span></th>
    <td>{team.trackName}</td>
    <td><span className="dash-table-stack">{team.members.length} dari {leagueTeamSize.max}
      <small>{team.members.map((member, index) => <span key={member.ownerId}>{index > 0 && ", "}<Link href={`/dashboard/anggota/${encodeURIComponent(member.ownerId)}`}>{member.name}</Link></span>)}</small></span></td>
    <td><span className="dash-table-stack">{team.captain.name}{team.captain.email && <small title={team.captain.email}>{team.captain.email}</small>}</span></td>
    <td><span className="app-status dash-status" data-status={standingTone[team.standing]}>{standingLabels[team.standing]}</span></td>
    <td><span className="app-status dash-status" data-status={registrationTone[state]}>{registrationLabels[state]}</span></td>
  </tr>;
}
