import { toJakartaInput } from "./assignment";
import { toCsv } from "./assignment-export";
import { chapterPeriod } from "./chapter";
import { normalizeTeamName, teamNameProblem } from "./cohort";
import { techLeague } from "./tech-league";

// Tech League teams (#183): a team is a group of member accounts in one track for one season.

/** The season teams belong to; a member is in at most one team per season. */
export const leagueSeason = chapterPeriod.year;

/**
 * How many members a team has, captain included. The guidebook still says either 2–4 or 3–5 (#183); this is the one
 * place to change it. `min` only labels a team as still forming; `max` is enforced when someone joins.
 */
export const leagueTeamSize = { min: 2, max: 4 } as const;

/** Track keys are stored on teams and never change; the names follow the league page. */
export const leagueTracks = [
  { key: "software", name: techLeague.categories[0] },
  { key: "uiux", name: techLeague.categories[1] },
  { key: "business", name: techLeague.categories[2] },
] as const;
export type LeagueTrack = (typeof leagueTracks)[number]["key"];

export function trackName(key: string) {
  return leagueTracks.find((track) => track.key === key)?.name ?? key;
}

// Team codes stand in for names in anonymous judging, for staff and judges only. Invite codes let a member join a team
// (#192). Both use 31 letters and digits with no look-alikes (0/O, 1/I/L) and no underscore, so they read aloud, type
// cleanly and split cleanly in `TEAMCODE_TRACK_SUBMISSION` file names.
const codeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const teamCodeLength = 6;
export const teamCodePattern = new RegExp(`^[${codeAlphabet}]{${teamCodeLength}}$`);

/** A random code from the given bytes (one per character); rejection sampling keeps every character equally likely. */
export function teamCodeFrom(bytes: Uint8Array, length: number = teamCodeLength) {
  const limit = 256 - (256 % codeAlphabet.length);
  let code = "";
  for (const byte of bytes) {
    if (byte >= limit) continue;
    code += codeAlphabet[byte % codeAlphabet.length];
    if (code.length === length) return code;
  }
  return null;
}

function randomCode(length: number) {
  for (;;) {
    const code = teamCodeFrom(crypto.getRandomValues(new Uint8Array(length * 2)), length);
    if (code) return code;
  }
}

export const newTeamCode = () => randomCode(teamCodeLength);

/** Invite codes: eight characters, about 852 billion of them, stored bare and shown in halves as `ABCD-2345`. */
export const inviteCodeLength = 8;
export const inviteCodePattern = new RegExp(`^[${codeAlphabet}]{${inviteCodeLength}}$`);
export const newInviteCode = () => randomCode(inviteCodeLength);

export function formatInviteCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Invite tokens are 128 random bits in base64url, like card tokens. */
export const inviteTokenPattern = /^[A-Za-z0-9_-]{22}$/;

/** The invite query parameter on the league's /daftar. */
export const inviteParam = "undangan";

/** The invite link carries the invite code, so replacing the code replaces the link. */
export function invitePath(code: string) {
  return `/daftar?${inviteParam}=${code}`;
}

/**
 * The one reader of invite codes, on the server, Daftar and onboarding alike: the code in any case, with spaces or a
 * dash, or a pasted link holding `undangan=`. Null when the input holds no well-formed code.
 */
export function inviteCodeFrom(input: string | null | undefined) {
  if (!input || input.length > 500) return null;
  const param = input.match(new RegExp(`(?:^|[?&])${inviteParam}=([^&#]*)`, "i"));
  const code = (param ? param[1] : input).replace(/[\s\u2010-\u2015-]|%20|\+/g, "").toUpperCase();
  return inviteCodePattern.test(code) ? code : null;
}

/** The invite token from a pasted link or the token alone, or null when neither holds one. */
export function inviteTokenFrom(input: string) {
  const text = input.trim();
  if (inviteTokenPattern.test(text)) return text;
  const match = text.match(new RegExp(`[?&]${inviteParam}=([A-Za-z0-9_-]{22})(?:[&#]|$)`));
  return match ? match[1] : null;
}

export { normalizeTeamName, teamNameProblem };

export type TeamStanding = "flagged" | "forming" | "complete";

/** How staff and the team page read a team: flagged without a captain, forming below the minimum, else complete. */
export function teamStanding(team: { captainId?: string | null }, size: number): TeamStanding {
  if (!team.captainId) return "flagged";
  return size < leagueTeamSize.min ? "forming" : "complete";
}

export const standingLabels: Record<TeamStanding, string> = { forming: "Belum lengkap", complete: "Anggota cukup", flagged: "Tanpa kapten" };

export type RegistrationState = "none" | "unpaid" | "paid";
export const registrationLabels: Record<RegistrationState, string> = { none: "Belum terdaftar", unpaid: "Terdaftar, belum lunas", paid: "Lunas" };
export function registrationState(registration: { paid: boolean } | null): RegistrationState {
  return !registration ? "none" : registration.paid ? "paid" : "unpaid";
}

export type StaffTeam = {
  name: string; code: string; trackName: string; standing: TeamStanding; createdAt: number;
  registration: { paid: boolean } | null; captain: { name: string; email: string | null } | null; members: { name: string; captain: boolean }[];
};

/** Every team for staff as a spreadsheet, by track then name. The captain is the only contact, so only their email is in it. */
export function teamsCsv(teams: StaffTeam[]) {
  const rows = [...teams].sort((a, b) => a.trackName.localeCompare(b.trackName) || a.name.localeCompare(b.name, "id", { numeric: true })).map((team) => [
    team.code, team.name, team.trackName, standingLabels[team.standing], registrationLabels[registrationState(team.registration)],
    team.members.length, team.members.map((member) => member.name).join("; "), team.captain?.name ?? null, team.captain?.email ?? null, `${toJakartaInput(team.createdAt).replace("T", " ")} WIB`,
  ]);
  return toCsv([["kode_tim", "nama_tim", "kategori", "status", "pendaftaran", "jumlah_anggota", "anggota", "kapten", "email_kapten", "dibuat"], ...rows]);
}

export function teamsFileName(now: number) {
  return `tech-league-tim-${toJakartaInput(now).slice(0, 10)}.csv`;
}
