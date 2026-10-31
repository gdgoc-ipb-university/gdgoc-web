import { toJakartaInput } from "./assignment";
import { toCsv } from "./assignment-export";

// The chapter's members live on gdg.community.dev, which runs on Bevy. Its "Import members" takes a CSV in its own
// template (email, first_name, last_name); this builds that file from a cohort's active participants.

/** Bevy's first and last name from one full name: the first word, then the rest. A one-word name has no last name. */
export function splitName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return { first: words[0] ?? "", last: words.slice(1).join(" ") };
}

/** Bevy's member import file, sorted by name, with the header row of its template. */
export function bevyCsv(rows: { email: string; name: string }[]) {
  const body = [...rows].sort((a, b) => a.name.localeCompare(b.name, "id")).map((row) => {
    const { first, last } = splitName(row.name);
    return [row.email, first, last];
  });
  return toCsv([["email", "first_name", "last_name"], ...body]);
}

export function bevyFileName(slug: string, now: number) {
  return `bevy-${slug}-${toJakartaInput(now).slice(0, 10)}.csv`;
}

/** What to write in Bevy's "How did they consent?" for this program. */
export const bevyConsentNote = (program: string) => `Menyetujui bergabung sebagai member GDG on Campus IPB University lewat form pendaftaran ${program}.`;
