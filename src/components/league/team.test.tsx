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
const invite = { name: "Tim Hujan", trackName: "Software Development", captain: "Rania Putri", members: 2, max: 4, full: false, joined: false, otherTeam: null };
const queries: Record<string, unknown> = {};
const asked: Record<string, unknown> = {};
const mutations: Record<string, ReturnType<typeof vi.fn>> = {
  "league:create": vi.fn(async () => "t2"), "league:join": vi.fn(async () => "t1"), "league:handOver": vi.fn(async () => null), "league:leave": vi.fn(async () => null),
  "league:rotateInvite": vi.fn(async () => "WXYZ6789"),
};
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">, args: unknown) => { asked[getFunctionName(ref)] = args; return args === "skip" ? undefined : queries[getFunctionName(ref)]; },
  useMutation: (ref: FunctionReference<"mutation">) => mutations[getFunctionName(ref)] ?? vi.fn(async () => null),
}));

const accessible = async (container: HTMLElement) => {
  const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
};

afterEach(() => { cleanup(); Object.values(mutations).forEach((fn) => fn.mockClear()); for (const key of Object.keys(queries)) delete queries[key]; });

describe("league team area", () => {
  it("shows a captain their team and members, and hands over after a second click", async () => {
    queries["league:mine"] = { eligible: true, team };
    const { container } = render(<LeagueTeamArea invite={null} onInvite={() => {}} />);
    const panel = screen.getByRole("region", { name: "Tim Hujan" });
    expect(panel.textContent).toContain("Software Development");
    expect(panel.textContent).toContain("2 dari 4");
    expect(panel.textContent).not.toMatch(/kode tim/i);
    const bima = within(panel).getAllByRole("listitem")[1];
    await userEvent.click(within(bima).getByRole("button", { name: "Jadikan kapten" }));
    expect(mutations["league:handOver"]).not.toHaveBeenCalled();
    await userEvent.click(within(bima).getByRole("button", { name: "Ya, serahkan" }));
    expect(mutations["league:handOver"]).toHaveBeenCalledWith({ memberId: "m2" });
    await accessible(container);
  });

  it("gives the captain the invite code and link to copy, and replaces both after a second click", async () => {
    const user = userEvent.setup();
    queries["league:mine"] = { eligible: true, team };
    render(<LeagueTeamArea invite={null} onInvite={() => {}} />);
    expect(screen.getByText("ABCD-2345")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Salin kode" }));
    expect(await navigator.clipboard.readText()).toBe("ABCD-2345");
    const link = `${window.location.origin}/league/daftar?undangan=${code}`;
    expect((screen.getByLabelText("Tautan undangan") as HTMLInputElement).value).toBe(link);
    await user.click(screen.getByRole("button", { name: "Salin tautan" }));
    expect(await navigator.clipboard.readText()).toBe(link);
    await user.click(screen.getByRole("button", { name: "Ganti kode" }));
    expect(mutations["league:rotateInvite"]).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Ya, ganti" }));
    expect(mutations["league:rotateInvite"]).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ganti kode" })).toBeTruthy();
  });

  it("lets the captain of a team from before invite codes make one", async () => {
    queries["league:mine"] = { eligible: true, team: { ...team, inviteCode: null } };
    render(<LeagueTeamArea invite={null} onInvite={() => {}} />);
    expect(screen.queryByLabelText("Tautan undangan")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Buat kode undangan" }));
    expect(mutations["league:rotateInvite"]).toHaveBeenCalled();
  });

  it("hides the invite and captain actions from a member", () => {
    queries["league:mine"] = { eligible: true, team: { ...team, captain: false, inviteCode: null, members: team.members.map((member) => ({ ...member, you: !member.you })) } };
    render(<LeagueTeamArea invite={null} onInvite={() => {}} />);
    expect(screen.queryByText("Undang anggota")).toBeNull();
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

  it("opens an invite code typed loosely or a pasted link, and says when the code is malformed", async () => {
    queries["league:mine"] = { eligible: true, team: null };
    const onInvite = vi.fn();
    const { container } = render(<LeagueTeamArea invite={null} onInvite={onInvite} />);
    const box = screen.getByLabelText("Kode undangan") as HTMLInputElement;
    expect(box.placeholder).toBe("ABCD-2345");
    await userEvent.click(screen.getByRole("button", { name: "Buka undangan" }));
    expect(screen.getByRole("alert").textContent).toBe("Isi kode undangan dari kaptenmu.");
    await userEvent.type(box, "ABCD-2O45");
    await userEvent.click(screen.getByRole("button", { name: "Buka undangan" }));
    expect(screen.getByRole("alert").textContent).toBe("Kode undangan terdiri dari 8 huruf dan angka, seperti ABCD-2345.");
    expect(onInvite).not.toHaveBeenCalled();
    await accessible(container);
    for (const input of ["abcd 2345", `https://league.gdgocipb.com/daftar?undangan=${code}`]) {
      await userEvent.clear(box);
      await userEvent.type(box, input);
      await userEvent.click(screen.getByRole("button", { name: "Buka undangan" }));
      expect(onInvite).toHaveBeenLastCalledWith(code);
    }
  });
});

describe("league invite confirmation", () => {
  it("shows the team alone, joins on Gabung ke tim, and closes on Bukan sekarang", async () => {
    queries["league:mine"] = { eligible: true, team: null };
    queries["league:invite"] = invite;
    const onInvite = vi.fn();
    const { container } = render(<LeagueTeamArea invite="abcd-2345" onInvite={onInvite} />);
    expect(asked["league:invite"]).toEqual({ code });
    const card = screen.getByRole("region", { name: "Tim Hujan" });
    expect(card.textContent).toContain("Software Development");
    expect(card.textContent).toContain("Rania Putri");
    expect(card.textContent).toContain("2 dari 4");
    expect(screen.queryByRole("button", { name: "Buat tim" })).toBeNull();
    expect(screen.queryByLabelText("Kode undangan")).toBeNull();
    await accessible(container);
    await userEvent.click(screen.getByRole("button", { name: "Bukan sekarang" }));
    expect(onInvite).toHaveBeenLastCalledWith(null);
    expect(mutations["league:join"]).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Gabung ke tim/ }));
    expect(mutations["league:join"]).toHaveBeenCalledWith({ code });
    expect(onInvite).toHaveBeenCalledTimes(2);
  });

  it("says so and shows the team when the member is already in it", () => {
    queries["league:mine"] = { eligible: true, team: { ...team, captain: false, inviteCode: null } };
    queries["league:invite"] = { ...invite, joined: true };
    render(<LeagueTeamArea invite={code} onInvite={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("Kamu sudah ada di tim ini.");
    expect(screen.getByRole("region", { name: "Tim Hujan" }).textContent).toContain("Keluar dari tim");
  });

  it("names the member's own team, or says the team is full, without a join button", () => {
    queries["league:mine"] = { eligible: true, team: { ...team, name: "Tim Lain" } };
    queries["league:invite"] = { ...invite, otherTeam: "Tim Lain" };
    render(<LeagueTeamArea invite={code} onInvite={() => {}} />);
    expect(screen.getByRole("status").textContent).toBe("Kamu sudah ada di Tim Lain. Keluar dulu dari tim itu untuk bergabung ke Tim Hujan.");
    expect(screen.queryByRole("button", { name: /Gabung ke tim/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "Tim Lain" })).toBeNull();
    cleanup();

    queries["league:mine"] = { eligible: true, team: null };
    queries["league:invite"] = { ...invite, members: 4, full: true };
    render(<LeagueTeamArea invite={code} onInvite={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("Tim ini sudah penuh.");
    expect(screen.queryByRole("button", { name: /Gabung ke tim/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Tutup" })).toBeTruthy();
  });

  it("says a wrong, replaced or old code does not work", async () => {
    queries["league:mine"] = { eligible: true, team: null };
    queries["league:invite"] = null;
    const onInvite = vi.fn();
    const { container } = render(<LeagueTeamArea invite={code} onInvite={onInvite} />);
    expect(screen.getByRole("heading", { name: "Kode undangan ini tidak berlaku." })).toBeTruthy();
    await accessible(container);
    cleanup();

    // An old 22-character token never reaches the server.
    render(<LeagueTeamArea invite="abcdefghijABCDEFGHIJ_-" onInvite={onInvite} />);
    expect(asked["league:invite"]).toBe("skip");
    expect(screen.getByRole("heading", { name: "Kode undangan ini tidak berlaku." })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(onInvite).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("button", { name: /Gabung ke tim/ })).toBeNull();
  });
});
