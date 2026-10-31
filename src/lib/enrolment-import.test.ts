import { describe, expect, it } from "vitest";
import { catalystCohort } from "./cohort";
import { SKIP, guessColumns, guessRoles, isEmail, parseDelimited, planImport } from "./enrolment-import";

const roles = catalystCohort.roles;

describe("reading the oprec results", () => {
  it("reads CSV with a byte order mark, quoted separators, doubled quotes, line breaks in cells, and CRLF", () => {
    expect(parseDelimited('﻿Email,Nama,Motivasi\r\nrania@gmail.com,"Putri, Rania","Kata ""halo""\nbaris dua"\r\n\r\n')).toEqual([
      ["Email", "Nama", "Motivasi"], ["rania@gmail.com", "Putri, Rania", 'Kata "halo"\nbaris dua'],
    ]);
  });

  it("reads cells pasted from Google Sheets as tabs, and semicolon CSV from Excel", () => {
    expect(parseDelimited("Email\tNama\nbudi@gmail.com\tBudi, S.Kom")).toEqual([["Email", "Nama"], ["budi@gmail.com", "Budi, S.Kom"]]);
    expect(parseDelimited("Email;Nama\nbudi@gmail.com;Budi")).toEqual([["Email", "Nama"], ["budi@gmail.com", "Budi"]]);
  });

  it("guesses the email, name and role columns from Google Form headers", () => {
    expect(guessColumns(["Timestamp", "Email Address", "Nama Lengkap", "Asal Sekolah/Kampus", "Pilih peran (track)"])).toEqual({ email: 1, name: 2, role: 4 });
    expect(guessColumns(["Timestamp", "Skor"])).toEqual({ email: -1, name: -1, role: -1 });
  });

  it("maps each distinct role answer to the one role it names, and leaves the rest to staff", () => {
    expect(guessRoles(["Hacker (Software Engineer)", "hipster - UI/UX", "Hustler", "Hacker (Software Engineer)", "Hacker atau Hipster", ""], roles)).toEqual({
      "Hacker (Software Engineer)": "hacker", "hipster - UI/UX": "hipster", "Hustler": "hustler", "Hacker atau Hipster": SKIP,
    });
  });

  it("checks emails", () => {
    expect(isEmail("rania@gmail.com")).toBe(true);
    expect(isEmail("rania@gmail")).toBe(false);
    expect(isEmail("rania gmail.com")).toBe(false);
  });
});

describe("planning an import", () => {
  const columns = { email: 0, name: 1, role: 2 };
  const roleOf = { Hacker: "hacker", Hipster: "hipster", Ragu: SKIP };

  it("adds new emails, updates changed names or roles, and leaves identical rows alone, matching emails case-insensitively", () => {
    const roster = [{ email: "budi@gmail.com", name: "Budi", role: "hacker" }, { email: "citra@gmail.com", name: "Citra", role: "hacker" }];
    const { planned, problems } = planImport([
      ["Rania@Gmail.com ", "Rania  Putri", "Hacker"], ["budi@gmail.com", "Budi", "Hacker"], ["CITRA@gmail.com", "Citra", "Hipster"],
    ], columns, roleOf, roles, roster);
    expect(problems).toEqual([]);
    expect(planned).toEqual([
      { line: 2, email: "rania@gmail.com", name: "Rania Putri", role: "hacker", change: "add" },
      { line: 3, email: "budi@gmail.com", name: "Budi", role: "hacker", change: "same" },
      { line: 4, email: "citra@gmail.com", name: "Citra", role: "hipster", change: "update" },
    ]);
  });

  it("skips bad emails, repeated emails, empty names, and unmapped roles, with the line and the reason", () => {
    const { planned, problems } = planImport([
      ["bukan-email", "A", "Hacker"], ["a@gmail.com", "", "Hacker"], ["b@gmail.com", "B", "Ragu"], ["c@gmail.com", "C", "Lainnya"],
      ["d@gmail.com", "D", "Hipster"], ["D@gmail.com", "D lagi", "Hacker"],
    ], columns, roleOf, roles, []);
    expect(planned.map((row) => row.email)).toEqual(["d@gmail.com"]);
    expect(problems.map((problem) => problem.line)).toEqual([2, 3, 4, 5, 7]);
    expect(problems[0].reason).toContain("tidak valid");
    expect(problems[1].reason).toBe("Nama kosong.");
    expect(problems[2].reason).toContain("Ragu");
    expect(problems[4].reason).toContain("sudah muncul");
  });
});
