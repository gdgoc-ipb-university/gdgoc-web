import { describe, expect, it } from "vitest";
import { isOverdue, normalizeRequest, techSupportKpis, validateRequest, workingDaysLabel, workingTime, type TechSupportValues } from "./tech-support-request";
import { techSupport } from "./tech-support";

const hour = 3600000, day = 24 * hour;
/** A WIB wall-clock time. 30 Oct 2026 is a Friday. */
const wib = (value: string) => Date.parse(`${value}:00+07:00`);
const values = (extra: Partial<TechSupportValues> = {}): TechSupportValues => ({
  competition: "Gemastik", competitionUrl: "https://gemastik.kemdikbud.go.id", deadline: "2026-11-20", participation: "solo",
  teamName: "", helpKinds: ["Ideasi"], progress: "Baru ide.", whatsapp: "+6281234567890", discord: "", ...extra,
});

describe("Tech Support working days", () => {
  it("counts only Monday to Friday in WIB", () => {
    expect(workingTime(wib("2026-11-02T09:00"), wib("2026-11-02T15:00"))).toBe(6 * hour);
    // Friday 17.00 to Monday 09.00: seven hours of Friday and nine of Monday.
    expect(workingTime(wib("2026-10-30T17:00"), wib("2026-11-02T09:00"))).toBe(16 * hour);
    // A request sent on Saturday starts counting on Monday.
    expect(workingTime(wib("2026-10-31T10:00"), wib("2026-11-02T00:00"))).toBe(0);
    expect(workingTime(wib("2026-10-31T10:00"), wib("2026-11-09T00:00"))).toBe(5 * day);
    // Midnight in WIB is 17.00 UTC the day before, so a Monday 01.00 WIB moment is still Monday.
    expect(workingTime(wib("2026-11-02T00:00"), wib("2026-11-02T01:00"))).toBe(hour);
    expect(workingTime(wib("2026-11-02T10:00"), wib("2026-11-02T09:00"))).toBe(0);
    expect(workingTime(wib("2026-10-01T00:00"), wib("2026-11-01T00:00"))).toBe(22 * day);
  });

  it("marks a new request overdue after three working days, and stops the clock once matched", () => {
    const friday = wib("2026-10-30T15:00");
    expect(isOverdue({ status: "new", submittedAt: friday }, wib("2026-11-04T15:00"))).toBe(false);
    expect(isOverdue({ status: "new", submittedAt: friday }, wib("2026-11-04T15:01"))).toBe(true);
    expect(isOverdue({ status: "matched", submittedAt: friday }, wib("2026-11-20T15:00"))).toBe(false);
    expect(isOverdue({ status: "closed", submittedAt: friday }, wib("2026-11-20T15:00"))).toBe(false);
  });

  it("labels elapsed working days with a decimal comma", () => {
    expect([workingDaysLabel(5 * hour), workingDaysLabel(day), workingDaysLabel(2.56 * day)]).toEqual(["kurang dari 1 hari kerja", "1 hari kerja", "2,5 hari kerja"]);
  });
});

describe("Tech Support request form", () => {
  const now = wib("2026-11-01T10:00");

  it("asks for every field", () => {
    const errors = validateRequest(normalizeRequest({ competition: " ", competitionUrl: "", deadline: "", participation: "", teamName: "", helpKinds: [], progress: " ", whatsapp: " ", discord: "" }), now);
    // The Discord username is the only optional field.
    expect(Object.keys(errors).sort()).toEqual(["competition", "competitionUrl", "deadline", "helpKinds", "participation", "progress", "whatsapp"]);
    expect(validateRequest(normalizeRequest(values({ participation: "team", teamName: " " })), now)).toEqual({ teamName: "Tulis nama timnya." });
  });

  it("reads rich progress from its document (#288)", () => {
    const doc = (...lines: string[]) => JSON.stringify({ type: "doc", content: lines.map((line) => ({ type: "paragraph", ...(line ? { content: [{ type: "text", text: line }] } : {}) })) });
    expect(normalizeRequest(values({ progress: "lama", progressDoc: doc("Satu", "Dua") }))).toMatchObject({ progress: "Satu\nDua", progressDoc: doc("Satu", "Dua") });
    expect(normalizeRequest(values())).not.toHaveProperty("progressDoc");
    expect(validateRequest(normalizeRequest(values({ progressDoc: doc(...Array.from({ length: 500 }, () => "abcd")) })), now)).toEqual({});
    expect(validateRequest(normalizeRequest(values({ progressDoc: doc("") })), now)).toEqual({ progress: "Ceritakan progres ide atau proyekmu sejauh ini." });
    expect(validateRequest(normalizeRequest(values({ progressDoc: "{bukan json" })), now)).toEqual({ progress: "Format progres tidak dikenali. Muat ulang halaman, lalu coba lagi." });
  });

  it("checks the link and the deadline", () => {
    expect(validateRequest(values({ competitionUrl: "javascript:alert(1)" }), now)).toHaveProperty("competitionUrl");
    expect(validateRequest(values({ deadline: "2026-02-30" }), now)).toHaveProperty("deadline");
    expect(validateRequest(values({ deadline: "2026-10-31" }), now)).toHaveProperty("deadline");
    expect(validateRequest(values({ deadline: "2026-11-01" }), now)).toEqual({});
  });

  it("keeps known help kinds in the program's order and drops a solo request's team name", () => {
    expect(normalizeRequest(values({ helpKinds: ["Mock judging", "Lainnya", "Ideasi"], teamName: "Tim Dino" }))).toMatchObject({ helpKinds: ["Ideasi", "Mock judging"], teamName: "" });
    expect(techSupport.helpKinds).toHaveLength(8);
  });

  it("counts each team once among requests that were ever matched", () => {
    const row = (status: "new" | "matched" | "inProgress" | "closed", teamName: string | null, matched = true) =>
      ({ status, matchedAt: matched ? 1 : null, participation: teamName ? "team" as const : "solo" as const, teamName, competition: "Gemastik" });
    expect(techSupportKpis([row("matched", "Tim A"), row("closed", "tim  a"), row("inProgress", null), row("closed", "Tim B", false), row("new", "Tim C", false)]))
      .toEqual({ facilitated: 3, teams: 1, byStatus: { new: 1, matched: 1, inProgress: 1, closed: 2 } });
  });
});
