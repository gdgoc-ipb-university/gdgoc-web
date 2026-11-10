import { describe, expect, it } from "vitest";
import { memberIntake, memberIntakeDates, memberIntakeState } from "./member-intake";

describe("member intake 2026/27", () => {
  it("opens at midnight WIB on 10 November and closes after 30 November ends, WIB", () => {
    const at = (iso: string) => Date.parse(iso);
    expect(memberIntakeState(at("2026-11-09T23:59:59+07:00"))).toBe("upcoming");
    expect(memberIntakeState(at("2026-11-09T17:00:00Z"))).toBe("open"); // 00:00 WIB on 10 November
    expect(memberIntakeState(at("2026-11-20T12:00:00+07:00"))).toBe("open");
    expect(memberIntakeState(at("2026-11-30T23:59:59+07:00"))).toBe("open");
    expect(memberIntakeState(at("2026-12-01T00:00:00+07:00"))).toBe("closed");
  });

  it("says the dates as the intake posts do", () => {
    expect(memberIntakeDates).toBe("10–30 November 2026");
  });

  it("sends people to registration, the twibbon maker and the guidebook, with the required hashtag", () => {
    expect(memberIntake.links).toEqual({ register: "/dashboard", twibbon: "/twibbon", guidebook: "/gb-member" });
    expect(memberIntake.hashtag).toBe("#OprecMemberGDGOCIPB2627");
  });
});
