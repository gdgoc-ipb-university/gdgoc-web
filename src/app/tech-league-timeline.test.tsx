import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rangeLabel } from "@/lib/schedule";
import { techLeague } from "@/lib/tech-league";
import JoinPage from "./bergabung/page";
import LeaguePage from "./league/page";
import ProgramPage from "./program/page";

vi.mock("@/components/header", () => ({ Header: () => null }));
vi.mock("@/components/join-footer", () => ({ JoinFooter: () => null }));
vi.mock("@/components/league/footer", () => ({ LeagueFooter: () => null }));

/**
 * The public pages with Program & Development's Tech League timeline of 11 November 2026 (#222): the league page lists
 * every item by phase, and nothing still carries a date from the 4 November timeline (registration from 1 December,
 * the final and the awarding in February).
 */

/** A date only the 4 November timeline had: 1 December 2026, or anything in February 2027. */
const oldDate = /\b1 Desember|2026-12-01|Februari|2027-02-\d\d/;

const jsonLd = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("script[type='application/ld+json']"), (script) => JSON.parse(script.textContent ?? "null"));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-11T05:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("the league page", () => {
  it("says when registration opens and closes", () => {
    render(<LeaguePage />);
    expect(screen.getByRole("status").textContent).toContain("Pendaftaran tim dibuka 7 Desember 2026 dan ditutup 6 Januari 2027.");
  });

  it("lists every item of the full timeline under its phase, with its dates and notes", () => {
    render(<LeaguePage />);
    const schedule = screen.getByRole("heading", { level: 2, name: "Jadwal" }).closest("section")!;
    const phases = within(schedule).getAllByRole("heading", { level: 3 });
    expect(phases.map((heading) => heading.textContent)).toEqual(["Registrasi", "Karya", "Seleksi", "Final"]);
    const listed = phases.flatMap((heading) =>
      Array.from(heading.nextElementSibling!.querySelectorAll("li"), (item) => ({
        phase: heading.textContent,
        date: item.querySelector("time")?.textContent,
        dateTime: item.querySelector("time")?.getAttribute("datetime"),
        text: item.querySelector("span")?.textContent,
      })),
    );
    expect(listed).toEqual(techLeague.timeline.map((step) => ({
      phase: step.phase,
      date: rangeLabel(step.start, "end" in step ? step.end : undefined),
      dateTime: step.start,
      text: step.label + ("note" in step ? step.note : ""),
    })));
    expect(listed).toHaveLength(14);
    for (const note of ["Tiga cabang dinilai bersamaan.", "Lima finalis tiap cabang.", "Lewat poster lima finalis tiap cabang.", "Minggu, tiga cabang bersamaan.", "Sabtu. Tempat diumumkan kemudian."]) {
      expect(within(schedule).getByText(note).tagName).toBe("SMALL");
    }
    expect(within(schedule).getByText("10 Desember 2026 – 4 Januari 2027").nextElementSibling?.textContent).toBe("Registrasi reguler");
    expect(within(schedule).getByText("30 Januari 2027").nextElementSibling?.textContent).toBe("Awarding luringSabtu. Tempat diumumkan kemudian.");
  });

  it("opens registration on 7 December in the FAQ and runs the Event from 7 December to 30 January", () => {
    const { container } = render(<LeaguePage />);
    expect(screen.getByText("Bagaimana cara mendaftar?").nextElementSibling?.textContent).toContain("saat pendaftaran dibuka pada 7 Desember 2026.");
    const [event, faq] = jsonLd(container);
    expect(event).toMatchObject({ "@type": "Event", startDate: "2026-12-07", endDate: "2027-01-30", location: { "@type": "VirtualLocation" } });
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity[0].acceptedAnswer.text).toContain("7 Desember 2026");
  });
});

describe.each([
  { path: "/league", Page: LeaguePage, schedule: null },
  { path: "/program", Page: ProgramPage, schedule: "Pendaftaran 7 Desember 2026 – 6 Januari 2027." },
  { path: "/bergabung", Page: JoinPage, schedule: "Pendaftaran tim dibuka 7 Desember 2026 – 6 Januari 2027." },
])("$path", ({ Page, schedule }) => {
  it("carries no date from the 4 November timeline, in the page or its JSON-LD", () => {
    const { container } = render(<Page />);
    expect(container.innerHTML).not.toMatch(oldDate);
    expect(JSON.stringify(jsonLd(container))).not.toMatch(oldDate);
    if (schedule) {
      expect(container.querySelector(`a[href='${techLeague.href}'] .program-schedule`)?.textContent).toBe(schedule);
    }
  });
});
