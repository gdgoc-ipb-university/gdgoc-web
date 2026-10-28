import { memberTagLabel, type MemberType } from "./onboarding";

export type AccessEntry = {
  change: "role" | "reviewer" | "active" | "memberType" | "assignmentReviewer" | "deleted" | "tagConfirmed" | "tagSelfChanged" | "enrolmentRole" | "enrolmentStatus" | "enrolmentEmail";
  from: string; to: string; actor: string | null; target: string | null; assignment: { title: string | null } | null;
  cohort?: { name: string | null; roles: { key: string; name: string }[] } | null;
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
  const cohort = entry.cohort?.name ?? "program yang sudah dihapus";
  const participant = entry.target ?? "peserta yang datanya sudah dihapus";
  const role = (key: string) => entry.cohort?.roles.find((item) => item.key === key)?.name ?? key;
  switch (entry.change) {
    case "role": return entry.to === "admin" ? `${actor} menjadikan ${target} admin.` : `${actor} menurunkan ${target} dari admin menjadi member.`;
    case "reviewer": return entry.to === "on" ? `${actor} memberi ${target} akses peninjau Apresiasi.` : `${actor} mencabut akses peninjau Apresiasi dari ${target}.`;
    case "active": return entry.to === "deactivated" ? `${actor} menonaktifkan akun ${target}.` : `${actor} mengaktifkan kembali akun ${target}.`;
    case "memberType": return `${actor} mengubah peran komunitas ${target} dari ${tagLabel(entry.from)} menjadi ${tagLabel(entry.to)}.`;
    case "assignmentReviewer": return entry.to === "on" ? `${actor} menunjuk ${target} sebagai penilai ${task}.` : `${actor} mencabut ${target} dari penilai ${task}.`;
    case "tagConfirmed": return `${actor} mengonfirmasi peran komunitas ${target}: ${tagLabel(entry.to)}.`;
    case "tagSelfChanged": return `${target} mengubah peran komunitasnya sendiri dari ${tagLabel(entry.from)} menjadi ${tagLabel(entry.to)}, jadi perlu dikonfirmasi lagi.`;
    case "deleted": return `${actor} menghapus akun ${entry.from === "admin" ? "seorang admin" : "seorang member"} atas permintaannya.`;
    case "enrolmentRole": return `${actor} mengubah peran ${participant} di ${cohort} dari ${role(entry.from)} menjadi ${role(entry.to)}.`;
    case "enrolmentStatus": return entry.to === "withdrawn" ? `${actor} mencatat ${participant} mengundurkan diri dari ${cohort}.` : `${actor} mengaktifkan kembali ${participant} sebagai peserta ${cohort}.`;
    case "enrolmentEmail": return `${actor} memperbaiki email pendaftaran ${participant} di ${cohort}.`;
  }
}
