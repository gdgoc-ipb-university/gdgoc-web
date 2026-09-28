import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { Id } from "../../../convex/_generated/dataModel";
import { SubmissionForm, type SubmissionActions, type SubmissionFile } from "./submission-form";

const now = Date.UTC(2026, 9, 1, 3, 0);
const fileId = (value: string) => value as Id<"submissionFiles">;

function Harness({ initial = [], submission = null, dueAt = now + 86400000, actions }: {
  initial?: SubmissionFile[]; submission?: { answer: string; revision: number; submittedAt: number; late: boolean } | null; dueAt?: number; actions: SubmissionActions;
}) {
  const [files, setFiles] = useState(initial);
  const wrapped: SubmissionActions = {
    ...actions,
    async upload(file) {
      const result = await actions.upload(file);
      if ("fileId" in result) setFiles((current) => [...current, { _id: result.fileId, name: file.name, size: file.size, attached: false, url: "https://files.example/x" }]);
      return result;
    },
  };
  return <SubmissionForm submission={submission} files={files} dueAt={dueAt} now={now} actions={wrapped} />;
}
function gateway() {
  return {
    upload: vi.fn(async (file: File) => ({ fileId: fileId(`file-${file.name}`) })),
    removeFile: vi.fn(async () => null),
    submit: vi.fn(async () => "submission"),
  };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("assignment submission form", () => {
  it("has accessible form semantics", async () => {
    const { container } = render(<Harness actions={gateway()} initial={[{ _id: fileId("a"), name: "laporan.pdf", size: 2048, attached: true, url: "https://files.example/a" }]} submission={{ answer: "Selesai", revision: 1, submittedAt: now - 1000, late: false }} />);
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

  it("rejects unsupported files locally, uploads valid ones, and submits them with the answer", async () => {
    const actions = gateway();
    const person = userEvent.setup({ applyAccept: false });
    render(<Harness actions={actions} />);
    const input = screen.getByTestId("file-input") as HTMLInputElement;
    await person.upload(input, new File(["x"], "skrip.html", { type: "text/html" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Gunakan PDF");
    expect(actions.upload).not.toHaveBeenCalled();
    await person.upload(input, new File(["%PDF"], "laporan.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("link", { name: /laporan\.pdf/ })).toBeTruthy();
    await person.type(screen.getByRole("textbox", { name: /Jawaban/ }), "Demo di laporan.");
    await person.click(screen.getByRole("button", { name: "Kirim tugas" }));
    expect(actions.submit).toHaveBeenCalledWith({ revision: 0, answer: "Demo di laporan.", fileIds: [fileId("file-laporan.pdf")] });
    expect((await screen.findByText(/Tugas terkirim/)).textContent).toContain("masih bisa memperbaruinya");
  });

  it("deletes pending uploads immediately but replaces attached files only on resubmission", async () => {
    const actions = gateway();
    render(<Harness actions={actions} submission={{ answer: "", revision: 2, submittedAt: now - 1000, late: false }} initial={[
      { _id: fileId("old"), name: "lama.pdf", size: 10, attached: true, url: "https://files.example/old" },
      { _id: fileId("new"), name: "baru.pdf", size: 10, attached: false, url: "https://files.example/new" },
    ]} />);
    await userEvent.click(screen.getByRole("button", { name: "Hapus lama.pdf" }));
    expect(actions.removeFile).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Kirim ulang" }));
    expect(actions.submit).toHaveBeenCalledWith({ revision: 2, answer: "", fileIds: [fileId("new")] });
    await userEvent.click(screen.getByRole("button", { name: "Hapus baru.pdf" }));
    await waitFor(() => expect(actions.removeFile).toHaveBeenCalledWith(fileId("new")));
  });

  it("warns that work after the deadline is marked late", () => {
    render(<Harness actions={gateway()} dueAt={now - 60000} submission={{ answer: "Tepat waktu", revision: 1, submittedAt: now - 120000, late: false }} />);
    expect(screen.getByText(/akan ditandai terlambat, termasuk jika kamu memperbarui/)).toBeTruthy();
  });
});
