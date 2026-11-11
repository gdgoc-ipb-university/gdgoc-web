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

/** What the site asks Discord for: who the account is, and leave to add it to the chapter server. Never the email. */
export const discordScopes = ["identify", "guilds.join"] as const;

/** "Buka server": the server in Discord's app or web client, for a member the site has added. */
export function discordServerUrl(guildId: string) {
  return `https://discord.com/channels/${guildId}`;
}

export type DiscordJoinStatus = "pending" | "joined" | "failed";
export const discordJoinLabels: Record<DiscordJoinStatus, string> = {
  pending: "Sedang masuk server", joined: "Sudah di server", failed: "Belum masuk server",
};

const dateInWib = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
/** "12 November 2026": the day a link was made, in WIB. */
export function discordLinkedDate(at: number) {
  return dateInWib.format(at);
}

/** Where a link attempt returns: the same page with `discord=terhubung`, or with Better Auth's `error` after `discord=gagal`. */
export function discordReturnUrls(here: string) {
  const url = new URL(here, "https://site.invalid");
  for (const key of ["discord", "error", "error_description"]) url.searchParams.delete(key);
  const back = (status: string) => {
    const next = new URL(url);
    next.searchParams.set("discord", status);
    return `${next.pathname}${next.search}`;
  };
  return { callbackURL: back("terhubung"), errorCallbackURL: back("gagal") };
}

/** The member's message for Better Auth's `error` code after a link attempt failed. */
export function discordLinkError(code: string | null) {
  if (code === "account_already_linked_to_different_user") return "Akun Discord ini sudah terhubung ke akun member lain. Masuk ke Discord dengan akun lain, lalu hubungkan lagi.";
  if (code === "access_denied") return "Kamu membatalkan izin di Discord, jadi Discord belum terhubung.";
  return "Discord belum bisa dihubungkan. Coba lagi sebentar lagi.";
}
