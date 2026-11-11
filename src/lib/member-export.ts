import { roleLabels, toJakartaInput } from "./assignment";
import { toCsv } from "./assignment-export";
import { memberTypeLabels, type MemberType } from "./onboarding";

/** One member as the owners-only export query returns it. */
export type MemberExportRow = {
  fullName: string; email: string; campus: string; studyProgram: string; instagram: string; instagramChangedAt: number | null; memberType: MemberType | null; division: string | null;
  role: keyof typeof roleLabels; active: boolean; reviewer: boolean; joinedAt: number;
};

const wib = (at: number) => `${toJakartaInput(at).replace("T", " ")} WIB`;

/** The members CSV, sorted by name, with the same encoding and formula-safe cells as the submissions export. */
export function membersCsv(rows: MemberExportRow[]) {
  const header = ["Nama", "Email", "Sekolah/kampus", "Jurusan/program studi", "Instagram", "Instagram diubah (WIB)", "Peran komunitas", "Divisi", "Akses", "Status", "Peninjau apresiasi", "Bergabung (WIB)"];
  const body = [...rows].sort((a, b) => a.fullName.localeCompare(b.fullName, "id")).map((row) => [
    row.fullName, row.email, row.campus, row.studyProgram, row.instagram, row.instagramChangedAt ? wib(row.instagramChangedAt) : "", row.memberType ? memberTypeLabels[row.memberType] : "", row.division ?? "",
    roleLabels[row.role], row.active ? "Aktif" : "Nonaktif", row.reviewer ? "Ya" : "Tidak", wib(row.joinedAt),
  ]);
  return toCsv([header, ...body]);
}

export function membersFileName(now: number) {
  return `anggota-gdgoc-ipb-${toJakartaInput(now).slice(0, 10)}.csv`;
}
