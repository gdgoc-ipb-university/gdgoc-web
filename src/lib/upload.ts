import type { Id } from "../../convex/_generated/dataModel";

/** Posts a file to a Convex upload URL with progress events (fetch has no upload progress). */
export function sendFile(url: string, file: Blob, onProgress: (fraction: number) => void, signal: AbortSignal) {
  return new Promise<Id<"_storage">>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const failed = () => reject(new Error("Unggahan gagal. Periksa koneksi, lalu coba lagi."));
    request.open("POST", url);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) return failed();
      try { resolve((JSON.parse(request.responseText) as { storageId: Id<"_storage"> }).storageId); } catch { failed(); }
    };
    request.onerror = failed;
    request.onabort = () => reject(new DOMException("Unggahan dibatalkan.", "AbortError"));
    signal.addEventListener("abort", () => request.abort(), { once: true });
    request.send(file);
  });
}
