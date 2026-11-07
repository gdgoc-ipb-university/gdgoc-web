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
  { key: "software", name: techLeague.categories[0], code: "SD" },
  { key: "uiux", name: techLeague.categories[1], code: "UIUX" },
  { key: "business", name: techLeague.categories[2], code: "BP" },
] as const;
export type LeagueTrack = (typeof leagueTracks)[number]["key"];

export function trackName(key: string) {
  return leagueTracks.find((track) => track.key === key)?.name ?? key;
}

/** The track's short code in submission file names, `TEAMCODE_TRACK_SUBMISSION`. */
export function trackCode(key: string) {
  return leagueTracks.find((track) => track.key === key)?.code ?? key.toUpperCase();
}

// Team codes stand in for names in anonymous judging. Six characters from 31 letters and digits with no look-alikes
// (0/O, 1/I/L) and no underscore, so they read aloud, type cleanly and split from the track in a file name.
const codeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const teamCodeLength = 6;
export const teamCodePattern = new RegExp(`^[${codeAlphabet}]{${teamCodeLength}}$`);

/** A random team code from the given bytes (one per character); rejection sampling keeps every character equally likely. */
export function teamCodeFrom(bytes: Uint8Array) {
  const limit = 256 - (256 % codeAlphabet.length);
  let code = "";
  for (const byte of bytes) {
    if (byte >= limit) continue;
    code += codeAlphabet[byte % codeAlphabet.length];
    if (code.length === teamCodeLength) return code;
  }
  return null;
}

export function newTeamCode() {
  for (;;) {
    const code = teamCodeFrom(crypto.getRandomValues(new Uint8Array(teamCodeLength * 2)));
    if (code) return code;
  }
}

/** Invite tokens are 128 random bits in base64url, like card tokens. */
export const inviteTokenPattern = /^[A-Za-z0-9_-]{22}$/;

/** The invite query parameter on the league's /daftar. */
export const inviteParam = "undangan";

export function invitePath(token: string) {
  return `/daftar?${inviteParam}=${token}`;
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
