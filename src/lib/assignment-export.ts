import { matchesRubric, toJakartaInput, type RubricCriterion, type RubricScore } from "./assignment";

/** One submission as the export query returns it. `email` is empty unless the viewer is an owner. */
export type ExportRow = {
  name: string; email: string; campus: string; submittedAt: number; late: boolean;
  score: number | null; breakdown: RubricScore[] | null; feedback: string | null; reviewedAt: number | null; reviewerName: string | null; stale: boolean;
  fileNames: string[];
};

/** A text cell that a spreadsheet would read as a formula gets a leading apostrophe, so member-typed names cannot run as formulas. */
export function csvCell(value: string | number | null) {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 with a byte order mark and CRLF line ends, so Excel opens Indonesian names and line breaks cleanly. */
export function toCsv(rows: (string | number | null)[][]) {
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const wib = (timestamp: number | null) => timestamp === null ? "" : `${toJakartaInput(timestamp).replace("T", " ")} WIB`;

function reviewStatus(row: ExportRow) {
  if (row.reviewedAt === null) return "Belum dinilai";
  return row.stale ? "Diperbarui setelah dinilai" : "Dinilai";
}

/**
 * The export for one assignment, sorted by name. Each current rubric criterion gets its own points column, filled when the
 * review was scored against the same criteria; "Rincian rubrik" always holds the breakdown as it was scored.
 */
export function submissionsCsv(assignment: { maxScore: number; rubric: RubricCriterion[] | null }, rows: ExportRow[], includesEmail: boolean) {
  const rubric = assignment.rubric?.length ? assignment.rubric : null;
  const header = [
    "Nama", ...(includesEmail ? ["Email"] : []), "Kampus", "Dikirim (WIB)", "Terlambat", "Status penilaian", "Nilai", "Nilai maksimal",
    ...(rubric ? rubric.map((criterion) => `${criterion.name} (maks ${criterion.max})`) : []), ...(rubric ? ["Rincian rubrik"] : []),
    "Umpan balik", "Penilai", "Dinilai (WIB)", "Lampiran",
  ];
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, "id"));
  const body = sorted.map((row) => {
    const current = rubric && row.breakdown && matchesRubric(row.breakdown, rubric) ? row.breakdown : null;
    return [
      row.name, ...(includesEmail ? [row.email] : []), row.campus, wib(row.submittedAt), row.late ? "Ya" : "Tidak", reviewStatus(row), row.score, assignment.maxScore,
      ...(rubric ? rubric.map((_, index) => current ? current[index].points : null) : []),
      ...(rubric ? [row.breakdown?.map((entry) => `${entry.name}: ${entry.points}/${entry.max}`).join("; ") ?? ""] : []),
      row.feedback ?? "", row.reviewerName ?? "", wib(row.reviewedAt), row.fileNames.join("; "),
    ];
  });
  return toCsv([header, ...body]);
}

export function exportFileName(slug: string | undefined, now: number) {
  return `tugas-${slug || "kiriman"}-${toJakartaInput(now).slice(0, 10)}.csv`;
}
