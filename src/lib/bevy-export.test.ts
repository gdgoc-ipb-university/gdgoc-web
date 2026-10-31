import { describe, expect, it } from "vitest";
import { bevyConsentNote, bevyCsv, bevyFileName, splitName } from "./bevy-export";

describe("Bevy member import file", () => {
  it("splits a full name into the first word and the rest", () => {
    expect(splitName("  Rania  Putri Ayu ")).toEqual({ first: "Rania", last: "Putri Ayu" });
    expect(splitName("Budi")).toEqual({ first: "Budi", last: "" });
  });

  it("writes Bevy's template: byte order mark, its header, CRLF, sorted by name, quoted and formula-safe cells", () => {
    expect(bevyCsv([
      { email: "rania@gmail.com", name: "Rania Putri, S.Kom" }, { email: "budi@gmail.com", name: "Budi" }, { email: "x@gmail.com", name: "Zed =Cmd" },
    ])).toBe('\uFEFFemail,first_name,last_name\r\nbudi@gmail.com,Budi,\r\nrania@gmail.com,Rania,"Putri, S.Kom"\r\nx@gmail.com,Zed,\'=Cmd\r\n');
  });

  it("names the file after the cohort and the WIB date, and words the consent note", () => {
    expect(bevyFileName("catalyst-2026", Date.parse("2026-11-29T18:00:00Z"))).toBe("bevy-catalyst-2026-2026-11-30.csv");
    expect(bevyConsentNote("GDGoC Catalyst 2026/27")).toBe("Menyetujui bergabung sebagai member GDG on Campus IPB University lewat form pendaftaran GDGoC Catalyst 2026/27.");
  });
});
