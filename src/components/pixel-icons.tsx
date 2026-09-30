// Icons copied from Pixelarticons by Gerrit Halfmann (https://pixelarticons.com), MIT License.
// Each entry is the 24×24 path data of the original SVG; add new icons the same way.
const paths = {
  home: ["M4 20h16v2H4zm16-10h2v10h-2zM2 10h2v10H2zm2-2h2v2H4zm2-2h2v2H6zm2-2h2v2H8zm2-2h4v2h-4zm4 2h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2zM8 14h2v6H8zm2-2h4v2h-4zm4 2h2v6h-2z"],
  "clipboard-note": ["M20 12h2v8h-2zm-8-2h8v2h-8zm0 10h8v2h-8zm-2-8h2v8h-2zM6 2h8v2H6zm0 4h8v2H6zm0-2h2v2H6zm6 0h2v2h-2zm2 0h2v2h-2z", "M16 6h2v5h-2zM4 4h2v2H4zM2 6h2v12H2zm2 12h6v2H4zm2-8h4v2H6zm0 4h2v2H6zm11 2h5v2h-5z", "M16 16h2v6h-2z"],
  trophy: ["M16 17H13V19H15V21H9V19H11V17H8V15H16V17ZM18 5H22V11H20V7H18V11H20V13H18V15H16V5H8V15H6V13H4V11H6V7H4V11H2V5H6V3H18V5Z"],
  shield: ["M4 2h16v2H4zM2 4h2v10H2zm18 0h2v10h-2zM4 14h2v2H4zm2 2h2v2H6zm4 4h4v2h-4zm10-6h-2v2h2zm-2 2h-2v2h2zm-2 2h-2v2h2zm-6 0H8v2h2z"],
  users: ["M5 2h6v2H5zm10 0h4v2h-4zM5 10h6v2H5zm10 0h4v2h-4zm4-6h2v6h-2zm-8 0h2v6h-2zM3 4h2v6H3zM0 18h2v4H0zm14 0h2v4h-2zm8 0h2v4h-2zM4 14h8v2H4zm12 0h4v2h-4zM2 16h2v2H2zm10 0h2v2h-2zm8 0h2v2h-2z"],
  user: ["M9 2h6v2H9zm0 8h6v2H9zm6-6h2v6h-2zM7 4h2v6H7zM4 18h2v4H4zm14 0h2v4h-2zM8 14h8v2H8zm-2 2h2v2H6zm10 0h2v2h-2z"],
  logout: ["M8 11h12v2H8zm8-2h2v2h-2z", "M14 7h2v10h-2zm2 6h2v2h-2zM6 2h12v2H6zm0 18h12v2H6zM4 4h2v16H4zm14 0h2v3h-2zm0 13h2v3h-2z"],
  menu: ["M20 18H4v-2h16v2Zm0-5H4v-2h16v2Zm0-5H4V6h16v2Z"],
  close: ["M7 19H5V17H7V19ZM19 19H17V17H19V19ZM9 15V17H7V15H9ZM17 17H15V15H17V17ZM11 15H9V13H11V15ZM15 15H13V13H15V15ZM13 13H11V11H13V13ZM11 11H9V9H11V11ZM15 11H13V9H15V11ZM9 9H7V7H9V9ZM17 9H15V7H17V9ZM7 7H5V5H7V7ZM19 7H17V5H19V7Z"],
  copy: ["M8 6h12v2H8zM4 2h12v2H4zm2 6h2v12H6zM2 4h2v12H2zm6 16h12v2H8zM20 8h2v12h-2zm-4-4h2v2h-2zM4 16h2v2H4z"],
  check: ["M10 18H8v-2h2v2Zm-2-2H6v-2h2v2Zm4-2v2h-2v-2h2Zm-6 0H4v-2h2v2Zm8 0h-2v-2h2v2Zm2-2h-2v-2h2v2Zm2-2h-2V8h2v2Zm2-2h-2V6h2v2Z"],
  link: ["M4 6h7v2H4zm0 10h7v2H4zM2 8h2v8H2zm18-2h-7v2h7zm0 10h-7v2h7zm2-8h-2v8h2zM7 11h10v2H7z"],
  "external-link": ["M11 5H5v2h6V5ZM5 7H3v12h2V7Zm12 12H5v2h12v-2Zm2-6h-2v6h2v-6Zm-8 0H9v2h2v-2Zm2-2h-2v2h2v-2Zm2-2h-2v2h2V9Zm2-2h-2v2h2V7Zm2-2h-2v2h2V5Zm2-2h-2v8h2V3Z", "M21 3h-8v2h8V3Z"],
  upload: ["M19 21H5v-2h14v2ZM5 19H3v-4h2v4Zm16 0h-2v-4h2v4ZM13 5h2v2h2v2h-4v8h-2V9H7V7h2V5h2V3h2v2Z"],
  file: ["M6 4H4v16h2zm10-2H6v2h10zm4 4h-2v14h2zm-2 14H6v2h12zM16 4h2v2h-2zm-4 0h2v6h-2z", "M12 8h6v2h-6z"],
  clock: ["M6 2h12v2H6zM2 6h2v12H2zm18 0h2v12h-2zm-2-2h2v2h-2zM4 4h2v2H4zm2 18h12v-2H6zm12-2h2v-2h-2zM4 20h2v-2H4zm7-14h2v7h-2zm2 7h2v2h-2zm2 2h2v2h-2z"],
  plus: ["M13 11h7v2h-7v7h-2v-7H4v-2h7V4h2v7Z"],
  "arrow-left": ["M20 11v2H4v-2zM8 13v2H6v-2zm2 2v2H8v-2zm2 2v2h-2v-2zm-4-6V9H6v2z", "M10 15V7H8v8zm2 2V5h-2v12z"],
  "chevron-right": ["M16 13v-2h-2v2h2Zm-2-2V9h-2v2h2Zm0 4v-2h-2v2h2Zm-2-6V7h-2v2h2Zm0 8v-2h-2v2h2ZM10 7V5H8v2h2Zm0 12v-2H8v2h2Z"],
  "t-rex": ["M18 23H10V21H12V19H14V21H16V17H18V23ZM10 15H12V19H10V17H6V15H8V13H4V11H10V15ZM20 17H18V15H20V17ZM14 15H12V13H14V15ZM22 15H20V13H18V11H20V7H22V15ZM4 7H8V9H4V11H2V3H4V7ZM18 11H16V9H18V11ZM16 9H14V3H16V9ZM12 7H10V5H12V7ZM14 3H4V1H14V3Z"],
  eye: ["M16 20H8v-2h8v2Zm-8-2H4v-2h4v2Zm12 0h-4v-2h4v2ZM4 16H2v-2h2v2Zm10-6h-2v2h2v-2h2v4h-2v2h-4v-2H8v-4h2V8h4v2Zm8 6h-2v-2h2v2ZM2 14H0v-4h2v4Zm22 0h-2v-4h2v4ZM4 10H2V8h2v2Zm18 0h-2V8h2v2ZM8 8H4V6h4v2Zm12 0h-4V6h4v2Zm-4-2H8V4h8v2Z"],
  crown: ["M3 3h2v12H3zm16 0h2v12h-2zm-8 0h2v2h-2zM9 5h2v2H9zM5 5h2v2H5z", "M3 3h2v2H3zm4 4h2v2H7zm6-2h2v2h-2zm2 2h2v2h-2zm2-2h2v2h-2zM5 15h14v2H5zm-2 4h18v2H3z"],
  teach: ["M3 2h4v4H3zM2 8h12v2H2zm7-4h11v2H9zm1 10h10v2H10z", "M2 9h6v7H2zm0 7h2v4H2zm4 0h2v4H6zM20 6h2v8h-2z"],
  brush: ["M7 2h10v2H7zM5 4h2v10H5zm12-2h2v12h-2z", "M13 2h2v6h-2zM9 2h2v4H9zm-4 8h14v2H5zm2 4h10v2H7zm2 2h2v4H9zm4 0h2v4h-2zm-4 4h6v2H9z"],
  code: ["M11 18H9v-4h2v4Zm-4-1H5v-2h2v2Zm12-2v2h-2v-2h2ZM5 15H3v-2h2v2Zm16 0h-2v-2h2v2Zm-8-1h-2v-4h2v4ZM3 13H1v-2h2v2Zm20 0h-2v-2h2v2ZM5 11H3V9h2v2Zm16 0h-2V9h2v2Zm-6-1h-2V6h2v4ZM7 9H5V7h2v2Zm12 0h-2V7h2v2Z"],
  megaphone: ["M4 6h12v2H4zM2 8h2v6H2zm2 6h12v2H4zM20 2h2v18h-2zm-2 16h2v2h-2zm-2-2h2v2h-2zm0-12h2v2h-2zm2-2h2v2h-2zM8 8h2v6H8zm-2 8h2v4H6zm2 4h4v2H8zm2-4h2v4h-2z"],
  notebook: ["M6 2h14v2H6zm0 18h14v2H6zM20 4h2v16h-2zM4 4h2v16H4z", "M2 7h6v2H2zm0 4h6v2H2zm0 4h6v2H2zM16 4h2v16h-2z"],
  "heading-2": ["M3 6h2v12H3z", "M3 11h10v2H3z", "M11 6h2v12h-2zm4 10h6v2h-6zm0-2h2v2h-2zm2-2h2v2h-2zm2-2h2v2h-2zm-2-2h2v2h-2zm-2 0h2v2h-2z"],
  "heading-3": ["M3 6h2v12H3z", "M3 11h10v2H3z", "M11 6h2v12h-2zm4 10h4v2h-4zm4-2h2v2h-2zm-4-2h4v2h-4zm4-2h2v2h-2zm-2-2h2v2h-2zm-2 0h2v2h-2z"],
  bulletlist: ["M10 5h12v2H10zm0 4h8v2h-8zm0 4h12v2H10zm0 4h8v2h-8zm-4-6H4V9h2v2ZM4 9H2V7h2v2Zm4 0H6V7h2v2ZM6 7H4V5h2v2Zm-2 6h2v2H4zm0 4h2v2H4zm-2 0v-2h2v2zm4 0v-2h2v2z"],
  "quote-text-inline": ["M2 8h4v4H2zm6 0h4v4H8zM2 6h2v2H2zm6 0h2v2H8zM4 4h2v2H4zm6 0h2v2h-2zm4 2h8v2h-8zm0 4h8v2h-8zM2 14h20v2H2zm0 4h20v2H2z"],
  terminal: ["M4 2h16v2H4zm0 18h16v2H4zM2 4h2v16H2zm18 0h2v16h-2zM6 16h2v2H6zm2-2h2v2H8zm-2-2h2v2H6z"],
  unlink: ["M4 6h5v2H4zm11 0h5v2h-5zm0 10h5v2h-5zM4 16h5v2H4zm16-8h2v8h-2zM2 8h2v8H2zm9-4h2v16h-2z"],
  undo: ["M18 20h-6v-2h6v2Zm2-2h-2v-8h2v8Zm-10-4H8v-2H6v-2H4V8h2V6h2V4h2v4h8v2h-8v4Z"],
  redo: ["M20 8H6v2h14zM4 10h2v8H4zm2 8h6v2H6z", "M18 6h-2v6h2zm-2-2h-2v8h2zm0 8h-2v2h2z"],
  image: ["M4 2h16v2H4zm0 18h16v2H4zM2 4h2v16H2zm18 0h2v16h-2zm-4 8h2v2h-2zm-2 2h2v2h-2zm4 0h2v2h-2zm-8 0h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2z", "M20 16h2v2h-2zM8 16h2v2H8zm-2 2h2v2H6zM8 6h2v2H8zM6 8h2v2H6zm2 2h2v2H8zm2-2h2v2h-2z"],
  archive: ["M3 2h18v2H3zm0 5h18v2H3zM1 4h2v3H1zm20 0h2v3h-2zm-2 5h2v11h-2zM3 9h2v11H3zm2 11h14v2H5zm4-9h6v2H9z"],
  "file-text": ["M6 4H4v16h2zm10-2H6v2h10zm4 4h-2v14h2zm-2 14H6v2h12zM16 4h2v2h-2zm-4 0h2v6h-2z", "M12 8h6v2h-6zm-4 8h8v2H8zm0-4h8v2H8zm0-4h2v2H8z"],
  trash: ["M18 22H6V20H18V22ZM9 6H15V4H17V6H22V8H20V20H18V8H6V20H4V8H2V6H7V4H9V6ZM15 4H9V2H15V4Z"],
  // From Pixelarticons 2.4.1 (same license): arrows, media, sound, brand and misc icons used across the site.
  "arrow-right": ["M4 11v2h16v-2zm12 2v2h2v-2zm-2 2v2h2v-2zm-2 2v2h2v-2zm4-6V9h2v2z", "M14 15V7h2v8zm-2 2V5h2v12z"],
  "arrow-up": ["M11 20h2V4h-2zm2-12h2V6h-2zm2 2h2V8h-2zm2 2h2v-2h-2zm-6-4H9V6h2z", "M15 10H7V8h8zm2 2H5v-2h12z"],
  "arrow-down": ["M13 12h6v2h-2v2h-2v2h-2v2h-2v-2H9v-2H7v-2H5v-2h6V4h2v8Z"],
  download: ["M21 15v4h-2v-4zm-2 4v2H5v-2zM5 15v4H3v-4zm8-12v14h-2V3z", "M7 11v2h10v-2zm2 2v2h2v-2zm4 0v2h2v-2z", "M15 11v2h2v-2z"],
  play: ["M15 11h-2V9h2zm0 4h-2v-2h2zm-2 2h-2v-2h2zm0-8h-2V7h2zm-2-2H9V5h2zM9 21H7V3h2zm6-8h2v-2h-2zm-6 4h2v2H9z"],
  pause: ["M10 20H4V4h6v16Zm8-16v16h-6V4h6Zm-4 2v12h2V6h-2ZM6 18h2V6H6v12Z"],
  "volume-3": ["M11 22H9v-2H7v-2h2V6H7V4h2V2h2v20Zm8 0h-6v-2h6v2Zm2-2h-2v-2h2v2ZM7 18H5v-2h2v2Zm10 0h-4v-2h4v2Zm6 0h-2V6h2v12ZM5 10H3v4h2v2H1V8h4v2Zm14 6h-2V8h2v8Zm-4-2h-2v-4h2v4ZM7 8H5V6h2v2Zm10 0h-4V6h4v2Zm4-2h-2V4h2v2Zm-2-2h-6V2h6v2Z"],
  "volume-x": ["M13 22h-2v-2H9v-2h2V6H9V4h2V2h2v20Zm-4-4H7v-2h2v2Zm-2-8H5v4h2v2H3V8h4v2Zm10.001 5.224h-2v-2H17v-2h-1.999v-2h2v2H19v2h-1.999v2Zm3.999 0h-2v-2h2v2Zm0-4h-2v-2h2v2ZM9 8H7V6h2v2Z"],
  "chevron-down": ["M13 16h-2v-2h2v2Zm-2-2H9v-2h2v2Zm4 0h-2v-2h2v2Zm-6-2H7v-2h2v2Zm8 0h-2v-2h2v2ZM7 10H5V8h2v2Zm12 0h-2V8h2v2Z"],
  whatsapp: ["M4 20h14v2H2V6h2v14Zm16 0h-2v-2h2v2Zm-9-9H9v2h2v2h2v-2h4v5h-7v-1H9v-2H7v-1H6V7h5v4Zm11 7h-2V6h2v12ZM6 6H4V4h2v2Zm14 0h-2V4h2v2Zm-2-2H6V2h12v2Z"],
  "message-text": ["M20 2H4v2h16zm0 14H6v2h14zm2-12h-2v12h2zM4 4H2v18h2zm2 14H4v2h2zm0-6h4v2H6zm0-4h8v2H6z"],
  lock: ["M5 8h14v2H5zm0 12h14v2H5zM3 10h2v10H3zm16 0h2v10h-2zM7 4h2v4H7zm2-2h6v2H9zm6 2h2v4h-2z"],
  sparkle: ["M11 1h2v4h-2zm0 22h2v-4h-2zM9 5h2v4H9zm0 14h2v-4H9zm4-14h2v4h-2zm0 14h2v-4h-2zM5 9h4v2H5zm14 0h-4v2h4zM1 11h4v2H1zm22 0h-4v2h4zM5 13h4v2H5zm14 0h-4v2h4z"],
  gamepad: ["M4 4h16v2H4zm0 14h16v2H4zM2 6h2v12H2zm18 0h2v12h-2zM8 9h2v6H8z", "M6 11h6v2H6zm8-2h2v2h-2zm2 4h2v2h-2z"],
  // Drawn for this project in the same 24×24, 2px-stroke grid: Pixelarticons (as of 2.4.1) has no text-formatting icons.
  bold: ["M4 4h12v2h-12zM4 6h4v2h-4zM14 6h4v2h-4zM4 8h4v2h-4zM14 8h4v2h-4zM4 10h14v2h-14zM4 12h4v2h-4zM16 12h4v2h-4zM4 14h4v2h-4zM16 14h4v2h-4zM4 16h4v2h-4zM16 16h4v2h-4zM4 18h14v2h-14z"],
  italic: ["M10 4h10v2h-10zM14 6h4v2h-4zM14 8h4v2h-4zM12 10h4v2h-4zM12 12h4v2h-4zM10 14h4v2h-4zM10 16h4v2h-4zM4 18h10v2h-10z"],
  underline: ["M4 4h4v2h-4zM16 4h4v2h-4zM4 6h4v2h-4zM16 6h4v2h-4zM4 8h4v2h-4zM16 8h4v2h-4zM4 10h4v2h-4zM16 10h4v2h-4zM4 12h4v2h-4zM16 12h4v2h-4zM6 14h4v2h-4zM14 14h4v2h-4zM8 16h8v2h-8zM2 20h20v2h-20z"],
  strikethrough: ["M6 4h12v2h-12zM4 6h4v2h-4zM16 6h4v2h-4zM4 8h4v2h-4zM6 10h10v2h-10zM2 12h20v2h-20zM16 14h4v2h-4zM4 16h4v2h-4zM16 16h4v2h-4zM6 18h12v2h-12z"],
  "list-ordered": ["M3 3h1v1h-1zM2 4h2v1h-2zM9 4h13v1h-13zM3 5h1v1h-1zM9 5h13v1h-13zM3 6h1v1h-1zM2 7h3v1h-3zM2 10h2v1h-2zM4 11h1v1h-1zM9 11h13v1h-13zM3 12h1v1h-1zM9 12h13v1h-13zM2 13h1v1h-1zM2 14h3v1h-3zM2 17h2v1h-2zM4 18h1v1h-1zM9 18h13v1h-13zM3 19h1v1h-1zM9 19h13v1h-13zM4 20h1v1h-1zM2 21h2v1h-2z"],
} satisfies Record<string, string[]>;

export type PixelIconName = keyof typeof paths;

export function PixelIcon({ name, size = 20, className }: { name: PixelIconName; size?: number; className?: string }) {
  return <svg className={className} aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges">
    {paths[name].map((d) => <path key={d} d={d} />)}
  </svg>;
}
