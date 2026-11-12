import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { communityLinks } from "@/lib/community";
import { JoinFooter } from "./join-footer";
import { LeagueFooter } from "./league/footer";

vi.mock("./bogor-run", () => ({ BogorRun: ({ invitation, children }: { invitation?: ReactNode; children?: ReactNode }) => <>{invitation}{children}</> }));
vi.mock("./reveal", () => ({ Reveal: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

afterEach(cleanup);

const external = (link: HTMLElement) => [link.getAttribute("href"), link.getAttribute("target"), link.getAttribute("rel")];

/** The chapter's Discord server through its permanent invite (#264), next to Instagram in each footer that lists it. */
describe("community links in the footers", () => {
  it("the site footer lists Discord beside Instagram under Kabar & kolaborasi", () => {
    render(<JoinFooter />);
    const channels = screen.getByRole("navigation", { name: "Kanal komunitas" });
    expect(external(within(channels).getByRole("link", { name: "Instagram" }))).toEqual([communityLinks.instagram, "_blank", "noreferrer"]);
    expect(external(within(channels).getByRole("link", { name: "Discord" }))).toEqual([communityLinks.discord, "_blank", "noreferrer"]);
  });

  it("the Tech League footer lists Discord beside @gdgoc.ipb", () => {
    render(<LeagueFooter />);
    const links = screen.getByRole("navigation", { name: "Tautan GDGoC IPB" });
    expect(external(within(links).getByRole("link", { name: "@gdgoc.ipb" }))).toEqual([communityLinks.instagram, "_blank", "noreferrer"]);
    expect(external(within(links).getByRole("link", { name: "Discord" }))).toEqual([communityLinks.discord, "_blank", "noreferrer"]);
  });
});
