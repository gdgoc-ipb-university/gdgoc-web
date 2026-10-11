// The members table: which filters and sorts exist, how a page is cut, and how the list state lives in the URL.
// Shared by `dashboard.members` (Convex) and the members page, so both read the same values.

import { divisions } from "./onboarding";

/**
 * The members filter: AND across facets, OR within one. An empty list or "all" leaves that facet open.
 * Access is the dashboard role; community is the self-declared or staff-set tag; tag is whether staff confirmed it.
 */
export type MemberFilters = {
  access: MemberAccess[]; community: MemberCommunity[]; divisions: string[];
  status: "all" | "active" | "deactivated"; tag: "all" | "confirmed" | "unconfirmed"; reviewer: boolean;
};
export const memberAccess = ["owner", "admin", "member"] as const;
export type MemberAccess = (typeof memberAccess)[number];
export const memberCommunity = ["member", "core", "bod"] as const;
export type MemberCommunity = (typeof memberCommunity)[number];
export const accessLabels: Record<MemberAccess, string> = { owner: "Pemilik", admin: "Admin", member: "Member" };
export const communityLabels: Record<MemberCommunity, string> = { member: "Member", core: "Core Team", bod: "BoD" };
export const statusLabels: Record<MemberFilters["status"], string> = { all: "Semua", active: "Aktif", deactivated: "Nonaktif" };
export const tagLabels: Record<MemberFilters["tag"], string> = { all: "Semua", confirmed: "Terkonfirmasi", unconfirmed: "Belum dikonfirmasi" };
export const noFilters: MemberFilters = { access: [], community: [], divisions: [], status: "all", tag: "all", reviewer: false };

/** How many facets narrow the list, for the badge on the Filter button. */
export function activeFilterCount(filters: MemberFilters) {
  return [filters.access.length, filters.community.length, filters.divisions.length, filters.status !== "all", filters.tag !== "all", filters.reviewer].filter(Boolean).length;
}

type Filterable = { access: MemberAccess; memberType?: string | null; division?: string | null; active: boolean; tagConfirmed: boolean; reviewer: boolean };
/** Whether one member passes the filter. `reviewer` is the granted or tag-based permission, not review by role. */
export function matchesFilters(member: Filterable, filters: MemberFilters) {
  const tagged = member.memberType === "core" || member.memberType === "bod";
  return (!filters.access.length || filters.access.includes(member.access))
    && (!filters.community.length || filters.community.includes((member.memberType ?? "member") as MemberCommunity))
    && (!filters.divisions.length || filters.divisions.includes(member.division ?? ""))
    && (filters.status === "all" || (filters.status === "active") === member.active)
    && (filters.tag === "all" || (tagged && (filters.tag === "confirmed") === member.tagConfirmed))
    && (!filters.reviewer || member.reviewer);
}

export const memberSorts = ["joined-desc", "joined-asc", "name-asc", "name-desc"] as const;
export type MemberSort = (typeof memberSorts)[number];
export const DEFAULT_SORT: MemberSort = "joined-desc";

export const pageSizes = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
/** Upper bound for any caller, e.g. the assignment reviewer picker asks for 6. */
export const MAX_PAGE_SIZE = 100;

type Sortable = { fullName: string; joinedAt: number };
const collator = new Intl.Collator("id-ID", { sensitivity: "base", numeric: true });

export function compareMembers(sort: MemberSort) {
  return (a: Sortable, b: Sortable) => {
    if (sort === "name-asc" || sort === "name-desc") {
      const byName = collator.compare(a.fullName.trim(), b.fullName.trim());
      return (sort === "name-asc" ? byName : -byName) || b.joinedAt - a.joinedAt;
    }
    return sort === "joined-asc" ? a.joinedAt - b.joinedAt : b.joinedAt - a.joinedAt;
  };
}

/** Cuts one page out of `total` rows. Out-of-range pages land on the nearest real page, so a shrinking list never shows an empty page. */
export function pageSlice(total: number, page: number, pageSize: number) {
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize) || DEFAULT_PAGE_SIZE));
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(pageCount, Math.max(1, Math.floor(page) || 1));
  const start = (current - 1) * size;
  return { page: current, pageSize: size, pageCount, start, end: Math.min(total, start + size) };
}

/**
 * The page buttons to show: always the first and last page, the current page with one neighbour on each side, and
 * "gap" where pages are skipped. A gap that would hide a single page shows that page instead.
 */
export function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  let from = Math.max(2, Math.min(page - 1, pageCount - 4));
  let to = Math.min(pageCount - 1, Math.max(page + 1, 5));
  if (from === 3) from = 2;
  if (to === pageCount - 2) to = pageCount - 1;
  const items: (number | "gap")[] = [1];
  if (from > 2) items.push("gap");
  for (let n = from; n <= to; n++) items.push(n);
  if (to < pageCount - 1) items.push("gap");
  items.push(pageCount);
  return items;
}

export type MemberListState = { search: string; filters: MemberFilters; sort: MemberSort; page: number; pageSize: number };
export const defaultListState: MemberListState = { search: "", filters: noFilters, sort: DEFAULT_SORT, page: 1, pageSize: DEFAULT_PAGE_SIZE };

const pick = <T extends string>(values: readonly string[], allowed: readonly T[]) => [...new Set(values)].filter((value): value is T => allowed.includes(value as T));
const oneOf = <T extends string>(value: string | null, allowed: readonly T[], fallback: T) => allowed.includes(value as T) ? value as T : fallback;

/** Reads the list state from `?q=&access=&community=&division=&status=&tag=&reviewer=1&sort=&page=&size=`, ignoring anything unknown. Multi-value facets repeat their key. */
export function readListState(params: Pick<URLSearchParams, "get" | "getAll">): MemberListState {
  const page = Number(params.get("page")), size = Number(params.get("size"));
  return {
    search: (params.get("q") ?? "").slice(0, 80),
    filters: {
      access: pick(params.getAll("access"), memberAccess),
      community: pick(params.getAll("community"), memberCommunity),
      divisions: pick(params.getAll("division"), divisions),
      status: oneOf(params.get("status"), ["all", "active", "deactivated"] as const, "all"),
      tag: oneOf(params.get("tag"), ["all", "confirmed", "unconfirmed"] as const, "all"),
      reviewer: params.get("reviewer") === "1",
    },
    sort: oneOf(params.get("sort"), memberSorts, DEFAULT_SORT),
    page: Number.isInteger(page) && page > 1 ? page : 1,
    pageSize: (pageSizes as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/** The query string for a list state, leaving defaults out so the plain page keeps a plain URL. */
export function listQueryString(state: MemberListState) {
  const params = new URLSearchParams();
  const { filters } = state;
  if (state.search.trim()) params.set("q", state.search.trim());
  for (const value of filters.access) params.append("access", value);
  for (const value of filters.community) params.append("community", value);
  for (const value of filters.divisions) params.append("division", value);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.tag !== "all") params.set("tag", filters.tag);
  if (filters.reviewer) params.set("reviewer", "1");
  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_PAGE_SIZE) params.set("size", String(state.pageSize));
  const query = params.toString();
  return query ? `?${query}` : "";
}
