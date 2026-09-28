import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { Id } from "../../../convex/_generated/dataModel";
import { docFromPlainText, parseRichDoc, richText } from "@/lib/rich-text";
import { SubmissionForm, type SubmissionActions, type SubmissionFile, type UploadOptions } from "./submission-form";

// JSDOM cannot type into ProseMirror; the real editor is covered in rich-text-editor.test.tsx.
vi.mock("./rich-text-editor", () => ({
  RichTextEditor: ({ id, labelledBy, describedBy, initialDoc, onChange, focusRef }: {
    id: string; labelledBy: string; describedBy?: string; initialDoc: Parameters<typeof richText>[0];
    onChange: (doc: ReturnType<typeof docFromPlainText>) => void; focusRef?: { current: (() => void) | null };
  }) => <textarea id={id} aria-labelledby={labelledBy} aria-describedby={describedBy} defaultValue={richText(initialDoc)}
    ref={(element) => { if (focusRef) focusRef.current = () => element?.focus(); }}
    onChange={(event) => onChange(docFromPlainText(event.target.value))} />,
}));

const now = Date.UTC(2026, 9, 1, 3, 0);
const fileId = (value: string) => value as Id<"submissionFiles">;
type Submission = { answer: string; answerDoc: string | null; revision: number; submittedAt: number; late: boolean };

