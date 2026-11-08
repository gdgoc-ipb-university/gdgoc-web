import { normalizeEmail } from "./cohort";
import { isEmail } from "./enrolment-import";

// Program & Development's registration results into Tech League teams (#183). Registration and payment stay on their
// Google Form this season; staff paste or upload its results (parseDelimited), say on the preview which column holds the
// captain's email and, if there is one, the payment status, and see every row matched to a team or listed as unmatched
// before anything is saved. A matched row marks the team registered; a payment answer that reads as paid marks it paid.

export const NO_COLUMN = -1;
/** Rows per `league.importRegistrations` call; the dialog sends a longer file in batches. */
export const registrationBatch = 200;
export type RegistrationColumns = { email: number; payment: number };

/** Likely columns from the header row: a captain's email ahead of any other email column, and a payment column. */
export function guessRegistrationColumns(headers: string[]): RegistrationColumns {
  const email = /e-?mail|surel/i;
  const captain = /ketua|kapten|captain|leader/i;
  const preferred = headers.findIndex((header) => email.test(header) && captain.test(header));
  return {
    email: preferred >= 0 ? preferred : headers.findIndex((header) => email.test(header)),
    payment: headers.findIndex((header) => /bayar|payment|lunas|transfer/i.test(header) && !/bukti|proof|upload|unggah/i.test(header)),
  };
}

/** Whether a payment answer says the team paid: "Lunas", "Sudah", "Paid", "Terverifikasi", "Ya", but not "Belum lunas" or "Menunggu". */
export function readsAsPaid(answer: string) {
  const text = answer.trim().toLowerCase();
  if (!text || /belum|tidak|unpaid|\bnot\b|pending|menunggu|ditolak|gagal|invalid/.test(text)) return false;
  return /lunas|sudah|paid|terverifikasi|verified|valid|diterima|confirmed|^ya$|^yes$|^true$|^✓$/.test(text);
}

export type TeamByCaptain = { code: string; name: string; captainEmail: string | null; registration: { paid: boolean } | null };
export type PlannedRegistration = { line: number; email: string; code: string; team: string; paid: boolean; change: "register" | "update" | "same" };
export type UnmatchedRow = { line: number; email: string; reason: string };

/**
 * Every data row (the header is line 1) matched by the captain's email to a team of the season, or listed as unmatched
 * with the reason. Without a payment column a row keeps the team's current payment status. A later row for the same
 * email is unmatched, so one team is never set twice by one file.
 */
export function planRegistrations(rows: string[][], columns: RegistrationColumns, teams: TeamByCaptain[]) {
  const byEmail = new Map(teams.filter((team) => team.captainEmail).map((team) => [normalizeEmail(team.captainEmail!), team]));
  const seen = new Set<string>();
  const matched: PlannedRegistration[] = [];
  const unmatched: UnmatchedRow[] = [];
  rows.forEach((cells, index) => {
    const line = index + 2;
    const email = normalizeEmail(cells[columns.email] ?? "");
    const team = byEmail.get(email);
    const reason = !isEmail(email) ? `Email “${email || "kosong"}” tidak valid.`
      : seen.has(email) ? "Email ini sudah muncul di baris sebelumnya."
      : !team ? "Tidak ada tim dengan kapten beremail ini."
      : null;
    if (isEmail(email)) seen.add(email);
    if (reason || !team) { unmatched.push({ line, email, reason: reason ?? "" }); return; }
    const paid = columns.payment === NO_COLUMN ? Boolean(team.registration?.paid) : readsAsPaid(cells[columns.payment] ?? "");
    const change = !team.registration ? "register" : team.registration.paid !== paid ? "update" : "same";
    matched.push({ line, email, code: team.code, team: team.name, paid, change });
  });
  return { matched, unmatched };
}
