import { describe, expect, it } from "vitest";
import { indexablePaths, siteUrl } from "./site";
import { registrationState, techLeague, techLeagueJsonLd } from "./tech-league";

const at = (iso: string) => Date.parse(iso);
const end = (step: { start: string; end?: string }) => step.end ?? step.start;

describe("Tech League schedule", () => {
  it("opens registration at midnight WIB on 7 December and closes it at the end of 6 January, WIB", () => {
    expect(registrationState(at("2026-11-11T12:00:00+07:00"))).toBe("upcoming");
    expect(registrationState(at("2026-12-06T23:59:59+07:00"))).toBe("upcoming");
    expect(registrationState(at("2026-12-06T17:00:00Z"))).toBe("open");
    expect(registrationState(at("2027-01-04T23:59:59+07:00"))).toBe("open");
    expect(registrationState(at("2027-01-06T23:59:59+07:00"))).toBe("open");
    expect(registrationState(at("2027-01-06T17:00:00Z"))).toBe("closed");
  });

  it("runs registration from the early wave to the end of the extension", () => {
    const registration = techLeague.timeline.filter((step) => step.phase === "Registrasi");
    expect(registration.map((step) => [step.label, step.start, end(step)])).toEqual([
      ["Registrasi gelombang awal", "2026-12-07", "2026-12-09"],
      ["Registrasi reguler", "2026-12-10", "2027-01-04"],
      ["Perpanjangan registrasi", "2027-01-05", "2027-01-06"],
    ]);
    expect(registration[0].start).toBe(techLeague.registration.opensAt);
    expect(end(registration.at(-1)!)).toBe(techLeague.registration.closesAt);
    expect(techLeague.description).toContain("dibuka 7 Desember 2026");
  });

  it("keeps each phase together and in date order, ending with the awarding on 30 January", () => {
    const phases = techLeague.timeline.map((step) => step.phase);
    expect(phases.filter((phase, i) => phase !== phases[i - 1])).toEqual(["Registrasi", "Karya", "Seleksi", "Final"]);
    for (const phase of new Set(phases)) {
      const starts = techLeague.timeline.filter((step) => step.phase === phase).map((step) => step.start);
      expect([...starts].sort()).toEqual(starts);
    }
    for (const step of techLeague.timeline) expect(end(step) >= step.start, step.label).toBe(true);
    expect(techLeague.timeline).toHaveLength(14);
    expect(techLeague.timeline.at(-1)).toMatchObject({ label: "Awarding luring", start: "2027-01-30" });
  });

  it("lists the full timeline with Program & Development's dates and notes, everything by the awarding", () => {
    const rows = techLeague.timeline.map((step) => [step.label, step.start, end(step), "note" in step ? step.note : undefined]);
    expect(rows.slice(3)).toEqual([
      ["Pengerjaan karya", "2026-12-07", "2027-01-06", undefined],
      ["Batas pengumpulan karya dan poster", "2027-01-06", "2027-01-06", undefined],
      ["Seleksi preliminary", "2027-01-07", "2027-01-12", "Tiga cabang dinilai bersamaan."],
      ["Pengumuman finalis", "2027-01-13", "2027-01-13", "Lima finalis tiap cabang."],
      ["Voting juara favorit", "2027-01-13", "2027-01-20", "Lewat poster lima finalis tiap cabang."],
      ["Technical Meeting finalis", "2027-01-14", "2027-01-14", undefined],
      ["Persiapan presentasi final", "2027-01-14", "2027-01-16", undefined],
      ["Batas pitch deck", "2027-01-16", "2027-01-16", undefined],
      ["Final daring", "2027-01-17", "2027-01-17", "Minggu, tiga cabang bersamaan."],
      ["Pengumuman hasil akhir", "2027-01-20", "2027-01-20", undefined],
      ["Awarding luring", "2027-01-30", "2027-01-30", "Sabtu. Tempat diumumkan kemudian."],
    ]);
    // Everything happens before Ramadan: nothing after the awarding, and nothing before registration opens.
    for (const step of techLeague.timeline) {
      expect(step.start >= techLeague.registration.opensAt, step.label).toBe(true);
      expect(end(step) <= "2027-01-30", step.label).toBe(true);
    }
  });

  it("gives the landing five steps in order, with registration ending on 4 January", () => {
    expect(techLeague.milestones.map((step) => [step.label, step.start, end(step)])).toEqual([
      ["Registrasi", "2026-12-07", "2027-01-04"],
      ["Pengumpulan karya", "2027-01-06", "2027-01-06"],
      ["Seleksi karya", "2027-01-07", "2027-01-12"],
      ["Final (daring)", "2027-01-17", "2027-01-17"],
      ["Awarding (luring)", "2027-01-30", "2027-01-30"],
    ]);
    // The same days as the full timeline: regular registration's end, the submission deadline, the preliminary
    // selection, the final and the awarding.
    const item = (label: string) => techLeague.timeline.find((step) => step.label === label)!;
    expect(techLeague.milestones[0].end).toBe(end(item("Registrasi reguler")));
    expect(techLeague.milestones[1].start).toBe(item("Batas pengumpulan karya dan poster").start);
    expect(techLeague.milestones[2]).toMatchObject({ start: item("Seleksi preliminary").start, end: end(item("Seleksi preliminary")) });
    expect(techLeague.milestones[3].start).toBe(item("Final daring").start);
    expect(techLeague.milestones[4].start).toBe(item("Awarding luring").start);
  });

  it("describes the competition as one online event, from 7 December 2026 to the awarding on 30 January 2027", () => {
    const event = techLeagueJsonLd();
    expect(event).toMatchObject({ "@type": "Event", startDate: "2026-12-07", endDate: "2027-01-30", url: `${siteUrl}/program/tech-league`, eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode" });
    expect(event.description).toContain("dibuka 7 Desember 2026");
    expect(event.location).toEqual({ "@type": "VirtualLocation", url: event.url });
    expect(event.organizer["@id"]).toBe(`${siteUrl}/#organization`);
    expect(indexablePaths).toContain(techLeague.path);
  });
});
