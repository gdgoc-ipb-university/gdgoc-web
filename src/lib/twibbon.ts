// The member intake twibbon (#203): the frame, the carousel's second slide, where a photo sits under the frame, and the
// caption. The frame and slide are exported from Figma (Feeds › Twibbon, "Member 1" and "Member 2"); see README.md.
export const twibbon = {
  path: "/twibbon",
  /** Instagram's 3:4 portrait post, the size the frame is drawn at. */
  width: 1080,
  height: 1440,
  /** PNG with a transparent window: whatever is drawn first shows through it. */
  frame: "/twibbon/member-2026-27.png",
  slide: "/twibbon/member-2026-27-slide-2.jpg",
  fileName: "gdgoc-ipb-member-2026-27-twibbon.jpg",
  slideFileName: "gdgoc-ipb-member-2026-27-slide-2.jpg",
  /** Zoom range: 1 just covers the canvas; below 1 the photo shrinks inside the frame on white (#215). */
  minZoom: 0.3,
  maxZoom: 4,
  /** What shows where the photo does not reach. */
  background: "#ffffff",
  /** Every twibbon post must carry it (#205). */
  hashtag: "#OprecMemberGDGOCIPB2627",
} as const;

export type ImageSize = { width: number; height: number };
/** The photo's zoom (1 fills the canvas) and the offset of its centre from the canvas centre, in canvas pixels. */
export type Placement = { zoom: number; x: number; y: number };

export const initialPlacement: Placement = { zoom: 1, x: 0, y: 0 };

const clamp = (value: number, limit: number) => Math.min(Math.max(value, -limit), limit);

/** The photo's size on the canvas: at zoom 1 it just covers the whole canvas, like `object-fit: cover`. */
function drawnSize(photo: ImageSize, zoom: number) {
  const scale = Math.max(twibbon.width / photo.width, twibbon.height / photo.height) * zoom;
  return { width: photo.width * scale, height: photo.height * scale };
}

/**
 * Keeps the zoom in range and the photo where it belongs: along an axis where it is larger than the canvas it never
 * leaves a gap at an edge; where it is smaller (zoomed out) it stays inside the canvas.
 */
export function clampPlacement(photo: ImageSize, place: Placement): Placement {
  const zoom = Math.min(Math.max(place.zoom, twibbon.minZoom), twibbon.maxZoom);
  const { width, height } = drawnSize(photo, zoom);
  return { zoom, x: clamp(place.x, Math.abs(width - twibbon.width) / 2), y: clamp(place.y, Math.abs(height - twibbon.height) / 2) };
}

/** Where to draw the photo on the canvas for a placement, which is clamped first. */
export function photoRect(photo: ImageSize, place: Placement) {
  const { zoom, x, y } = clampPlacement(photo, place);
  const { width, height } = drawnSize(photo, zoom);
  return { left: (twibbon.width - width) / 2 + x, top: (twibbon.height - height) / 2 + y, width, height };
}

export type CaptionFields = { name: string; origin: string; friends: string };

/** Instagram handles from what was typed: separated by spaces or commas, each with one leading @. */
export function friendTags(friends: string) {
  return friends.split(/[\s,]+/).map((tag) => tag.replace(/^@+/, "")).filter(Boolean).map((tag) => `@${tag}`);
}

/** The caption to paste under the post. Blank fields stay as placeholders so the gaps are easy to spot. */
export function twibbonCaption({ name, origin, friends }: CaptionFields) {
  const tags = friendTags(friends);
  return [
    `Halo, aku ${name.trim() || "[nama]"} dari ${origin.trim() || "[sekolah/kampus]"}. Aku daftar jadi member GDGoC IPB University 2026/27!`,
    "",
    "Di GDGoC IPB aku bisa ikut Study Jam, networking lintas kampus, dan didampingi mentor lewat Tech Support saat ikut lomba teknologi. Pendaftarannya terbuka untuk umum, mahasiswa dan siswa SMA/SMK.",
    "",
    "Yuk daftar juga di gdgocipb.com. Guidebook: gdgocipb.com/gb-member",
    "",
    `@gdgoc.ipb ${tags.length ? tags.join(" ") : "@teman1 @teman2 @teman3"}`,
    "",
    `${twibbon.hashtag} #GDGoCIPB #GoogleDeveloperGroups`,
  ].join("\n");
}
