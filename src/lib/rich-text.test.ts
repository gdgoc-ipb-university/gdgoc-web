import { describe, expect, it } from "vitest";
import { docFromPlainText, parseRichDoc, richLength, richText, safeHref, sanitizeRichDoc } from "./rich-text";

const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", ...(content.length ? { content } : {}) });

describe("rich answers", () => {
  it("keeps the formatting the editor produces and drops unknown attributes", () => {
    const doc = sanitizeRichDoc({
      type: "doc", content: [
        { type: "heading", attrs: { level: 2, id: "x" }, content: [text("Hasil")] },
        paragraph(text("Tebal", [{ type: "bold" }, { type: "bold" }]), { type: "hardBreak" }, text("demo", [{ type: "link", attrs: { href: "https://example.com/demo", target: "_self", class: "evil" } }])),
        { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [paragraph(text("Satu"))] }] },
        { type: "codeBlock", attrs: { language: "ts" }, content: [text("const a = 1;", [{ type: "bold" }])] },
        { type: "horizontalRule" },
      ],
    });
    expect(doc?.content[0]).toEqual({ type: "heading", attrs: { level: 2 }, content: [text("Hasil")] });
    expect(doc?.content[1].content?.[0]).toEqual(text("Tebal", [{ type: "bold" }]));
    expect(doc?.content[1].content?.[2]).toEqual(text("demo", [{ type: "link", attrs: { href: "https://example.com/demo" } }]));
    expect(doc?.content[2].attrs).toEqual({ start: 3 });
    expect(doc?.content[3]).toEqual({ type: "codeBlock", content: [text("const a = 1;")] });
  });

  it("rejects unknown nodes, marks, and malformed structure", () => {
    expect(sanitizeRichDoc({ type: "doc", content: [{ type: "image", attrs: { src: "https://x" } }] })).toBeNull();
    expect(sanitizeRichDoc({ type: "doc", content: [paragraph(text("x", [{ type: "textStyle" }]))] })).toBeNull();
    expect(sanitizeRichDoc({ type: "doc", content: [{ type: "bulletList", content: [paragraph(text("not an item"))] }] })).toBeNull();
    expect(sanitizeRichDoc({ type: "doc", content: [paragraph({ type: "text", text: "" })] })).toBeNull();
    expect(sanitizeRichDoc({ type: "doc", content: [text("text at the top level")] })).toBeNull();
    expect(sanitizeRichDoc({ type: "paragraph", content: [] })).toBeNull();
    let deep: unknown = paragraph(text("deep"));
    for (let i = 0; i < 30; i++) deep = { type: "blockquote", content: [deep] };
    expect(sanitizeRichDoc({ type: "doc", content: [deep] })).toBeNull();
    expect(parseRichDoc("{not json")).toBeNull();
    expect(parseRichDoc(JSON.stringify({ type: "doc", content: [paragraph(text("x".repeat(130_000)))] }))).toBeNull();
  });

  it("drops unsafe links but keeps their text", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,<script>", "/relative", "vbscript:x", " JAVASCRIPT:alert(1)"]) {
      const doc = sanitizeRichDoc({ type: "doc", content: [paragraph(text("klik", [{ type: "link", attrs: { href } }]))] });
      expect(doc?.content[0].content?.[0]).toEqual(text("klik"));
    }
    expect(safeHref("mailto:tim@gdgocipb.com")).toBe("mailto:tim@gdgocipb.com");
    expect(safeHref("http://localhost:3000")).toBe("http://localhost:3000/");
  });

  it("derives readable text and counts characters like the editor", () => {
    const doc = sanitizeRichDoc({
      type: "doc", content: [
        paragraph(text("Baris "), text("satu", [{ type: "italic" }]), { type: "hardBreak" }, text("dua")),
        { type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("A"))] }, { type: "listItem", content: [paragraph(text("B"))] }] },
        paragraph(),
      ],
    })!;
    expect(richText(doc)).toBe("Baris satu\ndua\nA\nB");
    expect(richLength(doc)).toBe("Baris satu".length + 1 + "dua".length + 2);
    expect(richText(sanitizeRichDoc({ type: "doc", content: [paragraph()] })!)).toBe("");
  });

  it("opens older plain answers as paragraphs", () => {
    const doc = docFromPlainText("Baris satu\n\nBaris tiga");
    expect(doc.content).toHaveLength(3);
    expect(sanitizeRichDoc(doc)).toEqual(doc);
    expect(richText(doc)).toBe("Baris satu\n\nBaris tiga");
  });
});
