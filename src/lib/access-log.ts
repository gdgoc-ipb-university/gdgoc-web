import { memberTagLabel, type MemberType } from "./onboarding";

export type AccessEntry = {
  change: "role" | "reviewer" | "active" | "memberType" | "assignmentReviewer" | "deleted";
  from: string; to: string; actor: string | null; target: string | null; assignment: { title: string | null } | null;
};

/** A community tag as the log stores it ("core:Technical") in words ("Core Team · Technical"). */
export function tagLabel(value: string) {
  const [type, ...division] = value.split(":");
  return memberTagLabel((["member", "core", "bod"].includes(type) ? type : "member") as MemberType, division.join(":") || null);
}

/** One log row as a sentence, e.g. "Aldio Lisafron menjadikan Rania Putri admin." Deleted accounts have no name left. */
export function accessSentence(entry: AccessEntry) {
  const actor = entry.actor ?? "Pengurus yang akunnya sudah dihapus";
  const target = entry.target ?? "anggota yang akunnya sudah dihapus";
  const task = entry.assignment?.title ? `tugas “${entry.assignment.title}”` : "tugas yang sudah dihapus";
  switch (entry.change) {
    case "role": return entry.to === "admin" ? `${actor} menjadikan ${target} admin.` : `${actor} menurunkan ${target} dari admin menjadi member.`;
    case "reviewer": return entry.to === "on" ? `${actor} memberi ${target} akses peninjau Apresiasi.` : `${actor} mencabut akses peninjau Apresiasi dari ${target}.`;
    case "active": return entry.to === "deactivated" ? `${actor} menonaktifkan akun ${target}.` : `${actor} mengaktifkan kembali akun ${target}.`;
    case "memberType": return `${actor} mengubah peran komunitas ${target} dari ${tagLabel(entry.from)} menjadi ${tagLabel(entry.to)}.`;
    case "assignmentReviewer": return entry.to === "on" ? `${actor} menunjuk ${target} sebagai penilai ${task}.` : `${actor} mencabut ${target} dari penilai ${task}.`;
    case "deleted": return `${actor} menghapus akun ${entry.from === "admin" ? "seorang admin" : "seorang member"} atas permintaannya.`;
  }
}
