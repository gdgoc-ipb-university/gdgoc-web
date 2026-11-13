import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftEditor } from "./editor";
import { emptyAppreciation } from "@/lib/appreciation";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("@/components/dashboard/rich-text-editor", async () => ({ RichTextEditor: (await import("../dashboard/rich-text-editor.stub")).RichTextEditorStub }));
const viewer = { id: "user-ui-test", name: "Member Test", email: "member@example.com", isAdmin: false };
const id = "test-document" as Id<"appreciations">;
function record(): Doc<"appreciations"> {
  return { _id: id, _creationTime: 1, ownerId: viewer.id, ownerName: viewer.name, ownerEmail: viewer.email, clientId: "test-client-id-long", values: { ...emptyAppreciation }, status: "draft", revision: 0, updatedAt: 1 };
}
function actions() {
  return {
    save: vi.fn(async ({ revision }: { revision: number }) => ({ revision: revision + 1, updatedAt: Date.now() })),
    submit: vi.fn(async () => id), remove: vi.fn(async () => null),
  };
}
afterEach(() => { cleanup(); window.localStorage.clear(); vi.restoreAllMocks(); });

describe("appreciation editor", () => {
  it("limits the date picker to the chapter year and explains an out-of-period date", async () => {
    const doc = record();
    doc.values = { ...emptyAppreciation, fullName: "Member", memberType: "Member", campus: "Kampus Bogor", instagram: "member.test", achievement: "Juara 1", eventName: "Kompetisi", organizer: "Panitia", level: "Nasional", participation: "Individu", eventDate: "2026-06-20", story: "Cerita proses tim.", documentationLinks: "https://example.com/dokumentasi", publicationConsent: true };
    const gateway = actions(); const { container } = render(<DraftEditor record={doc} viewer={viewer} onBack={vi.fn()} actions={gateway} />);
    const date = container.querySelector<HTMLInputElement>("#eventDate")!;
    expect(date.min).toBe("2026-07-01");
    expect(date.max <= "2027-07-01").toBe(true);
    expect(screen.getByText("Dalam periode GDGoC IPB 1 Juli 2026 – 1 Juli 2027.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Tinjau sebelum kirim" }));
    expect(document.activeElement).toBe(date);
    expect(screen.getByText(/Apresiasi hanya untuk prestasi yang diumumkan dalam periode GDGoC IPB/)).toBeTruthy();
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  it("offers BoD as a role only to members tagged as BoD", () => {
    const options = (container: HTMLElement) => [...container.querySelectorAll<HTMLOptionElement>("select[name=memberType] option")].map((option) => option.textContent);
    const { container, unmount } = render(<DraftEditor record={record()} viewer={viewer} onBack={vi.fn()} actions={actions()} />);
    expect(options(container)).not.toContain("BoD");
    unmount();
    const tagged = render(<DraftEditor record={record()} viewer={{ ...viewer, memberType: "bod" }} onBack={vi.fn()} actions={actions()} />);
    expect(options(tagged.container)).toContain("BoD");
  });

  it("focuses the first missing field and refuses an incomplete submission", async () => {
    const gateway = actions(); render(<DraftEditor record={record()} viewer={viewer} onBack={vi.fn()} actions={gateway} />);
    await userEvent.click(screen.getByRole("button", { name: "Tinjau sebelum kirim" }));
    expect(document.activeElement?.id).toBe("fullName");
    expect(screen.getByText("Persetujuan publikasi diperlukan sebelum mengirim.")).toBeTruthy();
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  it("keeps rapidly entered values, autosaves, and shows team fields only for a team", async () => {
    const gateway = actions(); const { container } = render(<DraftEditor record={record()} viewer={viewer} onBack={vi.fn()} actions={gateway} />);
    const person = userEvent.setup();
    await person.type(container.querySelector("#fullName")!, "Member Test");
    await person.type(container.querySelector("#instagram")!, "member.test");
    fireEvent.change(container.querySelector("#eventDate")!, { target: { value: "2026-09-20" } });
    await person.click(container.querySelector("#participation")!);
    await person.click(await screen.findByRole("option", { name: "Tim" }));
    expect(container.querySelector("#teamMembers")).toBeTruthy();
    await person.type(container.querySelector("#teamName")!, "Tim Test");
    await waitFor(() => expect(gateway.save).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ fullName: "Member Test", instagram: "member.test", eventDate: "2026-09-20", teamName: "Tim Test" }) })), { timeout: 2000 });
    expect(screen.getByRole("status").textContent).toContain("Tersimpan di akun");
    await person.click(container.querySelector("#participation")!);
    await person.click(await screen.findByRole("option", { name: "Individu" }));
    expect(container.querySelector("#teamMembers")).toBeNull();
  });

  it("requires review before sending and submits only after pending edits are saved", async () => {
    const doc = record();
    doc.values = { ...emptyAppreciation, fullName: "Member", memberType: "Member", campus: "Kampus Bogor", instagram: "member.test", achievement: "Juara 1", eventName: "Kompetisi", organizer: "Panitia", level: "Nasional", participation: "Individu", eventDate: "2026-08-10", story: "Cerita proses tim.", documentationLinks: "https://example.com/dokumentasi", publicationConsent: true };
    const gateway = actions(); const { container } = render(<DraftEditor record={doc} viewer={viewer} onBack={vi.fn()} actions={gateway} />);
    fireEvent.change(container.querySelector("#story")!, { target: { value: "Cerita versi terbaru." } });
    await userEvent.click(screen.getByRole("button", { name: "Tinjau sebelum kirim" }));
    expect(await screen.findByRole("heading", { name: "Sudah sesuai ceritamu?" })).toBeTruthy();
    expect(gateway.submit).not.toHaveBeenCalled();
    expect(screen.getByText("Cerita versi terbaru.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Kirim apresiasi" }));
    expect(gateway.submit).toHaveBeenCalledWith({ id, revision: 1 });
  });

  it("retains edits and disables submission while offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const gateway = actions(); const { container } = render(<DraftEditor record={record()} viewer={viewer} onBack={vi.fn()} actions={gateway} />);
    fireEvent.change(container.querySelector("#story")!, { target: { value: "Offline story" } });
    expect(screen.getByText("Offline · cadangan di perangkat ini")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Tinjau sebelum kirim" }) as HTMLButtonElement).disabled).toBe(true);
    expect(window.localStorage.getItem(`gdgoc:apresiasi:${viewer.id}:${id}`)).toContain("Offline story");
  });

  it("writes the story in the editor, focuses it when it is missing, and starts again from another tab's version (#288)", async () => {
    const doc = record();
    doc.values = { ...emptyAppreciation, fullName: "Member", memberType: "Member", campus: "Kampus Bogor", instagram: "member.test", achievement: "Juara 1", eventName: "Kompetisi", organizer: "Panitia", level: "Nasional", participation: "Individu", eventDate: "2026-08-10", story: "", documentationLinks: "https://example.com/dokumentasi", publicationConsent: true };
    const gateway = actions(); const { container, rerender } = render(<DraftEditor record={doc} viewer={viewer} onBack={vi.fn()} actions={gateway} />);
    const story = () => container.querySelector<HTMLTextAreaElement>("#story")!;
    await userEvent.click(screen.getByRole("button", { name: "Tinjau sebelum kirim" }));
    expect(document.activeElement).toBe(story());
    expect(story().getAttribute("aria-invalid")).toBe("true");
    expect(story().getAttribute("aria-describedby")).toBe("story-hint story-error");
    fireEvent.change(story(), { target: { value: "Baris satu\nBaris dua" } });
    await waitFor(() => expect(gateway.save).toHaveBeenCalled(), { timeout: 2000 });
    const saved = (gateway.save.mock.calls[0] as unknown as [{ values: { story: string; storyDoc: string } }])[0].values;
    expect(saved.story).toBe("Baris satu\nBaris dua");
    expect(JSON.parse(saved.storyDoc).content).toHaveLength(2);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Tersimpan di akun"));
    // A newer version from another tab, with nothing unsaved here, replaces the story in the editor.
    const remote = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Dari tab lain" }] }] });
    rerender(<DraftEditor record={{ ...doc, revision: 5, values: { ...doc.values, story: "Dari tab lain", storyDoc: remote } }} viewer={viewer} onBack={vi.fn()} actions={gateway} />);
    await waitFor(() => expect(story().value).toBe("Dari tab lain"));
  });

  it("shows a rich story with its links in the preview, and an older story as plain text", async () => {
    const doc = record();
    const storyDoc = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Lihat prototipe", marks: [{ type: "link", attrs: { href: "https://example.com/figma" } }] }] }] });
    doc.values = { ...emptyAppreciation, fullName: "Member", memberType: "Member", campus: "Kampus Bogor", instagram: "member.test", achievement: "Juara 1", eventName: "Kompetisi", organizer: "Panitia", level: "Nasional", participation: "Individu", eventDate: "2026-08-10", story: "Lihat prototipe", storyDoc, documentationLinks: "https://example.com/dokumentasi", publicationConsent: true };
    const { container, unmount } = render(<DraftEditor record={doc} viewer={viewer} onBack={vi.fn()} actions={actions()} />);
    await userEvent.click(screen.getByRole("button", { name: "Tinjau sebelum kirim" }));
    await screen.findByRole("heading", { name: "Sudah sesuai ceritamu?" });
    expect(screen.getByRole("link", { name: "Lihat prototipe" }).getAttribute("href")).toBe("https://example.com/figma");
    expect(container.querySelector(".record-details .rich-text")).toBeTruthy();
    unmount();
    const older = record();
    older.values = { ...doc.values, story: "Baris satu\nhttps://example.com/figma", storyDoc: undefined };
    const plain = render(<DraftEditor record={older} viewer={viewer} onBack={vi.fn()} actions={actions()} />);
    await userEvent.click(screen.getByRole("button", { name: "Tinjau sebelum kirim" }));
    await screen.findByRole("heading", { name: "Sudah sesuai ceritamu?" });
    const row = [...plain.container.querySelectorAll(".record-details dl > div")].find((item) => item.querySelector("dt")?.textContent === "Cerita di balik prestasi")!;
    expect(row.querySelector("dd")?.outerHTML).toBe("<dd>Baris satu\nhttps://example.com/figma</dd>");
  });
});