function Harness({ initial = [], submission = null, dueAt = now + 86400000, actions, optimize }: {
  initial?: SubmissionFile[]; submission?: Submission | null; dueAt?: number; actions: SubmissionActions; optimize?: (file: File) => Promise<File>;
}) {
  const [files, setFiles] = useState(initial);
  const wrapped: SubmissionActions = {
    ...actions,
    async upload(file, options) {
      const result = await actions.upload(file, options);
      if ("fileId" in result) setFiles((current) => [...current, { _id: result.fileId, name: file.name, size: file.size, attached: false, url: "https://files.example/x" }]);
      return result;
    },
  };
  return <SubmissionForm submission={submission} files={files} dueAt={dueAt} now={now} actions={wrapped} optimize={optimize} />;
}
function gateway() {
  return {
    upload: vi.fn<(file: File, options: UploadOptions) => Promise<{ fileId: Id<"submissionFiles"> } | { error: string }>>(async (file) => ({ fileId: fileId(`file-${file.name}`) })),
    removeFile: vi.fn(async () => null),
    submit: vi.fn(async () => "submission"),
  };
}
const pdf = (name = "laporan.pdf") => new File(["%PDF"], name, { type: "application/pdf" });
const dropFiles = (target: Element, files: File[]) => fireEvent.drop(target, { dataTransfer: { files, types: ["Files"] } });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("assignment submission form", () => {
  it("has accessible form semantics", async () => {
    const { container } = render(<Harness actions={gateway()} initial={[{ _id: fileId("a"), name: "laporan.pdf", size: 2048, attached: true, url: "https://files.example/a" }]} submission={{ answer: "Selesai", answerDoc: null, revision: 1, submittedAt: now - 1000, late: false }} />);
    const audit = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
      rules: { "color-contrast": { enabled: false } },
    });
    expect(audit.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
  });

  it("requires an answer or a file before sending", async () => {
    const actions = gateway();
    render(<Harness actions={actions} />);
    await userEvent.click(screen.getByRole("button", { name: "Kirim tugas" }));
    expect(screen.getByRole("alert").textContent).toContain("Tulis jawaban atau lampirkan");
    expect(document.activeElement?.id).toBe("answer");
    expect(actions.submit).not.toHaveBeenCalled();
  });

  it("rejects unsupported files locally, uploads valid ones, and submits them with the rich answer", async () => {
    const actions = gateway();
    const person = userEvent.setup({ applyAccept: false });
    render(<Harness actions={actions} />);
    const input = screen.getByTestId("file-input") as HTMLInputElement;
    await person.upload(input, new File(["x"], "skrip.html", { type: "text/html" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Gunakan PDF");
    expect(actions.upload).not.toHaveBeenCalled();
    await person.upload(input, pdf());
    expect(await screen.findByRole("link", { name: /laporan\.pdf/ })).toBeTruthy();
    await person.type(screen.getByRole("textbox", { name: /Jawaban/ }), "Demo di laporan.");
    await person.click(screen.getByRole("button", { name: "Kirim tugas" }));
    expect(actions.submit).toHaveBeenCalledWith(expect.objectContaining({ revision: 0, answer: "Demo di laporan.", fileIds: [fileId("file-laporan.pdf")] }));
    const sent = actions.submit.mock.calls[0] as unknown as [{ answerDoc: string }];
    expect(richText(parseRichDoc(sent[0].answerDoc)!)).toBe("Demo di laporan.");
    expect((await screen.findByText(/Tugas terkirim/)).textContent).toContain("masih bisa memperbaruinya");
  });

  it("accepts files dropped on the dropzone and keeps only the free slots", async () => {
    const actions = gateway();
    render(<Harness actions={actions} initial={[1, 2, 3, 4].map((n) => ({ _id: fileId(`old-${n}`), name: `lama-${n}.pdf`, size: 10, attached: true, url: null }))} />);
    const zone = screen.getByTestId("dropzone");
    fireEvent.dragOver(zone, { dataTransfer: { files: [], types: ["Files"] } });
    expect(zone.getAttribute("data-over")).toBe("true");
    dropFiles(zone, [pdf("satu.pdf"), pdf("dua.pdf")]);
    await waitFor(() => expect(actions.upload).toHaveBeenCalledTimes(1));
    expect(actions.upload.mock.calls[0][0].name).toBe("satu.pdf");
    expect(screen.getByText(/Hanya 1 file pertama/)).toBeTruthy();
    expect(await screen.findByText("Slot lampiran sudah penuh.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Pilih file" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows upload progress and cancels an upload", async () => {
    const actions = gateway();
    let options: UploadOptions | undefined;
    actions.upload.mockImplementationOnce((_file, given) => new Promise((_resolve, reject) => {
      options = given;
      given.signal.addEventListener("abort", () => reject(new DOMException("Unggahan dibatalkan.", "AbortError")));
    }));
    render(<Harness actions={actions} />);
    dropFiles(screen.getByTestId("dropzone"), [pdf("besar.pdf")]);
    const bar = await screen.findByRole("progressbar", { name: "Mengunggah besar.pdf" });
    options!.onProgress(0.42);
    await waitFor(() => expect(bar.getAttribute("aria-valuenow")).toBe("42"));
    expect((screen.getByRole("button", { name: "Menunggu unggahan…" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Batalkan unggahan besar.pdf" }));
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Kirim tugas" })).toBeTruthy();
  });

  it("compresses large images to WebP before uploading and shows the saving", async () => {
    const actions = gateway();
    const optimize = vi.fn(async (file: File) => new File([new Uint8Array(1_000_000)], file.name.replace(/\.png$/, ".webp"), { type: "image/webp" }));
    render(<Harness actions={actions} optimize={optimize} />);
    dropFiles(screen.getByTestId("dropzone"), [new File([new Uint8Array(12_000_000)], "poster.png", { type: "image/png" })]);
    await waitFor(() => expect(actions.upload).toHaveBeenCalledOnce());
    const sent = actions.upload.mock.calls[0][0];
    expect([sent.name, sent.type, sent.size]).toEqual(["poster.webp", "image/webp", 1_000_000]);
    expect(await screen.findByText(/WebP · hemat 92% dari 11,4 MB/)).toBeTruthy();
  });

  it("rejects images that are too large even before or after compression", async () => {
    const actions = gateway();
    const optimize = vi.fn(async (file: File) => file);
    render(<Harness actions={actions} optimize={optimize} />);
    dropFiles(screen.getByTestId("dropzone"), [new File([new Uint8Array(26 * 1024 * 1024)], "raksasa.jpg", { type: "image/jpeg" })]);
    expect((await screen.findByRole("alert")).textContent).toContain("25 MB sebelum dikompres");
    expect(optimize).not.toHaveBeenCalled();
    dropFiles(screen.getByTestId("dropzone"), [new File([new Uint8Array(11 * 1024 * 1024)], "besar.jpg", { type: "image/jpeg" })]);
    await waitFor(() => expect(screen.getByText(/tidak bisa dikompres di browser ini/)).toBeTruthy());
    expect(actions.upload).not.toHaveBeenCalled();
  });

  it("deletes pending uploads immediately but replaces attached files only on resubmission", async () => {
    const actions = gateway();
    render(<Harness actions={actions} submission={{ answer: "", answerDoc: null, revision: 2, submittedAt: now - 1000, late: false }} initial={[
      { _id: fileId("old"), name: "lama.pdf", size: 10, attached: true, url: "https://files.example/old" },
      { _id: fileId("new"), name: "baru.pdf", size: 10, attached: false, url: "https://files.example/new" },
    ]} />);
    await userEvent.click(screen.getByRole("button", { name: "Hapus lama.pdf" }));
    expect(actions.removeFile).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Kirim ulang" }));
    expect(actions.submit).toHaveBeenCalledWith(expect.objectContaining({ revision: 2, answer: "", fileIds: [fileId("new")] }));
    await userEvent.click(screen.getByRole("button", { name: "Hapus baru.pdf" }));
    await waitFor(() => expect(actions.removeFile).toHaveBeenCalledWith(fileId("new")));
  });

  it("opens a saved rich answer in the editor", () => {
    const answerDoc = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Versi kaya", marks: [{ type: "bold" }] }] }] });
    render(<Harness actions={gateway()} submission={{ answer: "Versi kaya", answerDoc, revision: 1, submittedAt: now - 1000, late: false }} />);
    expect((screen.getByRole("textbox", { name: /Jawaban/ }) as HTMLTextAreaElement).value).toBe("Versi kaya");
  });

  it("warns that work after the deadline is marked late", () => {
    render(<Harness actions={gateway()} dueAt={now - 60000} submission={{ answer: "Tepat waktu", answerDoc: null, revision: 1, submittedAt: now - 120000, late: false }} />);
    expect(screen.getByText(/akan ditandai terlambat, termasuk jika kamu memperbarui/)).toBeTruthy();
  });
});
