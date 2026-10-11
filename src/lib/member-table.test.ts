import { describe, expect, it } from "vitest";
import { activeFilterCount, compareMembers, defaultListState, listQueryString, matchesFilters, noFilters, pageSlice, pageWindow, readListState } from "./member-table";

describe("members table", () => {
  it("cuts pages and pulls an out-of-range page back into the list", () => {
    expect(pageSlice(53, 1, 25)).toEqual({ page: 1, pageSize: 25, pageCount: 3, start: 0, end: 25 });
    expect(pageSlice(53, 3, 25)).toMatchObject({ page: 3, start: 50, end: 53 });
    expect(pageSlice(53, 9, 25)).toMatchObject({ page: 3, start: 50 });
    expect(pageSlice(0, 4, 25)).toMatchObject({ page: 1, pageCount: 1, start: 0, end: 0 });
    expect(pageSlice(10, 1, 5000)).toMatchObject({ pageSize: 100 });
    expect(pageSlice(10, Number.NaN, 0)).toMatchObject({ page: 1, pageSize: 25 });
  });

  it("shows the first, last, and nearby pages, never a gap for one page", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageWindow(1, 13)).toEqual([1, 2, 3, 4, 5, "gap", 13]);
    expect(pageWindow(4, 13)).toEqual([1, 2, 3, 4, 5, "gap", 13]);
    expect(pageWindow(7, 13)).toEqual([1, "gap", 6, 7, 8, "gap", 13]);
    expect(pageWindow(10, 13)).toEqual([1, "gap", 9, 10, 11, 12, 13]);
    expect(pageWindow(13, 13)).toEqual([1, "gap", 9, 10, 11, 12, 13]);
    for (let count = 1; count <= 30; count++) for (let page = 1; page <= count; page++) {
      const items = pageWindow(page, count);
      expect(items).toContain(page);
      expect(items.length).toBeLessThanOrEqual(7);
    }
  });

  it("sorts by join date or name, case- and accent-insensitively", () => {
    const rows = [{ fullName: "bima", joinedAt: 2 }, { fullName: "Ádi", joinedAt: 1 }, { fullName: "Citra", joinedAt: 3 }];
    expect([...rows].sort(compareMembers("joined-desc")).map((row) => row.fullName)).toEqual(["Citra", "bima", "Ádi"]);
    expect([...rows].sort(compareMembers("joined-asc")).map((row) => row.fullName)).toEqual(["Ádi", "bima", "Citra"]);
    expect([...rows].sort(compareMembers("name-asc")).map((row) => row.fullName)).toEqual(["Ádi", "bima", "Citra"]);
    expect([...rows].sort(compareMembers("name-desc")).map((row) => row.fullName)).toEqual(["Citra", "bima", "Ádi"]);
  });

  it("round-trips the list state through the URL and drops unknown values", () => {
    const state = {
      search: "budi", sort: "name-asc" as const, page: 3, pageSize: 50,
      filters: { access: ["admin" as const], community: ["core" as const, "bod" as const], divisions: ["Media & Creative"], status: "active" as const, tag: "unconfirmed" as const, reviewer: true },
    };
    expect(listQueryString(state)).toBe("?q=budi&access=admin&community=core&community=bod&division=Media+%26+Creative&status=active&tag=unconfirmed&reviewer=1&sort=name-asc&page=3&size=50");
    expect(readListState(new URLSearchParams(listQueryString(state)))).toEqual(state);
    expect(listQueryString(defaultListState)).toBe("");
    expect(readListState(new URLSearchParams("access=root&division=Sales&status=gone&tag=x&reviewer=yes&sort=random&page=-2&size=7"))).toEqual(defaultListState);
  });

  it("matches AND across facets and OR within one, and counts active facets", () => {
    const member = { access: "member" as const, memberType: "core", division: "Technical", active: true, tagConfirmed: false, reviewer: false };
    expect(matchesFilters(member, noFilters)).toBe(true);
    expect(matchesFilters(member, { ...noFilters, community: ["core", "bod"], divisions: ["Technical"] })).toBe(true);
    expect(matchesFilters(member, { ...noFilters, community: ["core"], access: ["admin"] })).toBe(false);
    expect(matchesFilters(member, { ...noFilters, tag: "unconfirmed" })).toBe(true);
    expect(matchesFilters({ ...member, memberType: "member" }, { ...noFilters, tag: "unconfirmed" })).toBe(false);
    expect(matchesFilters({ ...member, memberType: null }, { ...noFilters, community: ["member"] })).toBe(true);
    expect(activeFilterCount({ ...noFilters, community: ["core", "bod"], status: "deactivated", reviewer: true })).toBe(3);
  });
});
