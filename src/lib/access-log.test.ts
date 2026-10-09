import { describe, expect, it } from "vitest";
import { accessSentence, tagLabel, type AccessEntry } from "./access-log";

const entry = (change: AccessEntry["change"], from: string, to: string, extra: Partial<AccessEntry> = {}): AccessEntry =>
  ({ change, from, to, actor: "Aldio Lisafron", target: "Rania Putri", assignment: null, ...extra });

describe("access log sentences", () => {
  it("describes each change in Indonesian, both ways", () => {
    expect([
      entry("role", "member", "admin"), entry("role", "admin", "member"),
      entry("reviewer", "off", "on"), entry("reviewer", "on", "off"),
      entry("active", "active", "deactivated"), entry("active", "deactivated", "active"),
      entry("memberType", "member", "bod:Technical"),
      entry("assignmentReviewer", "off", "on", { assignment: { title: "Proyek Akhir" } }), entry("assignmentReviewer", "on", "off", { assignment: { title: null } }),
    ].map(accessSentence)).toEqual([
      "Aldio Lisafron menjadikan Rania Putri admin.",
      "Aldio Lisafron menurunkan Rania Putri dari admin menjadi member.",
      "Aldio Lisafron memberi Rania Putri akses peninjau Apresiasi.",
      "Aldio Lisafron mencabut akses peninjau Apresiasi dari Rania Putri.",
      "Aldio Lisafron menonaktifkan akun Rania Putri.",
      "Aldio Lisafron mengaktifkan kembali akun Rania Putri.",
      "Aldio Lisafron mengubah peran komunitas Rania Putri dari Member menjadi BoD · Technical.",
      "Aldio Lisafron menunjuk Rania Putri sebagai penilai tugas “Proyek Akhir”.",
      "Aldio Lisafron mencabut Rania Putri dari penilai tugas yang sudah dihapus.",
    ]);
  });

  it("names deleted accounts without their name", () => {
    expect(accessSentence(entry("deleted", "member", "deleted", { target: null }))).toBe("Aldio Lisafron menghapus akun seorang member atas permintaannya.");
    expect(accessSentence(entry("deleted", "admin", "deleted", { target: null }))).toBe("Aldio Lisafron menghapus akun seorang admin atas permintaannya.");
    expect(accessSentence(entry("active", "active", "deactivated", { actor: null, target: null }))).toBe("Pengurus yang akunnya sudah dihapus menonaktifkan akun anggota yang akunnya sudah dihapus.");
  });

  it("reads stored community tags", () => {
    expect([tagLabel("member"), tagLabel("core:Media & Creative"), tagLabel("bod"), tagLabel("unknown")]).toEqual(["Member", "Core Team · Media & Creative", "BoD", "Member"]);
  });
});
