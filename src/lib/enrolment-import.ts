import { normalizeEmail, type CohortRole } from "./cohort";

// Turning an oprec results sheet into enrolments: parse the CSV or the cells pasted from Google Sheets, let staff say
// which columns hold the email, name and role and which answers mean which role, then check every row before import.

/**
 * Rows of cells from CSV, semicolon-separated, or tab-separated text (Google Sheets copies cells as tabs). Quoted cells
 * may hold the separator, doubled quotes and line breaks. The separator is read from the first line; blank lines go.
 */
export function parseDelimited(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const separator = firstLine.includes("\t") ? "\t" : (firstLine.split(";").length > firstLine.split(",").length ? ";" : ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === separator) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((cells) => cells.map((value) => value.trim())).filter((cells) => cells.some(Boolean));
}

export type ColumnMap = { email: number; name: number; role: number };

const columnHints: Record<keyof ColumnMap, RegExp> = {
  email: /e-?mail|surel/i,
  name: /nama|name/i,
  role: /peran|role|track|posisi|jalur/i,
};

/** The likely column for each field from the header row, or -1. Each column is used once, email first. */
export function guessColumns(headers: string[]): ColumnMap {
  const used = new Set<number>();
  const pick = (field: keyof ColumnMap) => {
    const index = headers.findIndex((header, i) => !used.has(i) && columnHints[field].test(header));
    if (index >= 0) used.add(index);
    return index;
  };
  const email = pick("email");
  const role = pick("role");
  return { email, name: pick("name"), role };
}

/** Sentinel for an answer that should not be imported. */
export const SKIP = "";

/** For each distinct answer in the role column, the role whose key or name it mentions, or SKIP. */
export function guessRoles(answers: string[], roles: CohortRole[]): Record<string, string> {
  const guesses: Record<string, string> = {};
  for (const answer of new Set(answers.map((value) => value.trim()).filter(Boolean))) {
    const text = answer.toLowerCase();
    const matches = roles.filter((role) => text.includes(role.key) || text.includes(role.name.toLowerCase()));
    guesses[answer] = matches.length === 1 ? matches[0].key : SKIP;
  }
  return guesses;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string) => emailPattern.test(value);

export const importLimits = { name: 120, rows: 1000 } as const;
/** Rows per `cohorts.importEnrolments` call; the dialog sends a longer file in batches. */
export const importBatch = 200;

export type ImportRow = { email: string; name: string; role: string };
export type PlannedRow = ImportRow & { line: number; change: "add" | "update" | "same" };
export type ImportProblem = { line: number; reason: string };

/**
 * Checks every data row (line numbers count the header as line 1) against the mapping and the current roster. Rows with
 * a bad email, no name, a skipped or unknown role, or an email seen earlier in the file are problems and are not imported.
 */
export function planImport(rows: string[][], columns: ColumnMap, roleOf: Record<string, string>, roles: CohortRole[], roster: { email: string; name: string; role: string }[]) {
  const known = new Map(roster.map((row) => [row.email, row]));
  const keys = new Set(roles.map((role) => role.key));
  const seen = new Set<string>();
  const planned: PlannedRow[] = [];
  const problems: ImportProblem[] = [];
  rows.forEach((cells, index) => {
    const line = index + 2;
    const email = normalizeEmail(cells[columns.email] ?? "");
    const name = (cells[columns.name] ?? "").replace(/\s+/g, " ").trim();
    const answer = (cells[columns.role] ?? "").trim();
    const role = roleOf[answer] ?? SKIP;
    const problem = !isEmail(email) ? `Email “${email || "kosong"}” tidak valid.`
      : seen.has(email) ? `Email ${email} sudah muncul di baris sebelumnya.`
      : !name ? "Nama kosong."
      : name.length > importLimits.name ? `Nama lebih dari ${importLimits.name} karakter.`
      : !keys.has(role) ? `Peran “${answer || "kosong"}” tidak dipetakan ke peran mana pun.`
      : null;
    if (isEmail(email)) seen.add(email);
    if (problem) { problems.push({ line, reason: problem }); return; }
    const current = known.get(email);
    planned.push({ line, email, name, role, change: !current ? "add" : current.name !== name || current.role !== role ? "update" : "same" });
  });
  return { planned, problems };
}
