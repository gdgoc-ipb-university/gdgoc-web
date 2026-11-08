import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { LeagueTeamArea } from "./team";

// The league's team area against a fake Convex.
const code = "ABCD2345";
const team = {
  _id: "t1", name: "Tim Hujan", track: "software", trackName: "Software Development", captain: true, inviteCode: code,
  trackLocked: false, standing: "complete", size: { min: 2, max: 4 },
  members: [
    { _id: "m1", name: "Rania Putri", captain: true, you: true, joinedAt: 1 },
    { _id: "m2", name: "Bima Sakti", captain: false, you: false, joinedAt: 2 },
  ],
};
const queries: Record<string, unknown> = {};
const mutations: Record<string, ReturnType<typeof vi.fn>> = {
  "league:create": vi.fn(async () => "t2"), "league:join": vi.fn(async () => "t1"), "league:handOver": vi.fn(async () => null), "league:leave": vi.fn(async () => null),
};
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">, args: unknown) => args === "skip" ? undefined : queries[getFunctionName(ref)],
  useMutation: (ref: FunctionReference<"mutation">) => mutations[getFunctionName(ref)] ?? vi.fn(async () => null),
}));

const accessible = async (container: HTMLElement) => {
  const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
};

afterEach(() => { cleanup(); Object.values(mutations).forEach((fn) => fn.mockClear()); for (const key of Object.keys(queries)) delete queries[key]; });

describe("league team area", () => {
  it("shows a captain their team, members and the invite link, and hands over after a second click", async () => {
    queries["league:mine"] = { eligible: true, team };
    const { container } = render(<LeagueTeamArea invite={null} onInvite={() => {}} />);
    const panel = screen.getByRole("region", { name: "Tim Hujan" });
    expect(panel.textContent).toContain("2 dari 4");
    expect((screen.getByLabelText("Tautan undangan") as HTMLInputElement).value).toBe(`${window.location.origin}/league/daftar?undangan=${code}`);
    const bima = within(panel).getAllByRole("listitem")[1];
    await userEvent.click(within(bima).getByRole("button", { name: "Jadikan kapten" }));
    expect(mutations["league:handOver"]).not.toHaveBeenCalled();
    await userEvent.click(within(bima).getByRole("button", { name: "Ya, serahkan" }));
    expect(mutations["league:handOver"]).toHaveBeenCalledWith({ memberId: "m2" });
    await accessible(container);
  });

  it("hides the invite and captain actions from a member", () => {
    queries["league:mine"] = { eligible: true, team: { ...team, captain: false, inviteCode: null, members: team.members.map((member) => ({ ...member, you: !member.you })) } };
    render(<LeagueTeamArea invite={null} onInvite={() => {}} />);
    expect(screen.queryByLabelText("Tautan undangan")).toBeNull();
    expect(screen.queryByRole("button", { name: "Jadikan kapten" })).toBeNull();
    expect(screen.getByRole("button", { name: "Keluar dari tim" })).toBeTruthy();
  });

  it("creates a team only with a name and a track", async () => {
    queries["league:mine"] = { eligible: true, team: null };
    const { container } = render(<LeagueTeamArea invite={null} onInvite={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Buat tim" }));
    expect(screen.getByRole("alert").textContent).toBe("Isi nama tim.");
    await userEvent.type(screen.getByLabelText(/Nama tim/), "Tim Pelangi");
    await userEvent.click(screen.getByRole("button", { name: "Buat tim" }));
    expect(screen.getByRole("alert").textContent).toBe("Pilih kategori lomba.");
    await userEvent.click(screen.getByRole("radio", { name: "UI/UX Design" }));
    await userEvent.click(screen.getByRole("button", { name: "Buat tim" }));
    expect(mutations["league:create"]).toHaveBeenCalledWith({ name: "Tim Pelangi", track: "uiux" });
    await accessible(container);
  });

  it("opens a pasted invite link and joins from the invite card", async () => {
    queries["league:mine"] = { eligible: true, team: null };
    const onInvite = vi.fn();
    const { rerender } = render(<LeagueTeamArea invite={null} onInvite={onInvite} />);
    await userEvent.type(screen.getByLabelText("Tautan undangan"), "halo");
    await userEvent.click(screen.getByRole("button", { name: "Buka undangan" }));
    expect(onInvite).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText("Tautan undangan"));
    await userEvent.type(screen.getByLabelText("Tautan undangan"), `https://league.gdgocipb.com/daftar?undangan=${code}`);
    await userEvent.click(screen.getByRole("button", { name: "Buka undangan" }));
    expect(onInvite).toHaveBeenCalledWith(code);

    queries["league:invite"] = { name: "Tim Hujan", trackName: "Software Development", captain: "Rania Putri", members: 2, max: 4, full: false, joined: false, otherTeam: null };
    rerender(<LeagueTeamArea invite={code} onInvite={onInvite} />);
    expect(screen.getByRole("region", { name: "Tim Hujan" }).textContent).toContain("Kapten Rania Putri · 2 dari 4 orang");
    await userEvent.click(screen.getByRole("button", { name: /Gabung ke tim/ }));
    expect(mutations["league:join"]).toHaveBeenCalledWith({ code });
    expect(onInvite).toHaveBeenLastCalledWith(null);
  });

  it("says when an invite is full or the member already has a team", () => {
    queries["league:mine"] = { eligible: true, team: null };
    queries["league:invite"] = { name: "Tim Hujan", trackName: "Software Development", captain: "Rania Putri", members: 4, max: 4, full: true, joined: false, otherTeam: null };
    render(<LeagueTeamArea invite={code} onInvite={() => {}} />);
    expect(screen.getByText("Tim ini sudah penuh.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Gabung ke tim/ })).toBeNull();
  });
});
