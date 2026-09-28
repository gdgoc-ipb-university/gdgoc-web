/**
 * Browser-side image optimisation before upload: PNG/JPEG/WebP are downscaled to a
 * maximum edge and re-encoded as WebP. Re-encoding also drops EXIF metadata (e.g. GPS).
 * Other formats (PDF, Office, ZIP) are already compressed containers and pass through.
 */
export const optimizableImageTypes = ["image/png", "image/jpeg", "image/webp"];
export const maxImageInputBytes = 25 * 1024 * 1024;
export const imageMaxEdge = 2560;
export const imageQuality = 0.82;

export function isOptimizableImage(file: File) {
  return optimizableImageTypes.includes(file.type);
}

function webpName(name: string) {
  const dot = name.lastIndexOf(".");
  return `${dot > 0 ? name.slice(0, dot) : name}.webp`;
}

async function encodeWebp(bitmap: ImageBitmap, width: number, height: number): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: "image/webp", quality: imageQuality });
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", imageQuality));
}

/** The smaller of the original and a WebP re-encode. Never throws; unsupported browsers keep the original. */
export async function optimizeImage(file: File): Promise<File> {
  if (!isOptimizableImage(file) || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, imageMaxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const blob = await encodeWebp(bitmap, width, height);
    bitmap.close();
    // Some browsers (older Safari) silently fall back to PNG; keep the original then.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], webpName(file.name), { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
