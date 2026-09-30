import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetNavViewer } from "@/lib/nav-viewer";
import { Header } from "./header";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("./brand-logo", () => ({ BrandLogo: () => <span>GDGoC IPB</span> }));
vi.mock("./scroll-progress", () => ({ ScrollProgress: () => null }));

let session: unknown = null;
const nav = () => screen.getByRole("navigation", { name: "Navigasi utama" });

beforeEach(() => {
  route.pathname = "/"; session = null; forgetNavViewer();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(session), { status: 200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("public header", () => {
  it("links the landing sections and the game, without Apresiasi", async () => {
    const { container } = render(<Header />);
    const links = within(nav()).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")]).slice(0, 3)).toEqual([["Tentang kami", "#community"], ["Program", "#explore"], ["Bogor Run", "#join"]]);
    expect(within(nav()).queryByRole("link", { name: /Apresiasi/ })).toBeNull();
    expect(within(nav()).queryByRole("link", { name: /Gabung member/ })).toBeNull();
    await waitFor(() => expect(within(nav()).getByRole("link", { name: "Masuk ke dashboard dengan Google" })).toBeTruthy());
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((violation) => violation.id)).toEqual([]);
  });

  it("points section links back to the landing from other pages", () => {
    route.pathname = "/privasi";
    render(<Header />);
    expect(within(nav()).getByRole("link", { name: "Program" }).getAttribute("href")).toBe("/#explore");
  });

  it("says Dashboard until it knows, then Masuk for guests", async () => {
    render(<Header />);
    const cta = within(nav()).getByRole("link", { name: /Dashboard/ });
    expect(cta.getAttribute("href")).toBe("/dashboard");
    expect(cta.dataset.viewer).toBe("unknown");
    await waitFor(() => expect(cta.dataset.viewer).toBe("guest"));
    expect(cta.textContent).toContain("Masuk");
    expect(document.querySelector(".nav-quick")).toBeNull(); // phones get the quick avatar only when signed in
  });

  it("greets a signed-in member with their initial and first name, on phones too", async () => {
    session = { session: { id: "s" }, user: { name: "Aldio Lisafron" } };
    route.pathname = "/dashboard/profil";
    render(<Header />);
    const [quick, cta] = await waitFor(() => {
      const found = screen.getAllByRole("link", { name: "Buka dashboard, masuk sebagai Aldio" });
      expect(found).toHaveLength(2);
      return found;
    });
    expect(cta.textContent).toBe("AHai, AldioDashboard");
    expect(cta.getAttribute("aria-current")).toBe("page");
    expect(quick.className).toBe("nav-quick");
  });

  it("underlines the section being read in the colour of the filling progress quarter", async () => {
    document.body.innerHTML = "";
    const tops: Record<string, number> = { community: 900, explore: 1800, join: 2800 };
    for (const id of Object.keys(tops)) {
      const section = document.body.appendChild(document.createElement("section"));
      section.id = id;
      section.getBoundingClientRect = () => ({ top: tops[id] - window.scrollY } as DOMRect);
    }
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 3600 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    render(<Header />);
    const scrollTo = async (y: number) => {
      Object.defineProperty(window, "scrollY", { configurable: true, value: y });
      fireEvent.scroll(window);
      await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });
    };
    const current = () => within(nav()).queryAllByRole("link").filter((link) => link.getAttribute("aria-current") === "location").map((link) => link.textContent);
    await scrollTo(0);
    expect(current()).toEqual([]);
    expect(nav().dataset.accent).toBe("blue");
    await scrollTo(1000);
    expect(current()).toEqual(["Tentang kami"]);
    expect(nav().dataset.accent).toBe("red");
    await scrollTo(1700);
    expect(current()).toEqual(["Program"]);
    expect(nav().dataset.accent).toBe("yellow");
    await scrollTo(2700); // the bottom of the page: the footer game
    expect(current()).toEqual(["Bogor Run"]);
    expect(nav().dataset.accent).toBe("green");
  });
});
