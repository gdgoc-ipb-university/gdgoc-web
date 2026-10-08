import { describe, expect, it } from "vitest";
import { membersCsv, membersFileName, type MemberExportRow } from "./member-export";

const joinedAt = Date.UTC(2026, 9, 1, 2, 0); // 09:00 WIB
const row = (overrides: Partial<MemberExportRow> = {}): MemberExportRow => ({
  fullName: "Budi", email: "budi@example.com", campus: "IPB University", studyProgram: "Ilmu Komputer", memberType: "member", division: null,
  role: "member", active: true, reviewer: false, joinedAt, ...overrides,
});

describe("members export", () => {
  it("writes one row per member, sorted by name, with labels and WIB dates", () => {
    const csv = membersCsv([row({ fullName: "Citra", memberType: "core", division: "Technical", role: "admin", reviewer: true }), row({ active: false }), row({ fullName: "=Agus", memberType: null })]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.replace(/^﻿/, "").trimEnd().split("\r\n")).toEqual([
      "Nama,Email,Kampus,Program studi,Peran komunitas,Divisi,Akses,Status,Peninjau apresiasi,Bergabung (WIB)",
      "'=Agus,budi@example.com,IPB University,Ilmu Komputer,,,Member,Aktif,Tidak,2026-10-01 09:00 WIB",
      "Budi,budi@example.com,IPB University,Ilmu Komputer,Member,,Member,Nonaktif,Tidak,2026-10-01 09:00 WIB",
      "Citra,budi@example.com,IPB University,Ilmu Komputer,Core Team,Technical,Admin,Aktif,Ya,2026-10-01 09:00 WIB",
    ]);
  });

  it("names the file after the WIB date", () => {
    expect(membersFileName(Date.UTC(2026, 9, 1, 18, 0))).toBe("anggota-gdgoc-ipb-2026-10-02.csv");
  });
});
