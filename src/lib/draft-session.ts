import { emptyAppreciation, fieldLimits, type AppreciationValues } from "./appreciation";

export type SavePhase = "saved" | "dirty" | "saving" | "error" | "conflict";
type Version = { values: AppreciationValues; revision: number; updatedAt: number };
export type DraftSnapshot = Version & { phase: SavePhase; message: string; localBackup: boolean };
type Save = (values: AppreciationValues, revision: number) => Promise<{ revision: number; updatedAt: number }>;
type Cache = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readableError(error: unknown) {
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data;
    if (typeof data === "string") return data;
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") return data.message;
  }
  return "Belum berhasil terhubung. Periksa koneksi, lalu coba lagi.";
}

function isConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "data" in error && error.data && typeof error.data === "object" && "code" in error.data && ["CONFLICT", "LOCKED"].includes(String(error.data.code)));
}

function validValues(value: unknown): value is AppreciationValues {
  if (!value || typeof value !== "object") return false;
  return Object.entries(emptyAppreciation).every(([key, example]) => {
    const entry = (value as Record<string, unknown>)[key];
    return typeof entry === typeof example && (typeof entry !== "string" || entry.length <= fieldLimits[key as keyof typeof fieldLimits]);
  });
}

/** One serialized writer per editor. Revisions prevent silent overwrites across devices. */
export class DraftSession {
  private snapshot: DraftSnapshot;
  private saved: string;
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<boolean>;
  private remoteWhileSaving?: Version;
  private active = false;

  constructor(initial: Version, private persist: Save, private cache?: Cache, private cacheKey = "") {
    this.snapshot = { ...initial, phase: "saved", message: "", localBackup: Boolean(cache) };
    this.saved = JSON.stringify(initial.values);
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(next: Partial<DraftSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach((listener) => listener());
  }
  private backup() {
    try {
      if (!this.cache) return;
      if (this.saved === JSON.stringify(this.snapshot.values)) this.cache.removeItem(this.cacheKey);
      else this.cache.setItem(this.cacheKey, JSON.stringify({ values: this.snapshot.values, revision: this.snapshot.revision }));
    } catch { this.emit({ localBackup: false }); }
  }
  start() {
    this.active = true;
    try {
      const raw = this.cache?.getItem(this.cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (validValues(cached.values) && Number.isInteger(cached.revision) && JSON.stringify(cached.values) !== this.saved) {
          this.emit({ values: cached.values, phase: cached.revision === this.snapshot.revision ? "dirty" : "conflict", message: "Ada perubahan di perangkat ini yang belum tersimpan ke akun." });
        }
      }
    } catch { this.emit({ localBackup: false }); }
    if (this.snapshot.phase === "dirty") this.schedule();
  }
  stop() { this.active = false; clearTimeout(this.timer); }
  private schedule() {
    clearTimeout(this.timer);
    if (this.active && this.snapshot.phase !== "conflict") this.timer = setTimeout(() => { void this.flush(); }, 800);
  }
  update(values: AppreciationValues) {
    this.emit({ values, phase: this.snapshot.phase === "conflict" ? "conflict" : "dirty", message: "" });
    this.backup();
    this.schedule();
  }
  receive(remote: Version) {
    if (remote.revision <= this.snapshot.revision) return;
    if (this.pending) { this.remoteWhileSaving = remote; return; }
    if (this.saved !== JSON.stringify(this.snapshot.values)) {
      this.emit({ phase: "conflict", message: "Draft berubah di tab atau perangkat lain. Salin perubahanmu jika diperlukan, lalu muat versi terbaru." });
      clearTimeout(this.timer);
    } else this.useRemote(remote);
  }
  useRemote(remote: Version) {
    clearTimeout(this.timer);
    this.saved = JSON.stringify(remote.values);
    this.emit({ ...remote, phase: "saved", message: "" });
    this.backup();
  }
  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.pending) return this.pending;
    if (this.snapshot.phase === "conflict") return false;
    this.pending = this.write();
    try { return await this.pending; }
    finally {
      this.pending = undefined;
      const remote = this.remoteWhileSaving;
      this.remoteWhileSaving = undefined;
      if (remote) this.receive(remote);
    }
  }
  private async write() {
    while (this.saved !== JSON.stringify(this.snapshot.values)) {
      const values = { ...this.snapshot.values };
      const revision = this.snapshot.revision;
      this.emit({ phase: "saving", message: "" });
      try {
        const result = await this.persist(values, revision);
        this.saved = JSON.stringify(values);
        this.emit({ ...result, phase: this.saved === JSON.stringify(this.snapshot.values) ? "saved" : "dirty" });
        this.backup();
      } catch (error) {
        this.emit({ phase: isConflict(error) ? "conflict" : "error", message: readableError(error) });
        this.backup();
        return false;
      }
    }
    this.emit({ phase: "saved", message: "" });
    return true;
  }
}
