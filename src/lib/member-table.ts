// The members table: which filters and sorts exist, how a page is cut, and how the list state lives in the URL.
// Shared by `dashboard.members` (Convex) and the members page, so both read the same values.

export const memberFilters = ["all", "admin", "reviewer", "core", "bod", "deactivated"] as const;
export type MemberFilter = (typeof memberFilters)[number];
export const memberFilterLabels: Record<MemberFilter, string> = { all: "Semua", admin: "Admin", reviewer: "Peninjau", core: "Core Team", bod: "BoD", deactivated: "Nonaktif" };

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

export type MemberListState = { search: string; filter: MemberFilter; sort: MemberSort; page: number; pageSize: number };
export const defaultListState: MemberListState = { search: "", filter: "all", sort: DEFAULT_SORT, page: 1, pageSize: DEFAULT_PAGE_SIZE };

/** Reads the list state from `?q=&filter=&sort=&page=&size=`, ignoring anything unknown. */
export function readListState(params: Pick<URLSearchParams, "get">): MemberListState {
  const filter = params.get("filter"), sort = params.get("sort");
  const page = Number(params.get("page")), size = Number(params.get("size"));
  return {
    search: (params.get("q") ?? "").slice(0, 80),
    filter: memberFilters.includes(filter as MemberFilter) ? filter as MemberFilter : "all",
    sort: memberSorts.includes(sort as MemberSort) ? sort as MemberSort : DEFAULT_SORT,
    page: Number.isInteger(page) && page > 1 ? page : 1,
    pageSize: (pageSizes as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/** The query string for a list state, leaving defaults out so the plain page keeps a plain URL. */
export function listQueryString(state: MemberListState) {
  const params = new URLSearchParams();
  if (state.search.trim()) params.set("q", state.search.trim());
  if (state.filter !== "all") params.set("filter", state.filter);
  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_PAGE_SIZE) params.set("size", String(state.pageSize));
  const query = params.toString();
  return query ? `?${query}` : "";
}
