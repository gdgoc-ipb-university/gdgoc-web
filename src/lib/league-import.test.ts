import { describe, expect, it } from "vitest";
import { parseDelimited } from "./enrolment-import";
import { NO_COLUMN, guessRegistrationColumns, planRegistrations, readsAsPaid, type TeamByCaptain } from "./league-import";

const teams: TeamByCaptain[] = [
  { code: "ABC234", name: "Tim Hujan", captainEmail: "rania@example.com", registration: null },
  { code: "XYZ789", name: "Tim Pelangi", captainEmail: "bima@example.com", registration: { paid: false } },
  { code: "KMN456", name: "Tim Kabut", captainEmail: "sari@example.com", registration: { paid: true } },
  { code: "PQR345", name: "Tim Tanpa Kapten", captainEmail: null, registration: { paid: true } },
];

describe("registration import", () => {
  it("guesses the captain's email ahead of other emails, and a payment column that is not the proof upload", () => {
    expect(guessRegistrationColumns(["Timestamp", "Email Address", "Nama Tim", "Email Ketua", "Bukti Pembayaran", "Status Pembayaran"])).toEqual({ email: 3, payment: 5 });
    expect(guessRegistrationColumns(["Email", "Nama"])).toEqual({ email: 0, payment: NO_COLUMN });
  });

  it("reads payment answers", () => {
    for (const paid of ["Lunas", "Sudah bayar", "PAID", "Terverifikasi", "ya", "✓"]) expect(readsAsPaid(paid), paid).toBe(true);
    for (const unpaid of ["", "Belum lunas", "Menunggu verifikasi", "Tidak", "not paid", "Invalid", "Pending"]) expect(readsAsPaid(unpaid), unpaid).toBe(false);
  });

  it("matches rows by the captain's email and lists every row it cannot match", () => {
    const rows = parseDelimited([
      "Email Ketua\tStatus Pembayaran",
      " Rania@Example.com \tLunas",
      "bima@example.com\tBelum",
      "sari@example.com\tLunas",
      "anggota@example.com\tLunas",
      "bukan email\tLunas",
      "rania@example.com\tBelum",
    ].join("\n")).slice(1);
    const plan = planRegistrations(rows, { email: 0, payment: 1 }, teams);
    expect(plan.matched).toEqual([
      { line: 2, email: "rania@example.com", code: "ABC234", team: "Tim Hujan", paid: true, change: "register" },
      { line: 3, email: "bima@example.com", code: "XYZ789", team: "Tim Pelangi", paid: false, change: "same" },
      { line: 4, email: "sari@example.com", code: "KMN456", team: "Tim Kabut", paid: true, change: "same" },
    ]);
    expect(plan.unmatched).toEqual([
      { line: 5, email: "anggota@example.com", reason: "Tidak ada tim dengan kapten beremail ini." },
      { line: 6, email: "bukan email", reason: "Email “bukan email” tidak valid." },
      { line: 7, email: "rania@example.com", reason: "Email ini sudah muncul di baris sebelumnya." },
    ]);
  });

  it("keeps each team's payment status without a payment column", () => {
    const plan = planRegistrations([["rania@example.com"], ["sari@example.com"]], { email: 0, payment: NO_COLUMN }, teams);
    expect(plan.matched.map((row) => [row.paid, row.change])).toEqual([[false, "register"], [true, "same"]]);
  });
});
