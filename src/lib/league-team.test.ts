import { describe, expect, it } from "vitest";
import { formatInviteCode, inviteCodeFrom, inviteCodePattern, invitePath, inviteTokenFrom, newInviteCode, registrationState, teamsCsv, teamsFileName, leagueTeamSize, leagueTracks, newTeamCode, teamCodeFrom, teamCodePattern, teamStanding, trackName } from "./league-team";
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

  it("makes eight-character invite codes and shows them in halves", () => {
    const codes = new Set(Array.from({ length: 500 }, newInviteCode));
    for (const code of codes) expect(code).toMatch(inviteCodePattern);
    expect(codes.size).toBe(500);
    expect(formatInviteCode("ABCD2345")).toBe("ABCD-2345");
    expect(invitePath("ABCD2345")).toBe("/daftar?undangan=ABCD2345");
  });

  it("reads an invite code typed loosely or inside a pasted link", () => {
    for (const input of ["ABCD2345", "abcd-2345", " AbCd 2345 ", "ab cd–23 45", "https://league.gdgocipb.com/daftar?undangan=ABCD2345", "/league/daftar?a=1&undangan=abcd-2345#tim", "undangan=abcd2345"]) {
      expect(inviteCodeFrom(input)).toBe("ABCD2345");
    }
    // Too short or long, a look-alike that is not in the alphabet, an old 22-character token, or nothing at all.
    for (const input of ["ABCD234", "ABCD23456", "ABCD-2O45", "abcdefghijABCDEFGHIJ_-", "https://league.gdgocipb.com/daftar?undangan=abcdefghijABCDEFGHIJ_-", "halo", "", null]) {
      expect(inviteCodeFrom(input)).toBeNull();
    }
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
    expect(leagueTeamSize.min).toBeLessThanOrEqual(leagueTeamSize.max);
    expect(teamStanding({ captainId: "a" }, leagueTeamSize.min - 1)).toBe("forming");
    expect(teamStanding({ captainId: "a" }, leagueTeamSize.min)).toBe("complete");
    expect(teamStanding({ captainId: null }, 3)).toBe("flagged");
  });

  it("exports teams for staff by track, with the captain as the only contact", () => {
    const base = { standing: "complete" as const, createdAt: Date.parse("2026-12-01T03:00:00Z"), captain: { name: "Rania Putri", email: "rania@example.com" } };
    const csv = teamsCsv([
      { ...base, name: "Tim B", code: "ABC234", trackName: "UI/UX Design", registration: { paid: true }, members: [{ name: "Rania Putri", captain: true }, { name: "Bima, S.", captain: false }] },
      { ...base, name: "Tim A", code: "XYZ789", trackName: "Business Plan", registration: null, standing: "forming", members: [{ name: "Rania Putri", captain: true }] },
    ]);
    const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("kode_tim,nama_tim,kategori,status,pendaftaran,jumlah_anggota,anggota,kapten,email_kapten,dibuat");
    expect(lines[1]).toBe("XYZ789,Tim A,Business Plan,Belum lengkap,Belum terdaftar,1,Rania Putri,Rania Putri,rania@example.com,2026-12-01 10:00 WIB");
    expect(lines[2]).toBe('ABC234,Tim B,UI/UX Design,Anggota cukup,Lunas,2,"Rania Putri; Bima, S.",Rania Putri,rania@example.com,2026-12-01 10:00 WIB');
    expect(teamsFileName(Date.parse("2026-12-01T20:00:00Z"))).toBe("tech-league-tim-2026-12-02.csv");
    expect([null, { paid: false }, { paid: true }].map(registrationState)).toEqual(["none", "unpaid", "paid"]);
  });
});
