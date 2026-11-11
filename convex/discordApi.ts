/**
 * Every call the site makes to Discord's REST API (#242), so tests mock one module and the role sync (#243) adds its
 * calls here. Nothing throws: a call returns `ok` with the data, or the HTTP status (0 when the network failed) with
 * Discord's error code and, for a 429, how long Discord asked us to wait.
 */

const apiBase = "https://discord.com/api/v10";
/** Discord asks bots to name themselves in this form. */
const userAgent = "DiscordBot (https://github.com/gdgoc-ipb-university/gdgoc-web, 1)";
const snowflake = /^\d{1,20}$/;

export type DiscordFailure = { ok: false; status: number; code?: number; message: string; retryAfterMs?: number };
export type DiscordResult<T> = { ok: true; status: number; data: T } | DiscordFailure;
export type DiscordUser = { id: string; username: string };

/** Rate limits, Discord's own outages and network failures pass; anything else needs a person. */
export function isRetryable(failure: DiscordFailure) {
  return failure.status === 0 || failure.status === 429 || failure.status >= 500;
}

async function call<T>(path: string, auth: string, init: { method: "GET" | "PUT"; body?: unknown }): Promise<DiscordResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: init.method,
      headers: { authorization: auth, "user-agent": userAgent, ...(init.body === undefined ? {} : { "content-type": "application/json" }) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (cause) {
    return { ok: false, status: 0, message: cause instanceof Error ? cause.message : "Network error" };
  }
  const text = await response.text();
  let json: Record<string, unknown> | null = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (response.ok) return { ok: true, status: response.status, data: json as T };
  // A 429's body says how long to wait in seconds; the header is the fallback.
  const seconds = Number(json?.retry_after ?? response.headers.get("retry-after"));
  return {
    ok: false, status: response.status, message: typeof json?.message === "string" ? json.message : response.statusText,
    ...(typeof json?.code === "number" ? { code: json.code } : {}),
    ...(response.status === 429 && Number.isFinite(seconds) ? { retryAfterMs: Math.ceil(seconds * 1000) } : {}),
  };
}

/** The Discord account behind a member's OAuth token (`identify`). */
export async function currentUser(accessToken: string): Promise<DiscordResult<DiscordUser>> {
  const result = await call<{ id?: unknown; username?: unknown }>("/users/@me", `Bearer ${accessToken}`, { method: "GET" });
  if (!result.ok) return result;
  const { id, username } = result.data ?? {};
  if (typeof id !== "string" || typeof username !== "string") return { ok: false, status: result.status, message: "Discord returned no user" };
  return { ok: true, status: result.status, data: { id, username } };
}

/**
 * Discord's Add Guild Member: puts the user in the server with their own token (`guilds.join`) and the bot's. 201 means
 * added and 204 already a member; both are success. The bot must be in the server with Create Invite permission.
 */
export async function addGuildMember({ guildId, userId, accessToken, botToken }: { guildId: string; userId: string; accessToken: string; botToken: string }): Promise<DiscordResult<null>> {
  if (!snowflake.test(guildId) || !snowflake.test(userId)) return { ok: false, status: 400, message: "Invalid Discord ID" };
  const result = await call<unknown>(`/guilds/${guildId}/members/${userId}`, `Bot ${botToken}`, { method: "PUT", body: { access_token: accessToken } });
  return result.ok ? { ok: true, status: result.status, data: null } : result;
}
