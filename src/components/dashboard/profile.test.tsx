import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ProfilePage } from "./profile";
import { ViewerContext, type DashboardViewer } from "./viewer";

vi.mock("convex/react", () => ({ useQuery: () => [], useMutation: () => vi.fn(async () => null) }));
afterEach(cleanup);

const base: DashboardViewer = {
  id: "me" as DashboardViewer["id"], name: "Rania Putri", email: "rania@example.com", role: "member", active: true, onboarded: true, reviewer: false,
  memberType: "member", division: null, tagConfirmed: false, campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "", doorHelper: false, techSupportHandler: false,
  photo: null, photoUploaded: false,
};
const panel = (viewer: Partial<DashboardViewer> = {}) => {
  render(<ViewerContext.Provider value={{ ...base, ...viewer }}><ProfilePage /></ViewerContext.Provider>);
  return screen.getByRole("region", { name: "Peran komunitas" });
};

describe("community tag on the profile", () => {
  it("shows a member their tag without a way to change it", () => {
    const role = panel();
    expect(within(role).getByText("Member")).toBeTruthy();
    expect(within(role).getByText("Peran dan divisi diatur oleh pengurus. Hubungi admin jika perlu diubah.")).toBeTruthy();
    expect(within(role).queryByRole("radio")).toBeNull();
    expect(within(role).queryByRole("button")).toBeNull();
    expect(within(role).queryByText(/dikonfirmasi/)).toBeNull();
  });

  it("shows a staff-assigned Core Team tag with its division as confirmed", () => {
    const role = panel({ memberType: "core", division: "Media & Creative", tagConfirmed: true });
    expect(within(role).getByText("Core Team · Media & Creative")).toBeTruthy();
    expect(within(role).getByText("Dikonfirmasi pengurus")).toBeTruthy();
  });

  it("marks a self-declared Core Team tag from before as not yet confirmed", () => {
    const role = panel({ memberType: "core", division: "Technical" });
    expect(within(role).getByText("Core Team · Technical")).toBeTruthy();
    expect(within(role).getByText("Belum dikonfirmasi pengurus")).toBeTruthy();
  });
});
