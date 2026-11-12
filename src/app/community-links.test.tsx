import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { communityLinks } from "@/lib/community";
import JoinPage from "./bergabung/page";

vi.mock("@/components/header", () => ({ Header: () => null }));
vi.mock("@/components/join-footer", () => ({ JoinFooter: () => null }));

afterEach(cleanup);

/** The chapter's Discord server through its permanent invite (#264), beside the WhatsApp group. */
describe("/bergabung", () => {
  it("has a Server Discord card beside the WhatsApp group, opening the permanent invite in a new tab", () => {
    render(<JoinPage />);
    const cards = within(screen.getByRole("region", { name: "Gabung sekarang" })).getAllByRole("listitem");
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual(["Member GDGoC IPB", "Grup WhatsApp komunitas", "Server Discord"]);
    const invite = within(cards[2]).getByRole("link", { name: "Gabung server Discord" });
    expect(invite.getAttribute("href")).toBe(communityLinks.discord);
    expect(invite.getAttribute("target")).toBe("_blank");
    expect(invite.getAttribute("rel")).toBe("noreferrer");
  });

  it("doesn't promise roles or member-only channels through the invite", () => {
    render(<JoinPage />);
    const card = screen.getByRole("heading", { name: "Server Discord" }).closest("li")!;
    expect(card.textContent).not.toMatch(/role|peran|khusus member/i);
  });
});
