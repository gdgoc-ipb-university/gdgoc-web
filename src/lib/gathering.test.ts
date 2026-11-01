import { describe, expect, it } from "vitest";
import { checkInsCsv, checkInsFileName, clockLabel, gatheringTimeLabel, normalizeGathering, runsToday, validateGathering } from "./gathering";

const at = (value: string) => Date.parse(`${value}+07:00`);

describe("gatherings", () => {
  it("cleans and checks the form", () => {
    const values = normalizeGathering({ title: "  Kumpul   member ", venue: " Javano ", startsAt: "2026-11-21T09:00", endsAt: "2026-11-21T13:00", audience: ["bod", "member"] });
    expect(values).toEqual({ title: "Kumpul member", venue: "Javano", startsAt: "2026-11-21T09:00", endsAt: "2026-11-21T13:00", audience: ["member", "bod"] });
    expect(validateGathering(values)).toEqual({});
    expect(validateGathering({ ...values, title: "", venue: "", audience: [] })).toEqual({ title: expect.any(String), venue: expect.any(String), audience: expect.any(String) });
    expect(validateGathering({ ...values, endsAt: "2026-11-21T09:00" }).endsAt).toMatch(/setelah/);
    expect(validateGathering({ ...values, endsAt: "2026-11-22T13:00" }).endsAt).toMatch(/24 jam/);
    expect(validateGathering({ ...values, startsAt: "21/11/2026" }).startsAt).toMatch(/Pilih/);
  });

  it("knows which gatherings run today in WIB, including one past midnight", () => {
    const gathering = { startsAt: at("2026-11-21T19:00:00"), endsAt: at("2026-11-22T01:00:00") };
    expect(runsToday(gathering, at("2026-11-21T08:00:00"))).toBe(true);
    expect(runsToday(gathering, at("2026-11-22T00:30:00"))).toBe(true);
    expect(runsToday(gathering, at("2026-11-20T23:59:00"))).toBe(false);
    expect(runsToday(gathering, at("2026-11-23T00:00:00"))).toBe(false);
  });

  it("labels times in WIB", () => {
    expect(gatheringTimeLabel({ startsAt: at("2026-11-21T09:00:00"), endsAt: at("2026-11-21T13:00:00") })).toBe("Sab, 21 Nov 2026 · 09.00–13.00 WIB");
    expect(gatheringTimeLabel({ startsAt: at("2026-11-21T19:00:00"), endsAt: at("2026-11-22T01:00:00") })).toBe("Sab, 21 Nov 2026 19.00 – Min, 22 Nov 2026 01.00 WIB");
    expect(clockLabel(at("2026-11-21T09:05:00"))).toBe("09.05 WIB");
  });

  it("exports who came, without emails, in the shared CSV encoding", () => {
    const csv = checkInsCsv([
      { name: "Rania Putri", campus: "IPB University", studyProgram: "Ilmu Komputer", memberType: "core", division: "Technical", checkedInAt: at("2026-11-21T09:05:00"), method: "scan", by: "Sari", outsideAudience: false },
      { name: "=Tamu", campus: "", studyProgram: "", memberType: "member", division: null, checkedInAt: at("2026-11-21T09:30:00"), method: "manual", by: null, outsideAudience: true },
    ]);
    expect(csv.startsWith("﻿Nama,Kampus,Program studi,Peran komunitas,Waktu hadir,Cara,Dicatat oleh,Di luar sasaran\r\n")).toBe(true);
    expect(csv).toContain("Rania Putri,IPB University,Ilmu Komputer,Core Team · Technical,2026-11-21 09:05 WIB,Pindai kartu,Sari,\r\n");
    expect(csv).toContain("'=Tamu,,,Member,2026-11-21 09:30 WIB,Manual,,Ya\r\n");
    expect(checkInsFileName({ title: "Kumpul member: November", startsAt: at("2026-11-21T09:00:00") })).toBe("kehadiran-kumpul-member-november-2026-11-21.csv");
  });
});
