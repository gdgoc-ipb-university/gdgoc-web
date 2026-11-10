import { describe, expect, it } from "vitest";
import { campusOptions, loadCampusOptions, loadSchoolOptions, searchEducation, type EducationOption } from "./education-options";

const options: EducationOption[] = [
  { name: "SMKN 1 BOGOR", detail: "Kota Bogor · Bogor Tengah" },
  { name: "SMKS PGRI 1 BOGOR", detail: "Kota Bogor · Bogor Barat" },
  { name: "SMKN 1 DEPOK", detail: "Kota Depok · Pancoran Mas" },
  { name: "SMK BINA INFORMATIKA", keywords: "BI", detail: "Kab. Bogor · Cibinong" },
];

describe("education suggestions", () => {
  it("ranks a name that starts with the search first, then a word, then any match", () => {
    expect(searchEducation(options, "smkn 1").map((option) => option.name)).toEqual(["SMKN 1 BOGOR", "SMKN 1 DEPOK"]);
    expect(searchEducation(options, "bogor").map((option) => option.name)).toEqual(["SMKN 1 BOGOR", "SMKS PGRI 1 BOGOR", "SMK BINA INFORMATIKA"]);
    expect(searchEducation(options, "informatika")[0].name).toBe("SMK BINA INFORMATIKA");
  });

  it("ignores spacing, case and punctuation, and searches the place and keywords", () => {
    expect(searchEducation(options, "SMK N 1 Depok").map((option) => option.name)).toEqual(["SMKN 1 DEPOK"]);
    expect(searchEducation(options, "smkn1bogor").map((option) => option.name)).toEqual(["SMKN 1 BOGOR"]);
    expect(searchEducation(options, "cibinong").map((option) => option.name)).toEqual(["SMK BINA INFORMATIKA"]);
    expect(searchEducation(options, "tidak ada")).toEqual([]);
  });

  it("keeps the list short and puts earlier options first on a tie", () => {
    expect(searchEducation(options, "", 2)).toEqual(options.slice(0, 2));
    expect(searchEducation(options, "smk", 3)).toHaveLength(3);
  });

  it("loads the national campus list after the Bogor campuses, without repeating them, and the SMA and SMK list", async () => {
    const campuses = await loadCampusOptions();
    expect(campuses.slice(0, campusOptions.length)).toEqual(campusOptions);
    const names = campuses.map((option) => option.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((name) => /^Institut Pertanian Bogor$/i.test(name))).toEqual([]);
    const schools = (await loadSchoolOptions()).map((option) => option.name);
    expect(new Set(schools).size).toBe(schools.length);
    expect(schools).toEqual(expect.arrayContaining(["SMAN 1 BOGOR", "MAN 1 KOTA BOGOR", "SMKN 1 BOGOR"]));
  });
});
