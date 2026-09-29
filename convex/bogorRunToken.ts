/**
 * Stateless Bogor Run tokens: base64url(JSON { v: 1, seed, issuedAt, nonce }) + "." + base64url(HMAC-SHA256).
 * The key is HMAC(BETTER_AUTH_SECRET, CONTEXT), so no new secret is needed and it never signs anything else.
 */
export type RunClaim = { v: 1; seed: number; issuedAt: number; nonce: string };

const CONTEXT = "gdgoc:bogor-run:token:v1";
const MAX_TOKEN = 256;
const encoder = new TextEncoder();
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function toBase64Url(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + (i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : "") + (i + 2 < bytes.length ? ALPHABET[n & 63] : "");
  }
  return out;
}

/** Strict: only the canonical unpadded encoding decodes, so one payload has exactly one spelling. */
export function fromBase64Url(text: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor(text.length * 3 / 4));
  let bits = 0, value = 0, at = 0;
  for (const char of text) {
    value = (value << 6) | ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes[at++] = (value >> bits) & 255; }
  }
  return value & ((1 << bits) - 1) ? null : bytes;
}

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, data));
}

async function signature(body: string, secret: string) {
  return hmac(await hmac(encoder.encode(secret), encoder.encode(CONTEXT)), encoder.encode(body));
}

/** Random, URL-safe and 128 bits: unique per token, which is what makes a submission single-use. */
export function newNonce() { return toBase64Url(crypto.getRandomValues(new Uint8Array(16))); }

/** Null when BETTER_AUTH_SECRET is missing, so the game falls back to unranked play. */
export async function signToken(claim: RunClaim, secret = process.env.BETTER_AUTH_SECRET) {
  if (!secret) return null;
  const body = toBase64Url(encoder.encode(JSON.stringify(claim)));
  return `${body}.${toBase64Url(await signature(body, secret))}`;
}

/** The claim of a well-formed token with a valid signature, otherwise null. */
export async function verifyToken(token: string, secret = process.env.BETTER_AUTH_SECRET): Promise<RunClaim | null> {
  if (!secret || token.length > MAX_TOKEN) return null;
  const [body, sig, extra] = token.split(".");
  const given = fromBase64Url(sig ?? "");
  if (!body || !given || extra !== undefined) return null;
  const expected = await signature(body, secret);
  let diff = given.length ^ expected.length; // Constant time over the full expected length.
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ (given[i] ?? 0);
  if (diff) return null;
  const bytes = fromBase64Url(body);
  let claim: unknown;
  try { claim = bytes && JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return null; }
  if (!claim || typeof claim !== "object" || Object.keys(claim).length !== 4) return null;
  const { v, seed, issuedAt, nonce } = claim as Record<string, unknown>;
  const valid = v === 1 && Number.isInteger(seed) && (seed as number) >= 0 && (seed as number) <= 0xffffffff
    && Number.isSafeInteger(issuedAt) && (issuedAt as number) > 0 && typeof nonce === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(nonce);
  return valid ? { v: 1, seed: seed as number, issuedAt: issuedAt as number, nonce: nonce as string } : null;
}
