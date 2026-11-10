import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { getFunctionName, type FunctionReference } from "convex/server";
import { TechSupportPage } from "./tech-support";

// The Tech Support pages against a fake Convex.
const at = (value: string) => Date.parse(`${value}+07:00`);
const mine = [
  { _id: "r2", competition: "Gemastik 2026", competitionUrl: "https://gemastik.kemdikbud.go.id", deadline: "2099-11-20", participation: "team", teamName: "Tim Dino", helpKinds: ["Ideasi", "Review pitch deck"], progress: "Prototipe.", status: "matched", mentorName: "Dika Aprilio Wibowo", submittedAt: at("2026-10-28T10:00:00"), updatedAt: 0 },
  { _id: "r1", competition: "Hology", competitionUrl: "https://hology.ub.ac.id", deadline: "2099-12-01", participation: "solo", teamName: null, helpKinds: ["Mock judging"], progress: "Ide.", status: "new", mentorName: null, submittedAt: at("2026-10-30T10:00:00"), updatedAt: 0 },
];
const queries: Record<string, unknown> = { "techSupport:mine": mine };
const mutations: Record<string, ReturnType<typeof vi.fn>> = { "techSupport:submit": vi.fn(async () => "r3") };
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">, args: unknown) => args === "skip" ? undefined : queries[getFunctionName(ref)],
  useMutation: (ref: FunctionReference<"mutation">) => mutations[getFunctionName(ref)] ?? vi.fn(async () => null),
}));

const accessible = async (container: HTMLElement) => {
  const result = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.html) }))).toEqual([]);
};

afterEach(() => { cleanup(); Object.values(mutations).forEach((fn) => fn.mockClear()); queries["techSupport:mine"] = mine; });

describe("Tech Support request form", () => {
  it("opens ready to fill when onboarding sends the member here (?ajukan=1), and only then", () => {
    Element.prototype.scrollIntoView = vi.fn();
    window.history.replaceState(null, "", "/dashboard/tech-support?ajukan=1");
    const { unmount } = render(<TechSupportPage />);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /Nama kompetisi/ }));
    unmount();
    window.history.replaceState(null, "", "/dashboard/tech-support");
    render(<TechSupportPage />);
    expect(document.activeElement).toBe(document.body);
  });

  it("lists the member's requests with status and the matched mentor", async () => {
    const { container } = render(<TechSupportPage />);
    const list = screen.getByRole("region", { name: "Permintaanmu" });
    const [matched, waiting] = within(list).getAllByRole("listitem");
    expect(matched.textContent).toContain("Mentor ditemukan");
    expect(matched.textContent).toContain("Mentor: Dika Aprilio Wibowo");
    expect(matched.textContent).toContain("Tim: Tim Dino");
    expect(waiting.textContent).toContain("Mentor sedang dicarikan.");
    expect(within(waiting).getByRole("link", { name: /Hology/ }).getAttribute("href")).toBe("https://hology.ub.ac.id");
    await accessible(container);
  });

  it("marks every required field and sends nothing until they are filled", async () => {
    render(<TechSupportPage />);
    await userEvent.click(screen.getByRole("button", { name: "Kirim permintaan" }));
    expect(mutations["techSupport:submit"]).not.toHaveBeenCalled();
    for (const name of ["Nama kompetisi", "Tautan kompetisi", "Tenggat", "Progres saat ini"]) {
      expect(screen.getByLabelText(new RegExp(name)).getAttribute("aria-invalid"), name).toBe("true");
    }
    expect(screen.getByText("Pilih ikut sebagai tim atau sendiri.")).toBeTruthy();
    expect(screen.getByText("Pilih minimal satu bentuk bantuan.")).toBeTruthy();
    // A team needs its name.
    await userEvent.click(screen.getByRole("radio", { name: "Tim" }));
    await userEvent.click(screen.getByRole("button", { name: "Kirim permintaan" }));
    expect(screen.getByText("Tulis nama timnya.")).toBeTruthy();
  });

  it("sends a complete request and clears the form", async () => {
    render(<TechSupportPage />);
    await userEvent.type(screen.getByLabelText(/Nama kompetisi/), "Gemastik 2026");
    await userEvent.type(screen.getByLabelText(/Tautan kompetisi/), "https://gemastik.kemdikbud.go.id");
    await userEvent.type(screen.getByLabelText(/Tenggat/), "2099-11-20");
    await userEvent.click(screen.getByRole("radio", { name: "Tim" }));
    await userEvent.type(screen.getByLabelText(/Nama tim/), "Tim Dino");
    await userEvent.click(screen.getByRole("checkbox", { name: "Review pitch deck" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Ideasi" }));
    await userEvent.type(screen.getByLabelText(/Progres saat ini/), "Sudah ada prototipe.");
    await userEvent.click(screen.getByRole("button", { name: "Kirim permintaan" }));
    expect(mutations["techSupport:submit"]).toHaveBeenCalledWith({ values: {
      competition: "Gemastik 2026", competitionUrl: "https://gemastik.kemdikbud.go.id", deadline: "2099-11-20", participation: "team",
      teamName: "Tim Dino", helpKinds: ["Ideasi", "Review pitch deck"], progress: "Sudah ada prototipe.",
    } });
    expect((await screen.findByRole("status")).textContent).toContain("Permintaanmu terkirim");
    expect((screen.getByLabelText(/Nama kompetisi/) as HTMLInputElement).value).toBe("");
  });

  it("holds the form while three requests are open", () => {
    queries["techSupport:mine"] = [...mine, { ...mine[1], _id: "r0" }];
    render(<TechSupportPage />);
    expect(screen.getByText(/sudah punya 3 permintaan yang berjalan/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Kirim permintaan" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
