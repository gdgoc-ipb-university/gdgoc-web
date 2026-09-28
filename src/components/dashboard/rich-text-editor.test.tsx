import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { docFromPlainText, type RichDoc } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";

beforeAll(() => {
  // ProseMirror measures layout when focusing; JSDOM has no layout, so return empty boxes.
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) } as DOMRect;
  const list = Object.assign([rect], { item: () => rect }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => rect;
  Range.prototype.getClientRects = () => list;
  Element.prototype.getClientRects = () => list;
  document.elementFromPoint = () => null;
});
afterEach(() => cleanup());

function setup(doc: RichDoc = docFromPlainText("")) {
  const onChange = vi.fn();
  const view = render(<><span id="label">Jawaban</span><RichTextEditor id="answer" labelledBy="label" initialDoc={doc} onChange={onChange} maxLength={5000} placeholder="Tulis di sini" /></>);
  return { onChange, ...view };
}

describe("rich text editor", () => {
  it("renders an accessible, labelled toolbar and text box", async () => {
    const { container } = setup(docFromPlainText("Halo"));
    const toolbar = await screen.findByRole("toolbar", { name: "Format jawaban" });
    expect(screen.getByRole("textbox", { name: "Jawaban" })).toBeTruthy();
    expect(Array.from(toolbar.querySelectorAll("button")).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Tebal", "Miring", "Garis bawah", "Coret", "Kode", "Judul", "Subjudul", "Daftar poin", "Daftar bernomor", "Kutipan", "Blok kode", "Tautan", "Urungkan", "Ulangi",
    ]);
    expect(screen.getByText("4/5.000 karakter")).toBeTruthy();
    const audit = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
    expect(audit.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
  });

  it("moves between tools with the arrow keys using a single tab stop", async () => {
    setup();
    const toolbar = await screen.findByRole("toolbar");
    const bold = screen.getByRole("button", { name: "Tebal" });
    expect(Array.from(toolbar.querySelectorAll('button[tabindex="0"]'))).toEqual([bold]);
    bold.focus();
    fireEvent.keyDown(toolbar, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Miring" }));
    fireEvent.keyDown(toolbar, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ulangi" }));
    fireEvent.keyDown(toolbar, { key: "ArrowRight" });
    expect(document.activeElement).toBe(bold);
  });

  it("applies formatting from the toolbar and reports the document", async () => {
    const { onChange } = setup(docFromPlainText("Halo"));
    await userEvent.click(await screen.findByRole("button", { name: "Daftar poin" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Daftar poin" }).getAttribute("aria-pressed")).toBe("true"));
    // Tiptap keeps an empty paragraph after a trailing list so the cursor can leave it.
    expect(onChange).toHaveBeenLastCalledWith({ type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Halo" }] }] }] }, { type: "paragraph" }] });
    expect(screen.getByRole("button", { name: "Urungkan" }).getAttribute("aria-disabled")).toBeNull();
  });

  it("validates links in the inline link bar", async () => {
    setup(docFromPlainText("Demo"));
    await userEvent.click(await screen.findByRole("button", { name: "Tautan" }));
    const url = screen.getByRole("textbox", { name: "Alamat tautan" });
    expect(document.activeElement).toBe(url);
    await userEvent.type(url, "javascript:alert(1){Enter}");
    expect(screen.getByRole("alert").textContent).toContain("https://");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Tautan" })).toBeNull();
  });
});
