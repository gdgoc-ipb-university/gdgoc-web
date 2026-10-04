export const assignmentLimits = { title: 160, description: 6000, answer: 5000, fileName: 120, feedback: 2000, maxScore: 1000 } as const;
/** Assignments created before scores existed have no `maxScore`; they are graded out of this. */
export const defaultMaxScore = 100;
export function assignmentMaxScore(assignment: { maxScore?: number }) { return assignment.maxScore ?? defaultMaxScore; }
export const maxSubmissionFiles = 5;
export const maxFileBytes = 10 * 1024 * 1024;
export const pendingFileLifetime = 24 * 60 * 60 * 1000;

// Extension → accepted upload types. Office and ZIP files are often reported
// without a specific type, so those also accept a generic binary type.
const binary = "application/octet-stream";
export const acceptedFiles: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  txt: ["text/plain"],
  zip: ["application/zip", "application/x-zip-compressed", binary],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", binary],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", binary],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", binary],
};
export const acceptAttribute = Object.keys(acceptedFiles).map((extension) => `.${extension}`).join(",");

// `maxScore` is the form's text; it becomes a number on the server.
export type AssignmentValues = { title: string; slug: string; description: string; dueAt: string; maxScore: string };
export type AssignmentErrors = Partial<Record<keyof AssignmentValues, string>>;

export function cleanFileName(name: string) {
  const clean = name.replace(/[\\/\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= assignmentLimits.fileName) return clean;
  const dot = clean.lastIndexOf(".");
  const extension = dot > 0 ? clean.slice(dot) : "";
  return clean.slice(0, assignmentLimits.fileName - extension.length) + extension;
}

export function fileProblem(name: string, contentType: string | undefined, size: number) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const types = acceptedFiles[extension];
  if (!name.includes(".") || !types) return "Gunakan PDF, gambar (PNG/JPG/WebP), TXT, ZIP, atau dokumen Office (DOCX/PPTX/XLSX).";
  if (contentType && !types.includes(contentType.split(";")[0].trim().toLowerCase())) return "Jenis file tidak sesuai dengan ekstensinya.";
  if (size <= 0) return "File kosong tidak bisa dikirim.";
  if (size > maxFileBytes) return "Ukuran file maksimal 10 MB.";
  return null;
}

export function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** `datetime-local` values are always read and written in WIB (UTC+7, no DST). */
export function toJakartaInput(timestamp: number) {
  return new Date(timestamp + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function fromJakartaInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const timestamp = Date.parse(`${value}:00+07:00`);
  return Number.isNaN(timestamp) || toJakartaInput(timestamp) !== value ? NaN : timestamp;
}

export const maxSlugLength = 60;
// Static segments under /dashboard/tugas that a slug must not shadow.
export const reservedSlugs = ["baru"];

/** Lowercase ASCII words joined by hyphens, e.g. "Proyek Akhir: Web & AI" → "proyek-akhir-web-dan-ai". */
export function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, maxSlugLength).replace(/-+$/, "");
}

export function assignmentPath(assignment: { _id: string; slug?: string }) {
  return `/dashboard/tugas/${assignment.slug ?? assignment._id}`;
}

export function normalizeAssignment(values: AssignmentValues): AssignmentValues {
  const title = values.title.trim().replace(/\s+/g, " ");
  return { title, slug: slugify(values.slug) || slugify(title) || "tugas", description: values.description.trim(), dueAt: values.dueAt.trim(), maxScore: (values.maxScore ?? "").trim() || String(defaultMaxScore) };
}

export function validateAssignment(values: AssignmentValues): AssignmentErrors {
  const v = normalizeAssignment(values);
  const errors: AssignmentErrors = {};
  if (!v.title) errors.title = "Isi judul tugas.";
  else if (v.title.length > assignmentLimits.title) errors.title = `Maksimal ${assignmentLimits.title} karakter.`;
  if (!v.description) errors.description = "Jelaskan apa yang perlu dikerjakan.";
  else if (v.description.length > assignmentLimits.description) errors.description = `Maksimal ${assignmentLimits.description} karakter.`;
  if (Number.isNaN(fromJakartaInput(v.dueAt))) errors.dueAt = "Pilih tanggal dan jam tenggat.";
  if (!/^\d+$/.test(v.maxScore) || Number(v.maxScore) < 1 || Number(v.maxScore) > assignmentLimits.maxScore) errors.maxScore = `Isi nilai maksimal berupa bilangan bulat 1 sampai ${assignmentLimits.maxScore}.`;
  return errors;
}

export function isLate(submittedAt: number, dueAt: number) { return submittedAt > dueAt; }

/** A submission edited after it was reviewed: the score still shows, but the reviewer should look again. */
export function isStaleReview(submission: { submittedAt: number; reviewedAt?: number | null }) {
  return submission.reviewedAt != null && submission.submittedAt > submission.reviewedAt;
}

export function scoreLabel(score: number, maxScore: number) { return `${score}/${maxScore}`; }

export const assignmentStatusLabels = { draft: "Draft", published: "Dibuka", closed: "Ditutup" } as const;
export const roleLabels = { owner: "Pemilik", admin: "Admin", member: "Member" } as const;
