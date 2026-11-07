import { describe, expect, it } from "vitest";
import { inviteTokenFrom, leagueTeamSize, leagueTracks, newTeamCode, teamCodeFrom, teamCodePattern, teamStanding, trackCode, trackName } from "./league-team";
import { techLeague } from "./tech-league";

describe("league teams", () => {
  it("makes six-character team codes without look-alikes", () => {
    const codes = new Set(Array.from({ length: 500 }, newTeamCode));
    for (const code of codes) expect(code).toMatch(teamCodePattern);
    expect(codes.size).toBeGreaterThan(495);
    expect([...codes].join("")).not.toMatch(/[01ILO_]/);
    // Bytes past the last whole round of the alphabet are skipped, so no character is favoured.
    expect(teamCodeFrom(new Uint8Array([255, 0, 1, 2, 3, 4, 5]))).toBe("234567");
    expect(teamCodeFrom(new Uint8Array([0, 1, 2]))).toBeNull();
  });

  it("reads an invite token from a link or on its own", () => {
    const token = "abcdefghijABCDEFGHIJ_-";
    expect(inviteTokenFrom(token)).toBe(token);
    expect(inviteTokenFrom(` https://league.gdgocipb.com/daftar?undangan=${token} `)).toBe(token);
    expect(inviteTokenFrom(`/league/daftar?a=1&undangan=${token}#tim`)).toBe(token);
    expect(inviteTokenFrom(`https://league.gdgocipb.com/daftar?undangan=${token}x`)).toBeNull();
    expect(inviteTokenFrom("halo")).toBeNull();
  });

  it("names the tracks after the league page and reads a team's standing", () => {
    expect(leagueTracks.map((track) => track.name)).toEqual(techLeague.categories);
    expect(trackName("uiux")).toBe("UI/UX Design");
    expect(trackCode("business")).toBe("BP");
    expect(leagueTeamSize.min).toBeLessThanOrEqual(leagueTeamSize.max);
    expect(teamStanding({ captainId: "a" }, leagueTeamSize.min - 1)).toBe("forming");
    expect(teamStanding({ captainId: "a" }, leagueTeamSize.min)).toBe("complete");
    expect(teamStanding({ captainId: null }, 3)).toBe("flagged");
  });
});
