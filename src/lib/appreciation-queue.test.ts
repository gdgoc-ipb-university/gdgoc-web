import { describe, expect, it } from "vitest";
import { isQueueFilterActive, matchesQueueFilter } from "./appreciation";

const record = { ownerName: "Akun Google", values: { achievement: "Juara 1 Lomba UI/UX", fullName: "Sári Pengujian", level: "Nasional", campus: "IPB University" } };
const none = { search: "", level: "", campus: "" };

describe("review queue filter", () => {
  it("is inactive until a field has content", () => {
    expect(isQueueFilterActive(none)).toBe(false);
    expect(isQueueFilterActive({ ...none, search: "   " })).toBe(false);
    expect(isQueueFilterActive({ ...none, level: "Nasional" })).toBe(true);
  });

  it("matches the achievement or either sender name, ignoring case, accents and extra spaces", () => {
    expect(matchesQueueFilter(record, { ...none, search: "lomba  ui" })).toBe(true);
    expect(matchesQueueFilter(record, { ...none, search: "sari" })).toBe(true);
    expect(matchesQueueFilter(record, { ...none, search: "akun google" })).toBe(true);
    expect(matchesQueueFilter(record, { ...none, search: "hackathon" })).toBe(false);
  });

  it("requires the exact level and a campus substring, combined with the search", () => {
    expect(matchesQueueFilter(record, { ...none, level: "Nasional", campus: "ipb" })).toBe(true);
    expect(matchesQueueFilter(record, { ...none, level: "Regional" })).toBe(false);
    expect(matchesQueueFilter(record, { ...none, campus: "pakuan" })).toBe(false);
    expect(matchesQueueFilter(record, { search: "juara", level: "Nasional", campus: "bogor" })).toBe(false);
  });
});
