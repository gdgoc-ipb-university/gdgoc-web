import { describe, expect, it } from "vitest";
import { changedProfileFields, instagramChangedLabel, normalizeProfile, profileDraft, profileFieldsLabel, validateProfile } from "./profile-edit";

const values = { fullName: "Rania Putri", institutionKind: "campus" as const, campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "rania.putri" };

describe("profile edits", () => {
  it("normalises and validates like onboarding, with the kind required", () => {
    expect(normalizeProfile({ ...values, fullName: " Rania   Putri ", instagram: "@Rania.Putri" })).toEqual(values);
    expect(validateProfile(values)).toEqual({});
    expect(Object.keys(validateProfile({ fullName: "", campus: "", studyProgram: "", instagram: "a..b" }))).toEqual(["fullName", "institutionKind", "campus", "studyProgram", "instagram"]);
    expect(validateProfile({ ...values, institutionKind: "school", campus: "" })).toEqual({ campus: "Isi atau pilih nama sekolahmu." });
  });

  it("lists the answers that differ from the stored profile, in form order", () => {
    expect(changedProfileFields(values, values)).toEqual([]);
    expect(changedProfileFields({ ...values, institutionKind: undefined, instagram: undefined }, { ...values, fullName: "Rania P." })).toEqual(["fullName", "institutionKind", "instagram"]);
  });

  it("names logged fields in words, in form order", () => {
    expect(profileFieldsLabel("instagram,fullName")).toBe("nama dan username Instagram");
    expect(profileFieldsLabel("campus")).toBe("sekolah/kampus");
    expect(profileFieldsLabel("")).toBe("profil");
  });

  it("reads a stored profile as form values, a campus where the kind was never asked", () => {
    expect(profileDraft({ fullName: "Rania", campus: "IPB University", studyProgram: "Ilmu Komputer" })).toEqual({ fullName: "Rania", institutionKind: "campus", campus: "IPB University", studyProgram: "Ilmu Komputer", instagram: "" });
    expect(profileDraft({ fullName: "Rania" }).institutionKind).toBeUndefined();
  });

  it("labels the Instagram change by its WIB day, with the year only when it is not this year's", () => {
    const now = Date.UTC(2026, 10, 20, 3);
    expect(instagramChangedLabel(Date.UTC(2026, 10, 12, 3), now)).toBe("Instagram diubah 12 Nov");
    // 17:30 UTC is already the next day in WIB.
    expect(instagramChangedLabel(Date.UTC(2026, 10, 12, 17, 30), now)).toBe("Instagram diubah 13 Nov");
    expect(instagramChangedLabel(Date.UTC(2025, 7, 3, 3), now)).toBe("Instagram diubah 3 Agu 2025");
  });
});
