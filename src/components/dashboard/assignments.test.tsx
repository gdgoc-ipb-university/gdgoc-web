import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { parseRichDoc } from "@/lib/rich-text";
import { EditAssignmentPage, NewAssignmentPage } from "./assignments";
import { AssignmentDetail } from "./assignment-detail";
import { ViewerContext, type DashboardViewer } from "./viewer";

// Task instructions, review feedback and revision notes in the rich-text editor (#288), against a fake Convex. The stub
// types plain lines into paragraphs.
const plainTask = {
  _id: "a1", _creationTime: 1, title: "Landing page", slug: "landing-page", description: "Langkah 1\nLangkah 2", dueAt: Date.parse("2026-11-20T23:59:00+07:00"),
  status: "published", revision: 3, createdBy: "me", createdAt: 1, updatedAt: 1, audience: ["member"], maxScore: 100,
};
const richDoc = { type: "doc", content: [
  { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Langkah" }] },
  { type: "paragraph", content: [{ type: "text", text: "Gabung Discord", marks: [{ type: "link", attrs: { href: "https://discord.gg/contoh" } }] }] },
] };
const richTask = { ...plainTask, description: "Langkah\nGabung Discord", descriptionDoc: JSON.stringify(richDoc) };
let detail: object = {};
let submissions: object[] = [];
const create = vi.fn(async () => "a2");
const update = vi.fn(async () => "landing-page");
const review = vi.fn(async () => null);
const requestRevision = vi.fn(async () => null);
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">, args: unknown) => args === "skip" ? undefined : ({ "assignments:get": detail, "assignments:slugPreview": "landing-page", "cohorts:list": [] } as Record<string, unknown>)[getFunctionName(ref)],
  useMutation: (ref: FunctionReference<"mutation">) => ({ "assignments:create": create, "assignments:update": update, "assignments:review": review, "assignments:requestRevision": requestRevision } as Record<string, unknown>)[getFunctionName(ref)] ?? vi.fn(async () => null),
  usePaginatedQuery: (ref: FunctionReference<"query">) => ({ results: getFunctionName(ref) === "assignments:submissions" ? submissions : [], status: "Exhausted", loadMore: vi.fn() }),
  useConvex: () => ({}),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("./rich-text-editor", async () => ({ RichTextEditor: (await import("./rich-text-editor.stub")).RichTextEditorStub }));

const viewer: DashboardViewer = { id: "me" as DashboardViewer["id"], name: "Saya", email: "me@example.com", role: "admin", active: true, onboarded: true, reviewer: true, memberType: null, division: null, tagConfirmed: false, campus: "", studyProgram: "", instagram: "", doorHelper: false, photo: null, photoUploaded: false, techSupportHandler: false };
const show = (page: React.ReactNode) => render(<ViewerContext.Provider value={viewer}>{page}</ViewerContext.Provider>);
const instructions = () => screen.getByRole("textbox", { name: /Instruksi/ }) as HTMLTextAreaElement;
const sent = (mock: typeof create | typeof update) => (mock.mock.calls[0] as unknown as [{ values: Record<string, string | undefined> }])[0].values;
const staffDetail = (assignment: object) => ({ assignment, canManage: true, canReview: true, cohort: null, reviewers: [], flag: null, submission: null, files: [] });

afterEach(() => { cleanup(); create.mockClear(); update.mockClear(); review.mockClear(); requestRevision.mockClear(); submissions = []; });

describe("task instructions (#288)", () => {
  it("sends the document with its plain text, and focuses the editor when it is empty", async () => {
    const { container } = show(<NewAssignmentPage />);
    expect(screen.getByText("Gunakan toolbar untuk judul, daftar, kode, atau tautan. Tautan bisa diklik member.").id).toBe("description-hint");
    await userEvent.type(screen.getByRole("textbox", { name: /Judul tugas/ }), "Landing page");
    await userEvent.click(screen.getByRole("button", { name: "Buka untuk sasaran" }));
    expect(create).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(instructions());
    expect(instructions().getAttribute("aria-invalid")).toBe("true");
    expect(instructions().getAttribute("aria-describedby")).toBe("description-hint description-error");
    expect(screen.getByText("Jelaskan apa yang perlu dikerjakan.")).toBeTruthy();
    const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map(({ id }) => id)).toEqual([]);
    await userEvent.type(instructions(), "Langkah 1{Enter}Langkah 2");
    expect(instructions().hasAttribute("aria-invalid")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Buka untuk sasaran" }));
    expect(sent(create).description).toBe("Langkah 1\nLangkah 2");
    expect(parseRichDoc(sent(create).descriptionDoc)?.content).toHaveLength(2);
  });

  it("opens an older task's plain text as paragraphs and keeps it plain until edited", async () => {
    detail = staffDetail(plainTask);
    show(<EditAssignmentPage id="landing-page" />);
    expect(instructions().value).toBe("Langkah 1\nLangkah 2");
    await userEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    expect(sent(update)).toMatchObject({ description: "Langkah 1\nLangkah 2" });
    expect(sent(update).descriptionDoc).toBeUndefined();
    // A saved form stays busy until the page changes, so edit in a fresh one.
    cleanup(); update.mockClear();
    show(<EditAssignmentPage id="landing-page" />);
    await userEvent.type(instructions(), "{Enter}Langkah 3");
    await userEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    expect(sent(update).description).toBe("Langkah 1\nLangkah 2\nLangkah 3");
    expect(parseRichDoc(sent(update).descriptionDoc)?.content).toHaveLength(3);
  });

  it("opens a rich task from its document and sends that document back", async () => {
    detail = staffDetail(richTask);
    show(<EditAssignmentPage id="landing-page" />);
    expect(instructions().value).toBe("Langkah\nGabung Discord");
    await userEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    expect(JSON.parse(sent(update).descriptionDoc!)).toEqual(richDoc);
  });

  it("renders rich instructions with clickable links, and older ones exactly as before", () => {
    detail = staffDetail(richTask);
    const { container } = show(<AssignmentDetail id="landing-page" />);
    const box = container.querySelector(".dash-instructions")!;
    expect(box.className).toBe("rich-text dash-instructions");
    expect(screen.getByRole("heading", { level: 3, name: "Langkah" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Gabung Discord" }).getAttribute("href")).toBe("https://discord.gg/contoh");
    cleanup();
    detail = staffDetail(plainTask);
    const old = show(<AssignmentDetail id="landing-page" />);
    expect(old.container.querySelector(".dash-instructions")?.outerHTML).toBe('<div class="dash-instructions">Langkah 1\nLangkah 2</div>');
  });
});

describe("review feedback and revision notes (#288)", () => {
  const reviewed = { score: 80, breakdown: null, reviewedAt: Date.parse("2026-11-12T10:00:00+07:00"), reviewerName: "Aldi Pratama", stale: false, revisionRequestedAt: null };
  const row = (fields: object) => ({ _id: "s1", name: "Rania Putri", email: "rania@example.com", campus: "IPB University", submittedAt: Date.parse("2026-11-11T10:00:00+07:00"), late: false, revision: 1, answer: "Selesai", answerDoc: null, files: [], ...reviewed, ...fields });
  const feedback = () => screen.getByRole("textbox", { name: "Umpan balik untuk member" }) as HTMLTextAreaElement;
  const linkDoc = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Lihat contoh", marks: [{ type: "link", attrs: { href: "https://example.com/contoh" } }] }] }] });

  it("rescoring keeps older plain feedback plain, and edited feedback goes as a document", async () => {
    detail = staffDetail(plainTask);
    submissions = [row({ feedback: "Rapi.\nTambahkan pengujian.", feedbackDoc: null })];
    show(<AssignmentDetail id="landing-page" />);
    expect(feedback().value).toBe("Rapi.\nTambahkan pengujian.");
    await userEvent.clear(screen.getByRole("spinbutton", { name: /Nilai/ }));
    await userEvent.type(screen.getByRole("spinbutton", { name: /Nilai/ }), "85");
    await userEvent.click(screen.getByRole("button", { name: "Perbarui penilaian" }));
    expect(review).toHaveBeenLastCalledWith({ submissionId: "s1", submissionRevision: 1, score: 85, feedback: "Rapi.\nTambahkan pengujian.", feedbackDoc: undefined });
    await userEvent.type(feedback(), "{Enter}Sudah bagus.");
    await userEvent.click(screen.getByRole("button", { name: "Perbarui penilaian" }));
    const sent = (review.mock.calls[1] as unknown as [{ feedback: string; feedbackDoc: string }])[0];
    expect(sent.feedback).toBe("Rapi.\nTambahkan pengujian.\nSudah bagus.");
    expect(parseRichDoc(sent.feedbackDoc)?.content).toHaveLength(3);
  });

  it("asks for a revision with the note's document, and focuses the editor when it is empty", async () => {
    detail = staffDetail(plainTask);
    submissions = [row({ feedback: null, feedbackDoc: null, score: null, reviewedAt: null, reviewerName: null })];
    show(<AssignmentDetail id="landing-page" />);
    await userEvent.click(screen.getByRole("button", { name: "Minta revisi" }));
    expect(requestRevision).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Tulis apa yang perlu direvisi di kolom umpan balik.");
    expect(document.activeElement).toBe(feedback());
    await userEvent.type(feedback(), "Tambahkan README.");
    await userEvent.click(screen.getByRole("button", { name: "Minta revisi" }));
    const sent = (requestRevision.mock.calls[0] as unknown as [{ note: string; noteDoc: string }])[0];
    expect(sent.note).toBe("Tambahkan README.");
    expect(parseRichDoc(sent.noteDoc)?.content).toEqual([{ type: "paragraph", content: [{ type: "text", text: "Tambahkan README." }] }]);
  });

  it("shows the member rich feedback with clickable links, and older feedback exactly as before", () => {
    const member = (fields: object) => ({ ...staffDetail(plainTask), canManage: false, canReview: false, submission: { _id: "s1", answer: "Selesai", answerDoc: null, revision: 1, submittedAt: Date.parse("2026-11-11T10:00:00+07:00"), late: false, ...reviewed, ...fields } });
    detail = member({ feedback: "Lihat contoh", feedbackDoc: linkDoc });
    const { container } = show(<AssignmentDetail id="landing-page" />);
    expect(container.querySelector(".dash-feedback")?.className).toBe("rich-text dash-feedback");
    expect(screen.getByRole("link", { name: "Lihat contoh" }).getAttribute("href")).toBe("https://example.com/contoh");
    cleanup();
    detail = member({ feedback: "Rapi.\nTambahkan pengujian.", feedbackDoc: null });
    const old = show(<AssignmentDetail id="landing-page" />);
    expect(old.container.querySelector(".dash-feedback")?.outerHTML).toBe('<p class="dash-feedback">Rapi.\nTambahkan pengujian.</p>');
  });
});
