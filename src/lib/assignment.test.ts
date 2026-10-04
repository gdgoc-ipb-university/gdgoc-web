import { describe, expect, it } from "vitest";
import { cleanFileName, fileProblem, fromJakartaInput, maxFileBytes, normalizeAssignment, slugify, toJakartaInput, validateAssignment } from "./assignment";

describe("assignment rules", () => {
  it("reads and writes deadlines in WIB regardless of the runtime time zone", () => {
    const timestamp = Date.UTC(2026, 9, 1, 16, 59);
    expect(toJakartaInput(timestamp)).toBe("2026-10-01T23:59");
    expect(fromJakartaInput("2026-10-01T23:59")).toBe(timestamp);
    expect(fromJakartaInput("2026-02-30T10:00")).toBeNaN();
    expect(fromJakartaInput("besok")).toBeNaN();
  });

  it("accepts known file types only when the reported type matches the extension", () => {
    expect(fileProblem("laporan.pdf", "application/pdf", 1000)).toBeNull();
    expect(fileProblem("Tugas.DOCX", "application/octet-stream", 1000)).toBeNull();
    expect(fileProblem("kode.zip", "application/x-zip-compressed", 1000)).toBeNull();
    expect(fileProblem("foto.png", "application/pdf", 1000)).toContain("tidak sesuai");
    expect(fileProblem("foto.png", "application/octet-stream", 1000)).toContain("tidak sesuai");
    expect(fileProblem("skrip.html", "text/html", 1000)).toContain("Gunakan PDF");
    expect(fileProblem("tanpa-ekstensi", undefined, 1000)).toContain("Gunakan PDF");
    expect(fileProblem("kosong.txt", "text/plain", 0)).toContain("kosong");
    expect(fileProblem("besar.pdf", "application/pdf", maxFileBytes + 1)).toContain("10 MB");
  });

  it("strips path characters and keeps the extension when shortening names", () => {
    expect(cleanFileName("  ../rahasia\\laporan  akhir.pdf ")).toBe("..rahasialaporan akhir.pdf");
    const long = cleanFileName(`${"a".repeat(200)}.pptx`);
    expect(long).toHaveLength(120);
    expect(long.endsWith(".pptx")).toBe(true);
  });

  it("requires a title, description, and valid deadline", () => {
    expect(validateAssignment({ title: " ", slug: "", description: "", dueAt: "", maxScore: "100" })).toEqual({
      title: "Isi judul tugas.", description: "Jelaskan apa yang perlu dikerjakan.", dueAt: "Pilih tanggal dan jam tenggat.",
    });
    expect(validateAssignment({ title: "Tugas", slug: "", description: "Kerjakan.", dueAt: "2026-10-01T23:59", maxScore: "100" })).toEqual({});
  });

  it("derives readable slugs from titles and cleans custom ones", () => {
    expect(slugify("Proyek Akhir: Web & AI")).toBe("proyek-akhir-web-dan-ai");
    expect(slugify("  Café — Désain UI/UX 2026!  ")).toBe("cafe-desain-ui-ux-2026");
    expect(slugify("---")).toBe("");
    expect(slugify("a".repeat(59) + " bb")).toBe("a".repeat(59));
    expect(normalizeAssignment({ title: "Landing Page", slug: "", description: "x", dueAt: "", maxScore: "100" }).slug).toBe("landing-page");
    expect(normalizeAssignment({ title: "Landing Page", slug: "Tugas Pertama!", description: "x", dueAt: "", maxScore: "100" }).slug).toBe("tugas-pertama");
    expect(normalizeAssignment({ title: "ラベル", slug: "", description: "x", dueAt: "", maxScore: "100" }).slug).toBe("tugas");
  });
});
