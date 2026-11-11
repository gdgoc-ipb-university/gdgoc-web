/**
 * Discord linking (#242, epic #241): members connect a Discord account to the account they signed in with through
 * Google, and the site adds them to the chapter's one server. Shared by Convex and the pages.
 */

/** The Convex environment variables Discord needs. Until all four are set, the Discord sections say it isn't set up yet. */
export const discordEnvNames = ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID"] as const;
/** `process.env` on a Convex deployment, or a test's values. */
export type DiscordEnv = Record<string, string | undefined>;
export type DiscordSettings = { clientId: string; clientSecret: string; botToken: string; guildId: string };

/** The one place that reads Discord's settings: all four values, trimmed, or null when any is missing. */
export function discordSettings(env: DiscordEnv): DiscordSettings | null {
  const [clientId, clientSecret, botToken, guildId] = discordEnvNames.map((name) => env[name]?.trim() ?? "");
  return clientId && clientSecret && botToken && guildId ? { clientId, clientSecret, botToken, guildId } : null;
}

/** "Buka server": the server in Discord's app or web client, for a member the site has added. */
export function discordServerUrl(guildId: string) {
  return `https://discord.com/channels/${guildId}`;
}
