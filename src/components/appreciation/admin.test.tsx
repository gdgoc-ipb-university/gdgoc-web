import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName, type FunctionReference } from "convex/server";
import { emptyAppreciation } from "@/lib/appreciation";
import { parseRichDoc } from "@/lib/rich-text";
import { AppreciationReview } from "./admin";

// The reviewer's note in the rich-text editor (#288), against a fake Convex. The stub types plain lines into paragraphs.
const noteDoc = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Contoh foto", marks: [{ type: "link", attrs: { href: "https://example.com/contoh" } }] }] }] });
const base = {
  _id: "r1", _creationTime: 1, ownerId: "u1", ownerName: "Rania Putri", ownerEmail: "rania@example.com", clientId: "client-id-long-enough",
  values: { ...emptyAppreciation, fullName: "Rania Putri", achievement: "Juara 1 UI/UX", eventName: "Kompetisi", level: "Nasional", campus: "IPB University", story: "Cerita." },
  status: "reviewing", revision: 4, updatedAt: 1, submittedAt: 1, handlerName: null,
};
let rows: object[] = [];
const review = vi.fn(async () => null);
vi.mock("convex/react", () => ({
  usePaginatedQuery: (ref: FunctionReference<"query">) => ({ results: getFunctionName(ref) === "appreciations:queue" ? rows : [], status: "Exhausted", loadMore: vi.fn() }),
  useQuery: () => undefined,
  useMutation: () => review,
}));
vi.mock("../dashboard/rich-text-editor", async () => ({ RichTextEditor: (await import("../dashboard/rich-text-editor.stub")).RichTextEditorStub }));
afterEach(() => { cleanup(); review.mockClear(); rows = []; });
const note = () => screen.getByRole("textbox", { name: /Catatan untuk pengirim/ }) as HTMLTextAreaElement;

describe("reviewer notes (#288)", () => {
  it("keeps an older note plain until it is edited, and sends an edited one as a document", async () => {
    rows = [{ ...base, reviewNote: "Sedang dicek.\nTunggu ya." }];
    const { container } = render(<AppreciationReview />);
    expect(container.querySelector(".review-note")?.outerHTML).toBe('<p class="review-note">Sedang dicek.\nTunggu ya.</p>');
    expect(note().value).toBe("Sedang dicek.\nTunggu ya.");
    await userEvent.click(screen.getByRole("button", { name: "Simpan tindak lanjut" }));
    expect(review).toHaveBeenLastCalledWith({ id: "r1", revision: 4, status: "reviewing", note: "Sedang dicek.\nTunggu ya.", noteDoc: undefined, postUrl: "" });
    await userEvent.type(note(), "{Enter}Fotonya sudah cukup.");
    await userEvent.click(screen.getByRole("button", { name: "Simpan tindak lanjut" }));
    const sent = (review.mock.calls[1] as unknown as [{ note: string; noteDoc: string }])[0];
    expect(sent.note).toBe("Sedang dicek.\nTunggu ya.\nFotonya sudah cukup.");
    expect(parseRichDoc(sent.noteDoc)?.content).toHaveLength(3);
  });

  it("asks for a note before a revision request, and renders a rich note with its links", async () => {
    rows = [{ ...base, status: "submitted", reviewNote: "Contoh foto", reviewNoteDoc: noteDoc }];
    const { container } = render(<AppreciationReview />);
    expect(container.querySelector(".review-note")?.className).toBe("rich-text review-note");
    expect(screen.getByRole("link", { name: "Contoh foto" }).getAttribute("href")).toBe("https://example.com/contoh");
    await userEvent.clear(note());
    await userEvent.click(screen.getByRole("button", { name: /Ubah status/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Minta pengirim melengkapi" }));
    expect(note().getAttribute("aria-required")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Simpan tindak lanjut" }));
    expect(review).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Jelaskan apa yang perlu dilengkapi pengirim.");
    expect(document.activeElement).toBe(note());
  });
});
