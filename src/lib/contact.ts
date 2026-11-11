/**
 * How handlers reach a member (#251): an Indonesian WhatsApp number and, if given, a Discord username. The form and
 * the server both read values through these, so what the form accepts is what the server stores.
 */

/** "0812-3456 7890", "62 812…" or "+62 812…" → "+6281234567890". Anything else comes back without its separators. */
export function normalizeWhatsapp(value: string) {
  const digits = value.trim().replace(/[\s.-]/g, "");
  if (digits.startsWith("08")) return `+62${digits.slice(1)}`;
  if (digits.startsWith("628")) return `+${digits}`;
  return digits;
}

/** A stored number: +62, then a mobile number of 9 to 13 digits starting with 8. */
export const isWhatsapp = (value: string) => /^\+628\d{8,12}$/.test(value);

/** A field error for a normalised number, or "" when it is fine. */
export function whatsappError(value: string) {
  if (!value) return "Tulis nomor WhatsApp-mu.";
  return isWhatsapp(value) ? "" : "Tulis nomor HP Indonesia, misalnya 0812 3456 7890.";
}

/** The tap-to-chat link for a stored number. */
export const whatsappLink = (value: string) => `https://wa.me/${value.replace(/^\+/, "")}`;

/** "@Rania.Dev " → "rania.dev". The fullwidth ＠ of some keyboards is dropped too. */
export const normalizeDiscord = (value: string) => value.trim().replace(/^[@＠]/, "").toLowerCase();

/** Discord's username format: letters, digits, "_" and ".", 2 to 32 characters. */
export const isDiscord = (value: string) => /^[a-z0-9_.]{2,32}$/.test(value);

/** A field error for a normalised username, or "" when it is fine or left empty. */
export function discordError(value: string) {
  if (!value || isDiscord(value)) return "";
  return value.length < 2 || value.length > 32 ? "Username Discord terdiri dari 2 sampai 32 karakter." : "Username Discord hanya berisi huruf, angka, _ dan titik.";
}
