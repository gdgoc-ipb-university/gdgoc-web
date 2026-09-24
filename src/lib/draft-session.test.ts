import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftSession } from "./draft-session";
import { emptyAppreciation } from "./appreciation";

const initial = { values: { ...emptyAppreciation }, revision: 0, updatedAt: 1 };
function cache() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
afterEach(() => vi.useRealTimers());

describe("draft autosave", () => {
  it("debounces typing, saves the latest value, and clears the recovery copy only after acknowledgement", async () => {
    vi.useFakeTimers(); const local = cache();
    const persist = vi.fn(async () => ({ revision: 1, updatedAt: 10 }));
    const session = new DraftSession(initial, persist, local, "owner:one"); session.start();
    session.update({ ...emptyAppreciation, story: "A" });
    session.update({ ...emptyAppreciation, story: "A longer story" });
    expect(local.getItem("owner:one")).toContain("A longer story");
    await vi.advanceTimersByTimeAsync(799); expect(persist).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(persist).toHaveBeenCalledOnce(); expect(persist).toHaveBeenCalledWith(expect.objectContaining({ story: "A longer story" }), 0);
    expect(session.getSnapshot().phase).toBe("saved"); expect(local.getItem("owner:one")).toBeNull(); session.stop();
  });

  it("serializes changes made while a save is in flight, using the returned revision", async () => {
    let release!: (result: { revision: number; updatedAt: number }) => void;
    const persist = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { release = resolve; })).mockResolvedValueOnce({ revision: 2, updatedAt: 20 });
    const session = new DraftSession(initial, persist, cache(), "key");
    session.update({ ...emptyAppreciation, story: "First" });
    const pending = session.flush();
    session.update({ ...emptyAppreciation, story: "Second" });
    release({ revision: 1, updatedAt: 10 });
    expect(await pending).toBe(true);
    expect(persist).toHaveBeenNthCalledWith(2, expect.objectContaining({ story: "Second" }), 1);
    expect(session.getSnapshot()).toMatchObject({ phase: "saved", revision: 2, values: { story: "Second" } });
  });

  it("restores interrupted edits only for their owner and document key", async () => {
    const local = cache();
    const session = new DraftSession(initial, vi.fn(), local, "owner:one");
    session.update({ ...emptyAppreciation, story: "Recover me" }); session.stop();
    const recovered = new DraftSession(initial, vi.fn(), local, "owner:one"); recovered.start();
    const other = new DraftSession(initial, vi.fn(), local, "other:one"); other.start();
    expect(recovered.getSnapshot()).toMatchObject({ phase: "dirty", values: { story: "Recover me" } });
    expect(other.getSnapshot().values.story).toBe(""); recovered.stop(); other.stop();
  });

  it("preserves failed writes and retries without falsely reporting a cloud save", async () => {
    const local = cache();
    const persist = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ revision: 1, updatedAt: 10 });
    const session = new DraftSession(initial, persist, local, "key");
    session.update({ ...emptyAppreciation, story: "Offline edit" });
    expect(await session.flush()).toBe(false); expect(session.getSnapshot().phase).toBe("error"); expect(local.getItem("key")).toContain("Offline edit");
    expect(await session.flush()).toBe(true); expect(session.getSnapshot().phase).toBe("saved"); expect(local.getItem("key")).toBeNull();
  });

  it("stops writes on a version conflict and preserves local text until an explicit reload", async () => {
    const persist = vi.fn().mockRejectedValue({ data: { code: "CONFLICT", message: "Draft berubah." } });
    const session = new DraftSession(initial, persist, cache(), "key");
    session.update({ ...emptyAppreciation, story: "My local story" });
    expect(await session.flush()).toBe(false); expect(session.getSnapshot().phase).toBe("conflict");
    session.update({ ...emptyAppreciation, story: "Still mine" });
    expect(await session.flush()).toBe(false); expect(persist).toHaveBeenCalledOnce();
    session.useRemote({ values: { ...emptyAppreciation, story: "Other device" }, revision: 5, updatedAt: 100 });
    expect(session.getSnapshot()).toMatchObject({ phase: "saved", revision: 5, values: { story: "Other device" } });
  });

  it("flags stale recovery copies and handles unavailable browser storage", () => {
    const local = cache(); local.setItem("key", JSON.stringify({ values: { ...emptyAppreciation, story: "Old local text" }, revision: 0 }));
    const session = new DraftSession({ ...initial, revision: 2 }, vi.fn(), local, "key"); session.start();
    expect(session.getSnapshot().phase).toBe("conflict"); session.stop();
    const failing = { getItem: () => null, setItem: () => { throw new Error("Quota"); }, removeItem: () => {} };
    const noStorage = new DraftSession(initial, vi.fn(), failing, "key"); noStorage.update({ ...emptyAppreciation, story: "Text" });
    expect(noStorage.getSnapshot().localBackup).toBe(false);
  });

  it("accepts external updates only when there are no unsaved local edits", () => {
    const session = new DraftSession(initial, vi.fn());
    session.receive({ values: { ...emptyAppreciation, story: "Remote" }, revision: 1, updatedAt: 20 });
    expect(session.getSnapshot().values.story).toBe("Remote");
    session.update({ ...emptyAppreciation, story: "Local" });
    session.receive({ values: { ...emptyAppreciation, story: "New remote" }, revision: 2, updatedAt: 30 });
    expect(session.getSnapshot()).toMatchObject({ phase: "conflict", values: { story: "Local" } });
  });

  it("applies a newer remote version that arrived during the final save acknowledgement", async () => {
    let release!: (value: { revision: number; updatedAt: number }) => void;
    const session = new DraftSession(initial, () => new Promise((resolve) => { release = resolve; }));
    session.update({ ...emptyAppreciation, story: "My text" });
    const saving = session.flush();
    session.receive({ values: { ...emptyAppreciation, story: "Later remote edit" }, revision: 2, updatedAt: 20 });
    release({ revision: 1, updatedAt: 10 }); await saving;
    expect(session.getSnapshot()).toMatchObject({ phase: "saved", revision: 2, values: { story: "Later remote edit" } });
  });
});
