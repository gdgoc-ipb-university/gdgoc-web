import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { catalyst } from "@/lib/catalyst";
import { communityLinks } from "@/lib/community";
import { dayLabel, rangeLabel } from "@/lib/schedule";
import JoinPage from "./bergabung/page";
import ProgramPage from "./program/page";
import CatalystPage, { metadata as catalystMetadata } from "./program/catalyst/page";

vi.mock("@/components/header", () => ({ Header: () => null }));
vi.mock("@/components/join-footer", () => ({ JoinFooter: () => null }));

/**
 * The public pages while `catalyst.scheduleOnHold` is true (#210): no Catalyst date anywhere, and the schedule is said
 * to follow on Instagram. When the dates are confirmed and the switch is turned off, these give way to the dated pages.
 */

/** An ISO date, or a day and month as `dayLabel` and `rangeLabel` write them ("2 November", "2–22 November"). */
const anyDate = /\d{4}-\d{2}-\d{2}|\d{1,2}(–\d{1,2})? (Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)/;

/** Every Catalyst date as a page would write it: ISO, as a day, and each timeline step as a range. */
const catalystDates = [...new Set(catalyst.timeline.flatMap((step) => {
  const end = "end" in step ? step.end : undefined;
  const days = end ? [step.start, end] : [step.start];
  return [...days, ...days.map(dayLabel), rangeLabel(step.start, end)];
}))];

const jsonLd = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("script[type='application/ld+json']"), (script) => JSON.parse(script.textContent ?? "null"));

afterEach(cleanup);

describe("/program/catalyst while the schedule is on hold", () => {
  it("is on hold until the 2026/27 dates are confirmed", () => {
    expect(catalyst.scheduleOnHold).toBe(true);
  });

  it("says the schedule follows on Instagram and on this page, without a Jadwal section or any date", () => {
    const { container } = render(<CatalystPage />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Jadwal GDGoC Catalyst 2026/27 masih disusun. Tanggal pendaftaran dan sesi diumumkan di Instagram @gdgoc.ipb dan di halaman ini.");
    expect(within(status).getByRole("link", { name: /Instagram/ }).getAttribute("href")).toBe(communityLinks.instagram);
    expect(within(status).queryByRole("link", { name: /Daftar/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Jadwal" })).toBeNull();
    expect(container.innerHTML).not.toMatch(anyDate);
    expect(catalystMetadata.description).toBe(catalyst.summary);
  });

  it("keeps the commitment in the FAQ: online Sunday sessions, at least 70% attended", () => {
    render(<CatalystPage />);
    expect(screen.getByText("Sembilan sesi daring pada hari Minggu. Peserta berkomitmen hadir minimal 70% sesi.")).toBeTruthy();
    expect(screen.getByText("Kapan peserta diumumkan?").nextElementSibling?.textContent).toBe("Tanggalnya diumumkan bersama jadwal pendaftaran di Instagram @gdgoc.ipb dan di halaman ini.");
  });

  it("carries a Course without dates, the FAQ and the breadcrumb, and no Event", () => {
    const { container } = render(<CatalystPage />);
    const data = jsonLd(container);
    expect(data.map((item) => item["@type"])).toEqual(["Course", "FAQPage", "BreadcrumbList"]);
    expect(data[0].hasCourseInstance).toBeUndefined();
    expect(JSON.stringify(data)).not.toMatch(anyDate);
  });
});

describe.each([
  { path: "/bergabung", Page: JoinPage, heading: "Belajar terstruktur: GDGoC Catalyst" },
  { path: "/program", Page: ProgramPage, heading: "GDGoC Catalyst" },
])("$path while the Catalyst schedule is on hold", ({ Page, heading }) => {
  it("says the Catalyst schedule follows on Instagram, and gives no Catalyst date", () => {
    const { container } = render(<Page />);
    const card = screen.getByRole("heading", { name: heading }).closest("li")!;
    expect(card.querySelector(".program-schedule")?.textContent).toBe("Jadwal 2026/27 menyusul. Pantau Instagram @gdgoc.ipb.");
    expect(card.textContent).not.toMatch(anyDate);
    expect(within(card).getByRole("link").getAttribute("href")).toBe(catalyst.path);
    for (const date of catalystDates) expect(container.innerHTML).not.toContain(date);
  });
});
