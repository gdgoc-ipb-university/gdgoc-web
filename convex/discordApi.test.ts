import { afterEach, describe, expect, it, vi } from "vitest";
import { addGuildMember, currentUser, isRetryable } from "./discordApi";

const member = { guildId: "900000000000000001", userId: "111", accessToken: "user-token", botToken: "bot-token" };
const answer = (response: Response | Error) => vi.stubGlobal("fetch", vi.fn(async () => { if (response instanceof Error) throw response; return response; }));

afterEach(() => vi.unstubAllGlobals());

describe("Discord REST calls", () => {
  it("reads the account behind a member's token", async () => {
    answer(Response.json({ id: "111", username: "temanuji", global_name: "Teman", email: null }));
    expect(await currentUser("user-token")).toEqual({ ok: true, status: 200, data: { id: "111", username: "temanuji" } });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("https://discord.com/api/v10/users/@me", expect.objectContaining({
      method: "GET", headers: expect.objectContaining({ authorization: "Bearer user-token", "user-agent": expect.stringMatching(/^DiscordBot \(/) }),
    }));
  });

  it("treats added and already a member alike", async () => {
    answer(new Response(null, { status: 204 }));
    expect(await addGuildMember(member)).toEqual({ ok: true, status: 204, data: null });
    answer(Response.json({ user: { id: "111" } }, { status: 201 }));
    expect(await addGuildMember(member)).toEqual({ ok: true, status: 201, data: null });
  });

  it("returns how long a 429 asks to wait, from the body or the header", async () => {
    answer(Response.json({ message: "You are being rate limited.", retry_after: 1.234, global: false }, { status: 429 }));
    const limited = await addGuildMember(member);
    expect(limited).toEqual({ ok: false, status: 429, message: "You are being rate limited.", retryAfterMs: 1234 });
    if (!limited.ok) expect(isRetryable(limited)).toBe(true);
    answer(new Response("slow down", { status: 429, headers: { "retry-after": "3" } }));
    expect(await addGuildMember(member)).toMatchObject({ status: 429, retryAfterMs: 3000 });
  });

  it("keeps Discord's error code, and calls a network failure status 0", async () => {
    answer(Response.json({ message: "Missing Permissions", code: 50013 }, { status: 403 }));
    const refused = await addGuildMember(member);
    expect(refused).toEqual({ ok: false, status: 403, code: 50013, message: "Missing Permissions" });
    if (!refused.ok) expect(isRetryable(refused)).toBe(false);
    answer(new TypeError("fetch failed"));
    const offline = await currentUser("user-token");
    expect(offline).toEqual({ ok: false, status: 0, message: "fetch failed" });
    if (!offline.ok) expect(isRetryable(offline)).toBe(true);
  });

  it("never puts anything but Discord IDs into the path", async () => {
    answer(new Response(null, { status: 204 }));
    expect(await addGuildMember({ ...member, userId: "../../users/@me" })).toMatchObject({ ok: false, status: 400 });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
