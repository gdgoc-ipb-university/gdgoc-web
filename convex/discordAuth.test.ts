import { betterAuth } from "better-auth/minimal";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discordAuthOptions, type DiscordLinkCheck } from "./discordAuth";

const base = "http://localhost:3104";
type Row = Record<string, unknown>;

/** Better Auth with the site's Discord options over an in-memory database. Email sign-up stands in for Google here. */
function setup(check: DiscordLinkCheck = async () => null) {
  const db: Record<string, Row[]> = { user: [], session: [], account: [], verification: [] };
  const discord = discordAuthOptions({ clientId: "discord-client", clientSecret: "discord-secret" }, check);
  const auth = betterAuth({
    baseURL: base, secret: "test-secret-that-is-long-enough-for-better-auth", database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    socialProviders: { google: { clientId: "google-client", clientSecret: "google-secret" }, ...discord.socialProviders },
    account: { encryptOAuthTokens: true, accountLinking: discord.accountLinking },
    hooks: { before: discord.before },
    rateLimit: { enabled: false },
  });
  return { auth, db };
}

const cookieOf = (headers: Headers) => headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");

async function member(auth: ReturnType<typeof setup>["auth"], email: string) {
  const { headers } = await auth.api.signUpEmail({ body: { email, password: "kata-sandi-uji-123", name: "Teman Uji" }, returnHeaders: true });
  return new Headers({ cookie: cookieOf(headers), origin: base });
}

/** Discord's token and profile endpoints, answering for one Discord account that has an email. */
function discordAnswers(id: string) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://discord.com/api/oauth2/token")) return Response.json({ access_token: `token-${id}`, token_type: "Bearer", expires_in: 604800, refresh_token: `refresh-${id}`, scope: "identify guilds.join" });
    if (decodeURIComponent(url) === "https://discord.com/api/users/@me") return Response.json({ id, username: "temanuji", global_name: "Teman", avatar: null, discriminator: "0", email: "teman@example.com", verified: true });
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function callback(auth: ReturnType<typeof setup>["auth"], authorizeUrl: string, cookie: string) {
  const state = new URL(authorizeUrl).searchParams.get("state");
  return auth.handler(new Request(`${base}/api/auth/callback/discord?code=kode&state=${state}`, { headers: { cookie } }));
}

async function startLink(auth: ReturnType<typeof setup>["auth"], headers: Headers) {
  const { headers: set, response } = await auth.api.linkSocialAccount({
    body: { provider: "discord", callbackURL: "/dashboard/profil?discord=terhubung", errorCallbackURL: "/dashboard/profil?discord=gagal" },
    headers, returnHeaders: true,
  });
  return { url: response.url, cookie: [headers.get("cookie"), cookieOf(set)].filter(Boolean).join("; ") };
}

afterEach(() => vi.unstubAllGlobals());

describe("Discord in Better Auth", () => {
  it("links a signed-in account with only identify and guilds.join, leaving its name and email alone", async () => {
    const { auth, db } = setup();
    const headers = await member(auth, "anggota@example.com");
    const link = await startLink(auth, headers);
    const authorize = new URL(link.url);
    expect(authorize.origin + authorize.pathname).toBe("https://discord.com/api/oauth2/authorize");
    expect(authorize.searchParams.get("scope")).toBe("identify guilds.join");
    expect(authorize.searchParams.get("redirect_uri")).toBe(`${base}/api/auth/callback/discord`);

    discordAnswers("111");
    const response = await callback(auth, link.url, link.cookie);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/dashboard/profil?discord=terhubung");
    const user = db.user[0];
    expect(db.account.filter((row) => row.providerId === "discord")).toEqual([expect.objectContaining({ userId: user.id, accountId: "111" })]);
    expect(user).toMatchObject({ email: "anggota@example.com", name: "Teman Uji" });
  });

  it("refuses a Discord account another member already linked, with a code the page explains", async () => {
    const { auth, db } = setup();
    const first = await startLink(auth, await member(auth, "pertama@example.com"));
    discordAnswers("222");
    await callback(auth, first.url, first.cookie);
    const second = await startLink(auth, await member(auth, "kedua@example.com"));
    const response = await callback(auth, second.url, second.cookie);
    expect(response.headers.get("location")).toBe("/dashboard/profil?discord=gagal&error=account_already_linked_to_different_user");
    expect(db.account.filter((row) => row.providerId === "discord")).toHaveLength(1);
  });

  it("asks the site before linking and takes no extra scopes", async () => {
    const check = vi.fn(async () => "Akun ini sedang dinonaktifkan.");
    const { auth } = setup(check);
    const headers = await member(auth, "nonaktif@example.com");
    await expect(auth.api.linkSocialAccount({ body: { provider: "discord", callbackURL: "/dashboard/profil" }, headers })).rejects.toMatchObject({ body: { message: "Akun ini sedang dinonaktifkan." } });
    expect(check).toHaveBeenCalledOnce();
    await expect(auth.api.linkSocialAccount({ body: { provider: "discord", callbackURL: "/dashboard/profil", scopes: ["email"] }, headers })).rejects.toMatchObject({ body: { code: "DISCORD_LINK_SCOPES" } });
  });

  it("never signs anyone in or creates an account through Discord", async () => {
    const { auth, db } = setup();
    const headers = await member(auth, "teman@example.com");
    const link = await startLink(auth, headers);
    discordAnswers("333");
    await callback(auth, link.url, link.cookie);
    const counts = () => ({ users: db.user.length, sessions: db.session.length, accounts: db.account.length });
    const before = counts();

    // Lock 1: the sign-in endpoint refuses Discord, over HTTP and on the server.
    await expect(auth.api.signInSocial({ body: { provider: "discord", callbackURL: "/" } })).rejects.toMatchObject({ statusCode: 403 });
    const refused = await auth.handler(new Request(`${base}/api/auth/sign-in/social`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ provider: "discord", callbackURL: "/" }) }));
    expect(refused.status).toBe(403);

    // Lock 2: a sign-in state replayed on Discord's callback, for the Discord account that is linked and whose Discord
    // email matches a member, stops before any account is looked up, so nobody is signed in or created.
    const { headers: set, response } = await auth.api.signInSocial({ body: { provider: "google", callbackURL: "/", errorCallbackURL: "/masuk-gagal" }, returnHeaders: true });
    const forged = await callback(auth, response.url!, cookieOf(set));
    expect(forged.status).toBe(302);
    expect(forged.headers.get("location")).toBe("/masuk-gagal?error=email_not_found");
    expect(forged.headers.getSetCookie().some((cookie) => cookie.includes("session_token=") && !cookie.includes("Max-Age=0"))).toBe(false);
    expect(counts()).toEqual(before);

    // Lock 3: sign-up is off for the provider.
    expect(discordAuthOptions({ clientId: "a", clientSecret: "b" }, async () => null).socialProviders.discord).toMatchObject({ disableSignUp: true, disableDefaultScope: true });
  });

  it("leaves Discord out of Better Auth until it is set up", () => {
    expect(discordAuthOptions(null, async () => null).socialProviders).toEqual({});
  });
});
