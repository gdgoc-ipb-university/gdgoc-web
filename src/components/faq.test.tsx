import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Faq } from "./faq";
import { JsonLd } from "./json-ld";

afterEach(cleanup);

describe("FAQ and JSON-LD", () => {
  it("renders answers with their links opening in a new tab", () => {
    render(<Faq className="league-faq" items={[{ question: "Ke mana bertanya?", answer: ["Kirim pesan ke ", { text: "Instagram @gdgoc.ipb", href: "https://www.instagram.com/gdgoc.ipb/" }, "."] }]} />);
    expect(screen.getByText("Ke mana bertanya?").tagName).toBe("DT");
    const link = screen.getByRole("link", { name: "Instagram @gdgoc.ipb" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.closest("dd")?.textContent).toBe("Kirim pesan ke Instagram @gdgoc.ipb.");
  });

  it("keeps a closing script tag in the data from ending the JSON-LD script", () => {
    const { container } = render(<JsonLd data={{ name: "</script><script>alert(1)</script>" }} />);
    const scripts = container.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0].textContent ?? "")).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
