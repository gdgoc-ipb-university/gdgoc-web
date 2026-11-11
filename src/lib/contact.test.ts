import { describe, expect, it } from "vitest";
import { discordError, isDiscord, isWhatsapp, normalizeDiscord, normalizeWhatsapp, whatsappError, whatsappLink } from "./contact";

const whatsapp = (value: string) => { const clean = normalizeWhatsapp(value); return isWhatsapp(clean) ? clean : null; };
const discord = (value: string) => { const clean = normalizeDiscord(value); return isDiscord(clean) ? clean : null; };

describe("WhatsApp numbers", () => {
  it("accepts 08…, 628… and +628… with spaces, dashes or dots, and stores +628…", () => {
    for (const input of ["081234567890", "0812 3456 7890", "0812-3456-7890", "0812.3456.7890", "6281234567890", "62 812-3456-7890", "+6281234567890", " +62 812 3456 7890 "]) {
      expect(whatsapp(input), input).toBe("+6281234567890");
    }
    // 9 and 13 digits after +62 are the shortest and longest allowed.
    expect(whatsapp("0812345678")).toBe("+62812345678");
    expect(whatsapp("+62 8123 4567 8901 2")).toBe("+628123456789012");
  });

  it("refuses numbers that are not Indonesian mobile numbers", () => {
    for (const input of ["", "0812345", "08123456789012345", "0251 862 1234", "+62 251 862 1234", "+1 415 555 0100", "812 3456 7890", "0812 3456 789O", "+62 (812) 3456 7890", "+62 0812 3456 7890"]) {
      expect(whatsapp(input), input).toBeNull();
    }
    expect(whatsappError("")).toMatch(/Tulis nomor WhatsApp/);
    expect(whatsappError(normalizeWhatsapp("0251 862 1234"))).toMatch(/nomor HP Indonesia/);
    expect(whatsappError("+6281234567890")).toBe("");
  });

  it("links a stored number to a WhatsApp chat", () => {
    expect(whatsappLink("+6281234567890")).toBe("https://wa.me/6281234567890");
  });
});

describe("Discord usernames", () => {
  it("drops a leading @, lowercases, and allows letters, digits, _ and . from 2 to 32 characters", () => {
    expect(discord("@Rania.Dev")).toBe("rania.dev");
    expect(discord("＠rania_dev")).toBe("rania_dev");
    expect(discord(" rania_2026 ")).toBe("rania_2026");
    expect(discord("ab")).toBe("ab");
    expect(discord("a".repeat(32))).toBe("a".repeat(32));
  });

  it("refuses other characters and lengths, and lets the field stay empty", () => {
    for (const input of ["a", "@a", "a".repeat(33), "rania dev", "rania-dev", "rania#1234", "@@rania", "ráni"]) expect(discord(input), input).toBeNull();
    expect(discordError("")).toBe("");
    expect(discordError("a")).toMatch(/2 sampai 32/);
    expect(discordError("rania#1234")).toMatch(/huruf, angka/);
  });
});
