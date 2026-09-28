export const assignmentLimits = { title: 160, description: 6000, answer: 5000, fileName: 120 } as const;
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

export type AssignmentValues = { title: string; description: string; dueAt: string };
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

export function normalizeAssignment(values: AssignmentValues): AssignmentValues {
  return { title: values.title.trim().replace(/\s+/g, " "), description: values.description.trim(), dueAt: values.dueAt.trim() };
}

export function validateAssignment(values: AssignmentValues): AssignmentErrors {
  const v = normalizeAssignment(values);
  const errors: AssignmentErrors = {};
  if (!v.title) errors.title = "Isi judul tugas.";
  else if (v.title.length > assignmentLimits.title) errors.title = `Maksimal ${assignmentLimits.title} karakter.`;
  if (!v.description) errors.description = "Jelaskan apa yang perlu dikerjakan.";
  else if (v.description.length > assignmentLimits.description) errors.description = `Maksimal ${assignmentLimits.description} karakter.`;
  if (Number.isNaN(fromJakartaInput(v.dueAt))) errors.dueAt = "Pilih tanggal dan jam tenggat.";
  return errors;
}

export function isLate(submittedAt: number, dueAt: number) { return submittedAt > dueAt; }

export const assignmentStatusLabels = { draft: "Draft", published: "Dibuka", closed: "Ditutup" } as const;
export const roleLabels = { owner: "Pemilik", admin: "Admin", member: "Member" } as const;
