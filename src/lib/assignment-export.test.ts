import { describe, expect, it } from "vitest";
import { csvCell, exportFileName, submissionsCsv, toCsv, type ExportRow } from "./assignment-export";

const submittedAt = Date.UTC(2026, 9, 1, 9, 30); // 16:30 WIB
const row = (overrides: Partial<ExportRow> = {}): ExportRow => ({
  name: "Budi", email: "budi@example.com", campus: "IPB University", submittedAt, late: false,
  score: null, breakdown: null, feedback: null, reviewedAt: null, reviewerName: null, stale: false, fileNames: [], ...overrides,
});
const lines = (csv: string) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

describe("assignment export", () => {
  it("quotes separators and defuses cells a spreadsheet would run as formulas", () => {
    expect(csvCell("Budi, S.Kom")).toBe('"Budi, S.Kom"');
    expect(csvCell('Kata "bagus"')).toBe('"Kata ""bagus"""');
    expect(csvCell("baris\nbaru")).toBe('"baris\nbaru"');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+62 812")).toBe("'+62 812");
    expect(csvCell(-1)).toBe("-1");
    expect(csvCell(null)).toBe("");
    expect(toCsv([["a", 1]])).toBe("﻿a,1\r\n");
  });

  it("writes one row per submission, sorted by name, with WIB times and review status", () => {
    const csv = submissionsCsv({ maxScore: 100, rubric: null }, [
      row({ name: "Citra", late: true, score: 90, feedback: "Rapi.", reviewedAt: submittedAt + 3600000, reviewerName: "Admin", fileNames: ["a.pdf", "b.png"] }),
      row({ name: "Agus", reviewedAt: submittedAt - 1, stale: true, score: 70 }),
      row(),
    ], true);
    expect(lines(csv)).toEqual([
      "Nama,Email,Kampus,Dikirim (WIB),Terlambat,Status penilaian,Nilai,Nilai maksimal,Umpan balik,Penilai,Dinilai (WIB),Lampiran",
      "Agus,budi@example.com,IPB University,2026-10-01 16:30 WIB,Tidak,Diperbarui setelah dinilai,70,100,,,2026-10-01 16:29 WIB,",
      "Budi,budi@example.com,IPB University,2026-10-01 16:30 WIB,Tidak,Belum dinilai,,100,,,,",
      "Citra,budi@example.com,IPB University,2026-10-01 16:30 WIB,Ya,Dinilai,90,100,Rapi.,Admin,2026-10-01 17:30 WIB,a.pdf; b.png",
    ]);
  });

  it("leaves out emails unless included, and adds rubric columns that only fill for the current criteria", () => {
    const rubric = [{ name: "Ide", max: 40 }, { name: "Eksekusi", max: 60 }];
    const current = [{ name: "Ide", max: 40, points: 30 }, { name: "Eksekusi", max: 60, points: 50 }];
    const older = [{ name: "Konsep", max: 50, points: 45 }, { name: "Eksekusi", max: 50, points: 40 }];
    const csv = submissionsCsv({ maxScore: 100, rubric }, [row({ name: "A", score: 80, breakdown: current, reviewedAt: submittedAt }), row({ name: "B", score: 85, breakdown: older, reviewedAt: submittedAt })], false);
    const [header, a, b] = lines(csv);
    expect(header).toBe("Nama,Kampus,Dikirim (WIB),Terlambat,Status penilaian,Nilai,Nilai maksimal,Ide (maks 40),Eksekusi (maks 60),Rincian rubrik,Umpan balik,Penilai,Dinilai (WIB),Lampiran");
    expect(a).toContain(",80,100,30,50,Ide: 30/40; Eksekusi: 50/60,");
    expect(b).toContain(",85,100,,,Konsep: 45/50; Eksekusi: 40/50,");
    expect(csv).not.toContain("budi@example.com");
  });

  it("names the file after the slug and the WIB date", () => {
    expect(exportFileName("landing-page", Date.UTC(2026, 9, 1, 18, 0))).toBe("tugas-landing-page-2026-10-02.csv");
    expect(exportFileName(undefined, Date.UTC(2026, 9, 1, 0, 0))).toBe("tugas-kiriman-2026-10-01.csv");
  });
});
