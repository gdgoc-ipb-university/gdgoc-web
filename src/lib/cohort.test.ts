import { describe, expect, it } from "vitest";
import { catalystCohort, inCohortRoles, normalizeCohort, normalizeEmail, validateCohort } from "./cohort";

describe("cohorts", () => {
  it("compares emails trimmed and lowercased", () => {
    expect(normalizeEmail("  Rania.Putri@Gmail.COM ")).toBe("rania.putri@gmail.com");
  });

  it("tidies names, role keys and the slug", () => {
    expect(normalizeCohort({ slug: "", name: "  GDGoC   Catalyst 2026/27 ", roles: [{ key: " Hacker ", name: " Hacker  Utama " }] })).toEqual({
      slug: "gdgoc-catalyst-2026-27", name: "GDGoC Catalyst 2026/27", roles: [{ key: "hacker", name: "Hacker Utama" }],
    });
  });

  it("accepts the Catalyst defaults", () => {
    expect(validateCohort(normalizeCohort(catalystCohort))).toEqual({});
    expect(catalystCohort.roles.map((role) => role.key)).toEqual(["hacker", "hipster", "hustler"]);
  });

  it("refuses missing names, bad or repeated role keys, too many roles, and targets outside 0–100%", () => {
    const base = normalizeCohort(catalystCohort);
    expect(validateCohort({ ...base, name: "" }).name).toBeDefined();
    expect(validateCohort({ ...base, roles: [] }).roles).toBeDefined();
    expect(validateCohort({ ...base, roles: [{ key: "1st", name: "Satu" }] }).roles).toBeDefined();
    expect(validateCohort({ ...base, roles: [{ key: "hacker", name: "A" }, { key: "hacker", name: "B" }] }).roles).toBe("Kode peran tidak boleh sama.");
    expect(validateCohort({ ...base, roles: Array.from({ length: 9 }, (_, i) => ({ key: `r${i}`, name: `Peran ${i}` })) }).roles).toBeDefined();
    expect(validateCohort({ ...base, attendanceTarget: 0 }).attendanceTarget).toBeDefined();
    expect(validateCohort({ ...base, attendanceTarget: 1.2 }).attendanceTarget).toBeDefined();
    expect(validateCohort({ ...base, attendanceTarget: 1 })).toEqual({});
  });

  it("gives an assignment without roles to every role", () => {
    expect(inCohortRoles({}, "hacker")).toBe(true);
    expect(inCohortRoles({ cohortRoles: [] }, "hustler")).toBe(true);
    expect(inCohortRoles({ cohortRoles: ["hacker", "hipster"] }, "hipster")).toBe(true);
    expect(inCohortRoles({ cohortRoles: ["hacker"] }, "hustler")).toBe(false);
  });
});
