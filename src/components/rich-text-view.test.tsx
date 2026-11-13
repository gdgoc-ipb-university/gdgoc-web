import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RichTextView } from "./rich-text-view";

afterEach(() => cleanup());
const doc = (...content: unknown[]) => JSON.stringify({ type: "doc", content });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });

describe("rendered rich answers", () => {
  it("renders formatting with safe links one heading level below the page", () => {
    const { container } = render(<RichTextView text="x" json={doc(
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hasil" }] },
      paragraph({ type: "text", text: "Demo", marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://example.com/demo" } }] }, { type: "hardBreak" }, { type: "text", text: "<script>alert(1)</script>" }),
      { type: "orderedList", attrs: { start: 2 }, content: [{ type: "listItem", content: [paragraph({ type: "text", text: "Dua" })] }] },
      { type: "codeBlock", content: [{ type: "text", text: "npm run dev" }] },
    )} />);
    expect(screen.getByRole("heading", { level: 3, name: "Hasil" }).className).toBe("rich-h2");
    const link = screen.getByRole("link", { name: "Demo" });
    expect(link.getAttribute("href")).toBe("https://example.com/demo");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer nofollow ugc");
    expect(link.querySelector("strong")).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeTruthy();
    expect(container.querySelector("ol")?.getAttribute("start")).toBe("2");
    expect(container.querySelector("pre code")?.textContent).toBe("npm run dev");
  });

  it("never renders unsafe links and falls back to plain text for unknown content", () => {
    render(<RichTextView text="x" json={doc(paragraph({ type: "text", text: "klik", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }))} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("klik")).toBeTruthy();
    cleanup();
    const { container } = render(<RichTextView text={"Baris satu\nBaris dua"} json={doc({ type: "iframe", attrs: { src: "https://x" } })} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.firstElementChild?.className).toContain("rich-text-plain");
    expect(container.textContent).toBe("Baris satu\nBaris dua");
  });

  it("keeps a field's older markup for rows saved before rich text (#288)", () => {
    const old = <div className="dash-instructions">{"Langkah 1\nLangkah 2"}</div>;
    const { container } = render(<RichTextView className="dash-instructions" text={"Langkah 1\nLangkah 2"} json={undefined} plain={old} />);
    expect(container.innerHTML).toBe('<div class="dash-instructions">Langkah 1\nLangkah 2</div>');
    cleanup();
    const rich = render(<RichTextView className="dash-instructions" text="Langkah 1" json={doc(paragraph({ type: "text", text: "Langkah 1" }))} plain={old} />);
    expect(rich.container.innerHTML).toBe('<div class="rich-text dash-instructions"><p><span>Langkah 1</span></p></div>');
  });
});
